import { studentMatchesAttendanceType } from '../../shared/catalog'
import type { AttendanceMutation, AttendanceStatus, AttendanceType } from '../../types/summer'
import type { SourceStudent } from './sheet-source'
import { appDb, appQuery } from './db'

let schemaCheckPromise: Promise<void> | null = null
const year = () => Number(useRuntimeConfig().summerYear || 2026)

/**
 * Internal policy: the application must never execute DDL.
 * This read-only query verifies that the manually provisioned table and
 * required columns are available. A failed check is not cached so the app can
 * recover after a DBA applies the migration without restarting.
 */
const assertSchemaAvailable = async () => {
  if (!schemaCheckPromise) {
    schemaCheckPromise = appQuery(`
      SELECT
        summer_year,
        attendance_date,
        student_id,
        attendance_type,
        status,
        plantel,
        actor_name,
        device_id,
        client_timestamp,
        idempotency_key,
        created_at,
        updated_at
      FROM summer_attendance_sheet
      LIMIT 0
    `).then(() => undefined).catch((cause: any) => {
      schemaCheckPromise = null
      const databaseError = String(cause?.message || cause)
      throw createError({
        statusCode: 503,
        message: 'La tabla summer_attendance_sheet no coincide con el esquema requerido. Ejecute database/migrate-attendance-types.sql con una cuenta autorizada para DDL.',
        data: { databaseError }
      })
    })
  }

  await schemaCheckPromise
}

export const readAttendanceForDate = async (date: string) => {
  await assertSchemaAvailable()
  const rows = await appQuery<any[]>(`
    SELECT student_id AS studentId, attendance_type AS attendanceType, status, updated_at AS updatedAt
    FROM summer_attendance_sheet
    WHERE summer_year = ? AND attendance_date = ?
  `, [year(), date])
  return rows.map((row) => ({
    studentId: String(row.studentId),
    attendanceType: String(row.attendanceType || 'general') as AttendanceType,
    status: row.status as Exclude<AttendanceStatus, 'unmarked'>,
    updatedAt: new Date(row.updatedAt).toISOString()
  }))
}

export const saveAttendanceBatch = async (
  mutations: AttendanceMutation[],
  students: Map<string, SourceStudent>,
  actorName: string
) => {
  await assertSchemaAvailable()
  const connection = await appDb().getConnection()
  const accepted: string[] = []
  try {
    await connection.beginTransaction()
    for (const mutation of mutations) {
      const student = students.get(mutation.studentId)
      if (!student || !studentMatchesAttendanceType(student, mutation.attendanceType)) {
        accepted.push(mutation.idempotencyKey)
        continue
      }

      if (mutation.status === 'unmarked') {
        await connection.execute(`
          DELETE FROM summer_attendance_sheet
          WHERE summer_year = ? AND attendance_date = ? AND student_id = ? AND attendance_type = ?
        `, [year(), mutation.date, mutation.studentId, mutation.attendanceType])
        accepted.push(mutation.idempotencyKey)
        continue
      }

      await connection.execute(`
        INSERT INTO summer_attendance_sheet (
          summer_year, attendance_date, student_id, attendance_type, status, plantel,
          actor_name, device_id, client_timestamp, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          plantel = VALUES(plantel),
          actor_name = VALUES(actor_name),
          device_id = VALUES(device_id),
          client_timestamp = VALUES(client_timestamp),
          idempotency_key = VALUES(idempotency_key),
          updated_at = CURRENT_TIMESTAMP
      `, [
        year(), mutation.date, mutation.studentId, mutation.attendanceType, mutation.status, student.plantel,
        actorName, mutation.deviceId, mutation.clientTimestamp.slice(0, 19).replace('T', ' '), mutation.idempotencyKey
      ])
      accepted.push(mutation.idempotencyKey)
    }
    await connection.commit()
    return accepted
  } catch (cause) {
    await connection.rollback()
    throw cause
  } finally {
    connection.release()
  }
}

export const readAttendanceHistory = async (from: string, to: string, sourceStudents: SourceStudent[]) => {
  await assertSchemaAvailable()
  const allowed = new Map(sourceStudents.map((student) => [student.id, student]))
  const rows = await appQuery<any[]>(`
    SELECT attendance_date AS date, student_id AS studentId, attendance_type AS attendanceType, status, plantel,
      actor_name AS actorName, updated_at AS updatedAt
    FROM summer_attendance_sheet
    WHERE summer_year = ? AND attendance_date BETWEEN ? AND ?
    ORDER BY attendance_date DESC, attendance_type ASC, updated_at DESC
  `, [year(), from, to])

  const byDate = new Map<string, { date: string; present: number; absent: number; total: number; rows: any[] }>()
  rows.forEach((row) => {
    const student = allowed.get(String(row.studentId))
    if (!student) return
    const date = String(row.date).slice(0, 10)
    const status = row.status as 'present' | 'absent'
    const current = byDate.get(date) || { date, present: 0, absent: 0, total: 0, rows: [] }
    current[status] += 1
    current.total += 1
    current.rows.push({
      date,
      studentId: student.id,
      attendanceType: String(row.attendanceType || 'general') as AttendanceType,
      status,
      plantel: student.plantel,
      actorName: String(row.actorName || ''),
      updatedAt: new Date(row.updatedAt).toISOString(),
      name: student.name,
      plantelLabel: student.plantelLabel,
      campus: student.campus,
      program: student.program
    })
    byDate.set(date, current)
  })

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export const attendanceDatabaseHealth = async () => {
  const started = Date.now()
  try {
    await assertSchemaAvailable()
    await appQuery('SELECT 1 AS ok')
    return { reachable: true, latencyMs: Date.now() - started }
  } catch (cause: any) {
    return { reachable: false, latencyMs: Date.now() - started, error: String(cause?.message || cause) }
  }
}
