import { appQuery } from '../../utils/db'
import { serializeDiagnosticError } from '../../utils/diagnostic-error'
import { loadSummerSource, testSourceHealth } from '../../utils/summer-source'
import { buildSnapshot, loadAttendance, loadOverrides } from '../../utils/summer-state'
import { isoDate } from '../../utils/validation'

const elapsed = (started: number) => Date.now() - started
const requestId = () => `diag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type Check = {
  key: string
  label: string
  ok: boolean
  latencyMs: number
  details?: unknown
  error?: ReturnType<typeof serializeDiagnosticError>
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig()
  if (String(config.public.diagnosticsEnabled) === 'false') {
    throw createError({ statusCode: 404, message: 'Diagnóstico deshabilitado.' })
  }

  const id = requestId()
  const started = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const concepts = String(config.summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite)
  const planteles = String(config.summerPlanteles || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
  const checks: Check[] = []

  const run = async (key: string, label: string, task: () => Promise<unknown>) => {
    const checkStarted = Date.now()
    try {
      const details = await task()
      checks.push({ key, label, ok: true, latencyMs: elapsed(checkStarted), details })
      return details
    } catch (cause: any) {
      checks.push({ key, label, ok: false, latencyMs: elapsed(checkStarted), details: cause?.diagnostic || cause?.failures || undefined, error: serializeDiagnosticError(cause) })
      return null
    }
  }

  await run('app_connection', 'Conexión MySQL de Summer Camp', async () => {
    const rows = await appQuery<any[]>('SELECT DATABASE() AS databaseName, NOW() AS serverTime')
    return { databaseName: rows?.[0]?.databaseName || null, serverTime: rows?.[0]?.serverTime || null }
  })

  await run('app_schema', 'Tablas y columnas operativas', async () => {
    const tables = await appQuery<any[]>(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('summer_student_overrides', 'summer_attendance')
      ORDER BY TABLE_NAME
    `)
    const columns = await appQuery<any[]>(`
      SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('summer_student_overrides', 'summer_attendance')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `)
    const required: Record<string, string[]> = {
      summer_student_overrides: ['summer_year', 'matricula', 'program', 'meal_plan', 'age_override', 'updated_by', 'updated_at'],
      summer_attendance: ['id', 'summer_year', 'attendance_date', 'matricula', 'status', 'plantel', 'actor_name', 'device_id', 'client_timestamp', 'idempotency_key', 'created_at', 'updated_at']
    }
    const presentTables = new Set(tables.map((row) => String(row.tableName)))
    const presentColumns = new Map<string, Set<string>>()
    columns.forEach((row) => {
      const table = String(row.tableName)
      const set = presentColumns.get(table) || new Set<string>()
      set.add(String(row.columnName))
      presentColumns.set(table, set)
    })
    const missingTables = Object.keys(required).filter((table) => !presentTables.has(table))
    const missingColumns = Object.entries(required).flatMap(([table, names]) => names
      .filter((column) => !presentColumns.get(table)?.has(column))
      .map((column) => `${table}.${column}`))
    const diagnostic = { tables, columns, missingTables, missingColumns }
    if (missingTables.length || missingColumns.length) {
      const error: any = new Error('El esquema de Summer Camp no coincide con lo que espera la aplicación.')
      error.code = 'APP_SCHEMA_MISMATCH'
      error.diagnostic = diagnostic
      throw error
    }
    return diagnostic
  })

  await run('source_health', 'Conectividad de la fuente externa', async () => {
    const health = await testSourceHealth()
    if (!health.reachable) {
      const error: any = new Error('La fuente externa no superó la prueba de conectividad.')
      error.code = 'SOURCE_UNREACHABLE'
      error.diagnostic = health
      throw error
    }
    return health
  })

  let sourceResult: Awaited<ReturnType<typeof loadSummerSource>> | null = null
  await run('source_students', 'Alumnos inscritos en conceptos Summer Camp', async () => {
    sourceResult = await loadSummerSource()
    const byPlantel: Record<string, number> = {}
    const byConcept: Record<string, number> = {}
    sourceResult.students.forEach((student) => {
      byPlantel[student.plantel] = (byPlantel[student.plantel] || 0) + 1
      byConcept[String(student.conceptId)] = (byConcept[String(student.conceptId)] || 0) + 1
    })
    const summary = {
      totalDistinctStudents: sourceResult.students.length,
      byPlantel,
      byConcept,
      failedPlanteles: sourceResult.failedPlanteles,
      failures: sourceResult.failures || [],
      partial: sourceResult.partial,
      source: sourceResult.source
    }
    if (!sourceResult.students.length) {
      const error: any = new Error('La fuente respondió, pero devolvió cero alumnos para los conceptos configurados.')
      error.code = 'SUMMER_SOURCE_EMPTY'
      error.diagnostic = summary
      throw error
    }
    return summary
  })

  const resolvedSource = sourceResult as Awaited<ReturnType<typeof loadSummerSource>> | null
  const students = resolvedSource?.students || []
  const matriculas = students.map((student: any) => student.matricula)

  if (matriculas.length) {
    await run('overrides_read', 'Lectura de modalidades, alimentos y edades', async () => {
      const rows = await loadOverrides(matriculas)
      return { matchedOverrides: rows.size, enrollmentStudents: matriculas.length }
    })

    await run('attendance_read', 'Lectura de asistencia del día', async () => {
      const rows = await loadAttendance(date, matriculas)
      return { attendanceRows: rows.size, date }
    })

    await run('snapshot_pipeline', 'Construcción completa de la lista', async () => {
      const snapshot = await buildSnapshot(date, students, resolvedSource!)
      const byProgram = snapshot.students.reduce<Record<string, number>>((acc, student) => {
        acc[student.program] = (acc[student.program] || 0) + 1
        return acc
      }, {})
      return {
        students: snapshot.students.length,
        planteles: snapshot.summaries.length,
        byProgram,
        generatedAt: snapshot.meta.generatedAt
      }
    })
  } else {
    checks.push({
      key: 'snapshot_pipeline',
      label: 'Construcción completa de la lista',
      ok: false,
      latencyMs: 0,
      details: { skipped: true, reason: 'La fuente no devolvió alumnos.' }
    })
  }

  const sourceCheck: any = checks.find((check) => check.key === 'source_students')
  const sourceSummary = sourceCheck?.details || null
  const ok = checks.every((check) => check.ok)

  return {
    ok,
    requestId: id,
    checkedAt: new Date().toISOString(),
    latencyMs: elapsed(started),
    date,
    config: {
      sourceMode: String(config.summerSourceMode || 'aurora'),
      summerYear: Number(config.summerYear || 2026),
      cycle: String(config.summerCycle || '2026'),
      conceptIds: concepts,
      configuredPlanteles: planteles,
      diagnosticsEnabled: true
    },
    assumptions: {
      enrollmentDefinition: 'Matrícula distinta con alguno de los conceptos configurados.',
      campusRule: 'Toluca = CT, PT, ST. Cualquier otro plantel = Metepec.',
      programRule: 'La modalidad se toma de summer_student_overrides; el concepto financiero no identifica Husky Dreamers o Clínica.',
      mealRule: '986 = 0 alimentos, 987 = 1 alimento por definir, 988 = 2 alimentos.',
      kpiRule: 'El total principal es inscripción; asistencia se presenta como presentes / inscritos.'
    },
    sourceSummary,
    checks
  }
})
