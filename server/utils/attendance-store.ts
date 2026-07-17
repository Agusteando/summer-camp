import type { AttendanceMutation, AttendanceStatus } from '../../types/summer'
import type { SourceStudent } from './sheet-source'
import { appDb, appQuery } from './db'

let schemaPromise: Promise<void> | null = null
const year = () => Number(useRuntimeConfig().summerYear || 2026)

const ensureSchema = async () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await appQuery(`
        CREATE TABLE IF NOT EXISTS summer_attendance_sheet (
          summer_year SMALLINT UNSIGNED NOT NULL,
          attendance_date DATE NOT NULL,
          student_id VARCHAR(120) NOT NULL,
          status ENUM('present', 'absent') NOT NULL,
          plantel VARCHAR(20) NOT NULL,
          actor_name VARCHAR(160) NOT NULL DEFAULT '',
          device_id VARCHAR(120) NOT NULL,
          client_timestamp DATETIME NOT NULL,
          idempotency_key VARCHAR(160) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (summer_year, attendance_date, student_id),
          KEY idx_summer_attendance_sheet_idempotency (idempotency_key),
          KEY idx_summer_attendance_sheet_date (summer_year, attendance_date),
          KEY idx_summer_attendance_sheet_plantel (summer_year, plantel, attendance_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    })().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  await schemaPromise
}

export const readAttendanceForDate = async (date: string) => {
  await ensureSchema()
  const rows = await appQuery<any[]>(`
    SELECT student_id AS studentId, status, updated_at AS updatedAt
    FROM summer_attendance_sheet
    WHERE summer_year = ? AND attendance_date = ?
  `, [year(), date])
  return rows.map((row) => ({
    studentId: String(row.studentId),
    status: row.status as Exclude<AttendanceStatus, 'unmarked'>,
    updatedAt: new Date(row.updatedAt).toISOString()
  }))
}

export const saveAttendanceBatch = async (
  mutations: AttendanceMutation[],
  students: Map<string, SourceStudent>,
  actorName: string
) => {
  await ensureSchema()
  const connection = await appDb().getConnection()
  const accepted: string[] = []
  try {
    await connection.beginTransaction()
    for (const mutation of mutations) {
      const student = students.get(mutation.studentId)
      if (!student) continue

      if (mutation.status === 'unmarked') {
        await connection.execute(`
          DELETE FROM summer_attendance_sheet
          WHERE summer_year = ? AND attendance_date = ? AND student_id = ?
        `, [year(), mutation.date, mutation.studentId])
        accepted.push(mutation.idempotencyKey)
        continue
      }

      await connection.execute(`
        INSERT INTO summer_attendance_sheet (
          summer_year, attendance_date, student_id, status, plantel,
          actor_name, device_id, client_timestamp, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          plantel = VALUES(plantel),
          actor_name = VALUES(actor_name),
          device_id = VALUES(device_id),
          client_timestamp = VALUES(client_timestamp),
          idempotency_key = VALUES(idempotency_key),
          updated_at = CURRENT_TIMESTAMP
      `, [
        year(), mutation.date, mutation.studentId, mutation.status, student.plantel,
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
  await ensureSchema()
  const allowed = new Map(sourceStudents.map((student) => [student.id, student]))
  const rows = await appQuery<any[]>(`
    SELECT attendance_date AS date, student_id AS studentId, status, plantel,
      actor_name AS actorName, updated_at AS updatedAt
    FROM summer_attendance_sheet
    WHERE summer_year = ? AND attendance_date BETWEEN ? AND ?
    ORDER BY attendance_date DESC, updated_at DESC
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
      status,
      plantel: student.plantel,
      actorName: String(row.actorName || ''),
      updatedAt: new Date(row.updatedAt).toISOString(),
      name: student.name,
      plantelLabel: student.plantelLabel,
      campus: student.campus
    })
    byDate.set(date, current)
  })

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export const attendanceDatabaseHealth = async () => {
  const started = Date.now()
  try {
    await ensureSchema()
    await appQuery('SELECT 1 AS ok')
    return { reachable: true, latencyMs: Date.now() - started }
  } catch (cause: any) {
    return { reachable: false, latencyMs: Date.now() - started, error: String(cause?.message || cause) }
  }
}
