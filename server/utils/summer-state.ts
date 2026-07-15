import { appQuery } from './db'
import { createStudentAttendanceToken, createStudentPhotoToken } from './tokens'
import { ageFromCurp } from '~/shared/curp'
import { ageGroupFor, campusForPlantel, mealCountFromConcept, mealPlanFromConcept, PLANTEL_LABELS } from '~/shared/catalog'
import type { AttendanceMutation, MealPlan, ProgramKind, SnapshotResponse, SummerStudent } from '~/types/summer'
import type { SourceStudent } from './summer-source'

const demoOverrides = new Map<string, { program: ProgramKind; mealPlan: MealPlan | null; ageOverride: number | null }>()
const demoAttendance = new Map<string, { status: 'present' | 'absent'; updatedAt: string; plantel: string }>()
const isDemo = () => String(useRuntimeConfig().demoMode || '').toLowerCase() === 'true'
const year = () => Number(useRuntimeConfig().summerYear || 2026)

const dateKey = (date: string, matricula: string) => `${date}:${matricula}`

export const loadOverrides = async (matriculas: string[]) => {
  const result = new Map<string, { program: ProgramKind; mealPlan: MealPlan | null; ageOverride: number | null }>()
  if (!matriculas.length) return result
  if (isDemo()) {
    matriculas.forEach((matricula) => {
      const value = demoOverrides.get(matricula)
      if (value) result.set(matricula, value)
    })
    return result
  }
  const placeholders = matriculas.map(() => '?').join(',')
  const rows = await appQuery<any[]>(`
    SELECT matricula, program, meal_plan AS mealPlan, age_override AS ageOverride
    FROM summer_student_overrides
    WHERE summer_year = ? AND matricula IN (${placeholders})
  `, [year(), ...matriculas])
  rows.forEach((row) => result.set(String(row.matricula), {
    program: row.program || 'unassigned',
    mealPlan: row.mealPlan || null,
    ageOverride: row.ageOverride === null ? null : Number(row.ageOverride)
  }))
  return result
}

export const loadAttendance = async (date: string, matriculas: string[]) => {
  const result = new Map<string, { status: 'present' | 'absent'; updatedAt: string }>()
  if (!matriculas.length) return result
  if (isDemo()) {
    matriculas.forEach((matricula) => {
      const value = demoAttendance.get(dateKey(date, matricula))
      if (value) result.set(matricula, value)
    })
    return result
  }
  const placeholders = matriculas.map(() => '?').join(',')
  const rows = await appQuery<any[]>(`
    SELECT matricula, status, updated_at AS updatedAt
    FROM summer_attendance
    WHERE summer_year = ? AND attendance_date = ? AND matricula IN (${placeholders})
  `, [year(), date, ...matriculas])
  rows.forEach((row) => result.set(String(row.matricula), { status: row.status, updatedAt: new Date(row.updatedAt).toISOString() }))
  return result
}

export const buildSnapshot = async (date: string, sourceStudents: SourceStudent[], sourceMeta: { source: string; reachable: boolean; partial: boolean; failedPlanteles: string[] }): Promise<SnapshotResponse> => {
  const visible = sourceStudents
  const matriculas = visible.map((student) => student.matricula)
  const [overrides, attendance] = await Promise.all([loadOverrides(matriculas), loadAttendance(date, matriculas)])

  const students: SummerStudent[] = visible.map((student) => {
    const override = overrides.get(student.matricula)
    const curpAge = ageFromCurp(student.curp)
    const age = override?.ageOverride ?? curpAge
    const attendanceValue = attendance.get(student.matricula)
    const mealCount = mealCountFromConcept(student.conceptId)
    return {
      matricula: student.matricula,
      name: student.nombreCompleto || student.matricula,
      plantel: student.plantel,
      plantelLabel: PLANTEL_LABELS[student.plantel] || student.plantel,
      campus: campusForPlantel(student.plantel),
      curp: student.curp,
      age,
      ageSource: override?.ageOverride !== null && override?.ageOverride !== undefined ? 'manual' : curpAge !== null ? 'curp' : 'missing',
      ageGroup: ageGroupFor(age),
      program: override?.program || 'unassigned',
      conceptId: student.conceptId,
      mealCount,
      mealPlan: override?.mealPlan || mealPlanFromConcept(student.conceptId),
      photoAvailable: student.photoAvailable,
      photoToken: student.photoAvailable ? createStudentPhotoToken(student.matricula, student.plantel) : null,
      attendanceToken: createStudentAttendanceToken(student.matricula, student.plantel),
      attendance: attendanceValue?.status || 'unmarked',
      attendanceUpdatedAt: attendanceValue?.updatedAt || null,
      source: student.source
    }
  })

  const summaryMap = new Map<string, SnapshotResponse['summaries'][number]>()
  students.forEach((student) => {
    const current = summaryMap.get(student.plantel) || {
      plantel: student.plantel,
      label: student.plantelLabel,
      campus: student.campus,
      total: 0,
      present: 0,
      absent: 0,
      unmarked: 0,
      food: 0,
      pendingProgram: 0
    }
    current.total += 1
    current[student.attendance] += 1
    if (student.mealCount > 0) current.food += 1
    if (student.program === 'unassigned') current.pendingProgram += 1
    summaryMap.set(student.plantel, current)
  })

  return {
    date,
    students,
    summaries: Array.from(summaryMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'es')),
    meta: {
      generatedAt: new Date().toISOString(),
      source: sourceMeta.source,
      sourceReachable: sourceMeta.reachable,
      partial: sourceMeta.partial,
      failedPlanteles: sourceMeta.failedPlanteles
    }
  }
}

export const saveAttendanceBatch = async (mutations: AttendanceMutation[], plantelByMatricula: Map<string, string>, deviceId: string, actorName: string) => {
  const accepted: string[] = []
  for (const mutation of mutations) {
    const plantel = plantelByMatricula.get(mutation.matricula)
    if (!plantel) continue
    if (isDemo()) {
      demoAttendance.set(dateKey(mutation.date, mutation.matricula), { status: mutation.status, updatedAt: new Date().toISOString(), plantel })
      accepted.push(mutation.idempotencyKey)
      continue
    }
    await appQuery(`
      INSERT INTO summer_attendance (
        summer_year, attendance_date, matricula, status, plantel, actor_email, actor_name, device_id, client_timestamp, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status), plantel = VALUES(plantel), actor_email = VALUES(actor_email), actor_name = VALUES(actor_name),
        device_id = VALUES(device_id), client_timestamp = VALUES(client_timestamp), idempotency_key = VALUES(idempotency_key), updated_at = CURRENT_TIMESTAMP
    `, [year(), mutation.date, mutation.matricula, mutation.status, plantel, '', actorName, deviceId, mutation.clientTimestamp.slice(0, 19).replace('T', ' '), mutation.idempotencyKey])
    accepted.push(mutation.idempotencyKey)
  }
  return accepted
}

export const saveOverrides = async (items: Array<{ matricula: string; program?: ProgramKind; mealPlan?: MealPlan; ageOverride?: number | null }>, deviceId: string) => {
  for (const item of items) {
    if (isDemo()) {
      const current = demoOverrides.get(item.matricula) || { program: 'unassigned' as ProgramKind, mealPlan: null, ageOverride: null }
      demoOverrides.set(item.matricula, {
        program: item.program ?? current.program,
        mealPlan: item.mealPlan ?? current.mealPlan,
        ageOverride: item.ageOverride === undefined ? current.ageOverride : item.ageOverride
      })
      continue
    }
    await appQuery(`
      INSERT INTO summer_student_overrides (summer_year, matricula, program, meal_plan, age_override, updated_by)
      VALUES (?, ?, COALESCE(?, 'unassigned'), ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        program = CASE WHEN ? THEN VALUES(program) ELSE program END,
        meal_plan = CASE WHEN ? THEN VALUES(meal_plan) ELSE meal_plan END,
        age_override = CASE WHEN ? THEN VALUES(age_override) ELSE age_override END,
        updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP
    `, [
      year(), item.matricula, item.program ?? null, item.mealPlan ?? null, item.ageOverride ?? null, deviceId,
      item.program !== undefined ? 1 : 0,
      item.mealPlan !== undefined ? 1 : 0,
      item.ageOverride !== undefined ? 1 : 0
    ])
  }
}

export const readAttendanceHistory = async (from: string, to: string, sourceStudents: SourceStudent[]) => {
  const allowed = new Map(sourceStudents.map((student) => [student.matricula, student]))
  const rows: Array<{ date: string; matricula: string; status: 'present' | 'absent'; plantel: string; actorName: string; updatedAt: string }> = []
  if (isDemo()) {
    for (const [key, value] of demoAttendance.entries()) {
      const [date, matricula] = key.split(':')
      if (date >= from && date <= to && allowed.has(matricula)) rows.push({ date, matricula, status: value.status, plantel: value.plantel, actorName: 'Demo', updatedAt: value.updatedAt })
    }
  } else {
    const data = await appQuery<any[]>(`
      SELECT attendance_date AS date, matricula, status, plantel, actor_name AS actorName, updated_at AS updatedAt
      FROM summer_attendance
      WHERE summer_year = ? AND attendance_date BETWEEN ? AND ?
      ORDER BY attendance_date DESC, updated_at DESC
    `, [year(), from, to])
    data.forEach((row) => {
      if (!allowed.has(String(row.matricula))) return
      rows.push({
        date: String(row.date).slice(0, 10), matricula: String(row.matricula), status: row.status,
        plantel: String(row.plantel), actorName: String(row.actorName || ''), updatedAt: new Date(row.updatedAt).toISOString()
      })
    })
  }
  const byDate = new Map<string, { date: string; present: number; absent: number; total: number; rows: any[] }>()
  rows.forEach((row) => {
    const student = allowed.get(row.matricula)
    const current = byDate.get(row.date) || { date: row.date, present: 0, absent: 0, total: 0, rows: [] }
    current[row.status] += 1
    current.total += 1
    current.rows.push({ ...row, name: student?.nombreCompleto || row.matricula, plantelLabel: PLANTEL_LABELS[row.plantel] || row.plantel })
    byDate.set(row.date, current)
  })
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date))
}
