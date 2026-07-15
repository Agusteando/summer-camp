import { financialQuery } from './db'
import { demoStudents } from './demo'
import { resolveSummerPlantelConfiguration } from './summer-config'
import { setLastSummerSourceTrace, type SummerSourceTrace } from './summer-source-trace'

export type SourceStudent = {
  matricula: string
  nombreCompleto: string
  plantel: string
  curp: string
  conceptId: number
  photoAvailable: boolean
  source: 'aurora' | 'mysql' | 'demo'
}

export type SourceFailure = {
  plantel: string
  name: string
  message: string
  code: string | null
  statusCode: number | null
  responseBody: string | null
}

export type SourcePlantelResult = {
  plantel: string
  ok: boolean
  rowCount: number
  latencyMs: number
  meta: Record<string, unknown> | null
  error: SourceFailure | null
}

export type SourceResult = {
  students: SourceStudent[]
  source: string
  reachable: boolean
  partial: boolean
  requestedPlanteles: string[]
  successfulPlanteles: string[]
  emptyPlanteles: string[]
  failedPlanteles: string[]
  failures: SourceFailure[]
  plantelResults: SourcePlantelResult[]
  configurationCorrections: ReturnType<typeof resolveSummerPlantelConfiguration>['corrections']
}

const clean = (value: unknown, max = 255) => String(value ?? '').trim().slice(0, max)
const normalizeMatricula = (value: unknown) => clean(value, 64).toUpperCase().replace(/\s+/g, '')
const conceptIds = () => String(useRuntimeConfig().summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite)
const isDemo = () => String(useRuntimeConfig().demoMode || '').toLowerCase() === 'true'
const auroraTimeoutMs = () => Math.max(60000, Number(useRuntimeConfig().auroraTimeoutMs || 60000))
const preferredConcept = (left: number, right: number) => Math.max(Number(left || 0), Number(right || 0))

const mergeStudents = (rows: SourceStudent[]) => {
  const map = new Map<string, SourceStudent>()
  for (const row of rows) {
    const matricula = normalizeMatricula(row.matricula)
    if (!matricula) continue
    const current = map.get(matricula)
    if (!current) {
      map.set(matricula, {
        ...row,
        matricula,
        nombreCompleto: clean(row.nombreCompleto, 255),
        plantel: clean(row.plantel, 40).toUpperCase(),
        curp: clean(row.curp, 18).toUpperCase()
      })
      continue
    }
    map.set(matricula, {
      ...current,
      nombreCompleto: current.nombreCompleto || row.nombreCompleto,
      plantel: current.plantel || row.plantel,
      curp: current.curp || row.curp,
      conceptId: preferredConcept(current.conceptId, row.conceptId),
      photoAvailable: current.photoAvailable || row.photoAvailable
    })
  }
  return Array.from(map.values()).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'))
}

const toFailure = (plantel: string, cause: any): SourceFailure => ({
  plantel,
  name: String(cause?.name || 'Error'),
  message: String(cause?.message || cause || 'Error desconocido').slice(0, 4000),
  code: cause?.code ? String(cause.code) : null,
  statusCode: Number.isFinite(Number(cause?.statusCode)) ? Number(cause.statusCode) : null,
  responseBody: cause?.responseBody ? String(cause.responseBody).slice(0, 16000) : null
})

const serializeTraceError = (cause: any) => ({
  name: String(cause?.name || 'Error'),
  message: String(cause?.message || cause || 'Error desconocido').slice(0, 4000),
  code: cause?.code ? String(cause.code) : null,
  statusCode: Number.isFinite(Number(cause?.statusCode)) ? Number(cause.statusCode) : null,
  responseBody: cause?.responseBody ? String(cause.responseBody).slice(0, 16000) : null,
  stack: cause?.stack ? String(cause.stack).slice(0, 12000) : null
})

const normalizeAuroraStudents = (rawRows: any[], allowedConcepts: Set<number>) => {
  const rows: SourceStudent[] = []
  let rejectedMissingMatricula = 0
  let rejectedConcept = 0
  const byConcept: Record<string, number> = {}
  const byPlantel: Record<string, number> = {}

  for (const student of rawRows) {
    const matricula = normalizeMatricula(student?.matricula)
    const conceptId = Number(student?.conceptId || student?.conceptoId || 0)
    if (!matricula) {
      rejectedMissingMatricula += 1
      continue
    }
    if (!allowedConcepts.has(conceptId)) {
      rejectedConcept += 1
      continue
    }
    const plantel = clean(student?.plantel, 40).toUpperCase()
    rows.push({
      matricula,
      nombreCompleto: clean(student?.nombreCompleto || student?.fullName || student?.name || matricula, 255),
      plantel,
      curp: clean(student?.curp, 18).toUpperCase(),
      conceptId,
      photoAvailable: Boolean(student?.photoAvailable || student?.foto),
      source: 'aurora'
    })
    byConcept[String(conceptId)] = (byConcept[String(conceptId)] || 0) + 1
    byPlantel[plantel || '(vacío)'] = (byPlantel[plantel || '(vacío)'] || 0) + 1
  }

  const merged = mergeStudents(rows)
  return {
    students: merged,
    diagnostic: {
      receivedRows: rawRows.length,
      acceptedRows: rows.length,
      rejectedMissingMatricula,
      rejectedConcept,
      distinctStudents: merged.length,
      byConcept,
      byPlantel
    }
  }
}

const fetchFromAurora = async (): Promise<SourceResult> => {
  const config = useRuntimeConfig()
  const plantelConfig = resolveSummerPlantelConfiguration()
  const configuredPlanteles = plantelConfig.resolved
  const concepts = conceptIds()
  const base = clean(config.auroraBaseUrl, 500).replace(/\/+$/, '')
  const token = clean(config.auroraApiToken, 500)
  const timeoutMs = auroraTimeoutMs()
  const started = Date.now()

  const trace: SummerSourceTrace = {
    version: 13,
    startedAt: new Date(started).toISOString(),
    finishedAt: null,
    durationMs: null,
    request: null,
    response: null,
    normalization: null,
    error: null
  }

  if (!base || !token) {
    const error: any = new Error('Aurora no está configurada')
    error.code = 'AURORA_NOT_CONFIGURED'
    trace.error = serializeTraceError(error)
    trace.finishedAt = new Date().toISOString()
    trace.durationMs = Date.now() - started
    setLastSummerSourceTrace(trace)
    throw error
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const url = new URL('/api/external/v1/summer/students', base)
  url.searchParams.set('planteles', configuredPlanteles.join(','))
  url.searchParams.set('year', String(config.summerYear || '2026'))
  url.searchParams.set('cycle', String(config.summerCycle || '2026'))
  url.searchParams.set('concepts', concepts.join(','))
  trace.request = {
    method: 'GET',
    url: url.toString(),
    timeoutMs,
    planteles: configuredPlanteles,
    cycle: String(config.summerCycle || '2026'),
    concepts
  }

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    })
    const responseBody = await response.text()
    let payload: any = null
    try { payload = responseBody ? JSON.parse(responseBody) : null } catch {}
    trace.response = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bodyCharacters: responseBody.length,
      topLevelKeys: payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload).sort() : [],
      dataIsArray: Array.isArray(payload?.data),
      dataLength: Array.isArray(payload?.data) ? payload.data.length : null,
      meta: payload?.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : null
    }

    if (!response.ok) {
      const error: any = new Error(payload?.message || `Aurora respondió ${response.status}`)
      error.code = payload?.statusMessage || payload?.data?.code || 'AURORA_HTTP_ERROR'
      error.statusCode = response.status
      error.responseBody = responseBody || null
      throw error
    }
    if (!Array.isArray(payload?.data)) {
      const error: any = new Error('Aurora no devolvió data[] en el endpoint agregado de Summer Camp')
      error.code = 'AURORA_RESPONSE_SHAPE_INVALID'
      error.statusCode = response.status
      error.responseBody = responseBody || null
      throw error
    }

    const normalized = normalizeAuroraStudents(payload.data, new Set(concepts))
    trace.normalization = normalized.diagnostic

    const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : {}
    const plantelResults = Array.isArray(meta.plantelResults) ? meta.plantelResults : []
    const successfulPlanteles = Array.isArray(meta.successfulPlanteles) ? meta.successfulPlanteles.map(String) : plantelResults.filter((row: any) => row?.ok).map((row: any) => String(row.plantel))
    const emptyPlanteles = Array.isArray(meta.emptyPlanteles) ? meta.emptyPlanteles.map(String) : plantelResults.filter((row: any) => row?.ok && Number(row?.rowCount || 0) === 0).map((row: any) => String(row.plantel))
    const failedPlanteles = Array.isArray(meta.failedPlanteles) ? meta.failedPlanteles.map(String) : plantelResults.filter((row: any) => row?.ok === false).map((row: any) => String(row.plantel))
    const failures = plantelResults
      .filter((row: any) => row?.ok === false)
      .map((row: any) => toFailure(String(row?.plantel || 'aurora'), row?.error || { message: 'Error sin detalle' }))

    trace.finishedAt = new Date().toISOString()
    trace.durationMs = Date.now() - started
    setLastSummerSourceTrace(trace)

    return {
      students: normalized.students,
      source: 'aurora',
      reachable: true,
      partial: Boolean(meta.partial || failedPlanteles.length),
      requestedPlanteles: Array.isArray(meta.requestedPlanteles) ? meta.requestedPlanteles.map(String) : configuredPlanteles,
      successfulPlanteles,
      emptyPlanteles,
      failedPlanteles,
      failures,
      plantelResults: plantelResults.map((row: any) => ({
        plantel: String(row?.plantel || ''),
        ok: Boolean(row?.ok),
        rowCount: Number(row?.rowCount || 0),
        latencyMs: Number(row?.latencyMs || 0),
        meta: null,
        error: row?.ok === false ? toFailure(String(row?.plantel || 'aurora'), row?.error || {}) : null
      })),
      configurationCorrections: plantelConfig.corrections
    }
  } catch (cause: any) {
    if (cause?.name === 'AbortError') {
      cause.code = 'AURORA_TIMEOUT'
      cause.message = `Aurora excedió ${timeoutMs} ms en la consulta agregada de Summer Camp`
    }
    trace.error = serializeTraceError(cause)
    trace.finishedAt = new Date().toISOString()
    trace.durationMs = Date.now() - started
    setLastSummerSourceTrace(trace)
    throw cause
  } finally {
    clearTimeout(timeout)
  }
}

const fetchFromMysql = async (): Promise<SourceResult> => {
  const ids = conceptIds()
  if (!ids.length) throw new Error('No hay conceptos configurados')
  const placeholders = ids.map(() => '?').join(',')
  const cycle = String(useRuntimeConfig().summerCycle || '2026')
  const rows = await financialQuery<any[]>(`
    SELECT
      UPPER(TRIM(E.matricula)) AS matricula,
      MAX(TRIM(COALESCE(NULLIF(B.nombreCompleto, ''), NULLIF(E.nombreCompleto, ''), ''))) AS nombreCompleto,
      MAX(UPPER(TRIM(COALESCE(B.plantel, E.plantel, '')))) AS plantel,
      MAX(TRIM(COALESCE(B.curp, ''))) AS curp,
      MAX(E.conceptId) AS conceptId
    FROM (
      SELECT R.matricula, R.nombreCompleto, R.plantel, CAST(R.concepto AS UNSIGNED) AS conceptId
      FROM referenciasdepago R
      WHERE R.estatus = 'Vigente' AND R.ciclo = ? AND CAST(R.concepto AS UNSIGNED) IN (${placeholders})
      UNION ALL
      SELECT D.matricula, '' AS nombreCompleto, '' AS plantel, CAST(D.concepto AS UNSIGNED) AS conceptId
      FROM documentos D
      WHERE D.estatus = 'Activo' AND D.ciclo = ? AND CAST(D.concepto AS UNSIGNED) IN (${placeholders})
    ) E
    LEFT JOIN base B ON B.matricula = E.matricula
    WHERE TRIM(COALESCE(E.matricula, '')) <> ''
    GROUP BY UPPER(TRIM(E.matricula))
  `, [cycle, ...ids, cycle, ...ids])

  const students = mergeStudents(rows.map((row: any) => ({
    matricula: normalizeMatricula(row.matricula),
    nombreCompleto: clean(row.nombreCompleto, 255),
    plantel: clean(row.plantel, 40).toUpperCase(),
    curp: clean(row.curp, 18).toUpperCase(),
    conceptId: Number(row.conceptId || 0),
    photoAvailable: false,
    source: 'mysql' as const
  })))

  return {
    students,
    source: 'mysql',
    reachable: true,
    partial: false,
    requestedPlanteles: [],
    successfulPlanteles: [],
    emptyPlanteles: [],
    failedPlanteles: [],
    failures: [],
    plantelResults: [],
    configurationCorrections: []
  }
}

export const loadSummerSource = async (): Promise<SourceResult> => {
  if (isDemo()) return {
    students: demoStudents(),
    source: 'demo',
    reachable: true,
    partial: false,
    requestedPlanteles: [],
    successfulPlanteles: [],
    emptyPlanteles: [],
    failedPlanteles: [],
    failures: [],
    plantelResults: [],
    configurationCorrections: []
  }
  const mode = String(useRuntimeConfig().summerSourceMode || 'aurora').toLowerCase()
  if (mode === 'mysql') return await fetchFromMysql()
  if (mode === 'hybrid') {
    try { return await fetchFromAurora() } catch { return await fetchFromMysql() }
  }
  return await fetchFromAurora()
}

export const testSourceHealth = async () => {
  if (isDemo()) return { reachable: true, source: 'demo', latencyMs: 0 }
  const started = Date.now()
  try {
    const mode = String(useRuntimeConfig().summerSourceMode || 'aurora').toLowerCase()
    if (mode === 'mysql') {
      await financialQuery('SELECT 1 AS ok')
      return { reachable: true, source: 'mysql', latencyMs: Date.now() - started }
    }
    const config = useRuntimeConfig()
    const base = clean(config.auroraBaseUrl, 500).replace(/\/+$/, '')
    const token = clean(config.auroraApiToken, 500)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const plantelConfig = resolveSummerPlantelConfiguration()
      const healthUrl = new URL('/api/external/v1/summer/health', base)
      const probePlantel = plantelConfig.resolved[0]
      if (probePlantel) healthUrl.searchParams.set('plantel', probePlantel)
      const response = await fetch(healthUrl, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' })
      const payload: any = await response.json().catch(() => null)
      if (!response.ok || payload?.bridgeReachable === false) {
        const error: any = new Error(`Aurora health falló${response.status ? ` (${response.status})` : ''}`)
        error.statusCode = response.status
        error.diagnostic = payload
        throw error
      }
      return {
        reachable: true,
        source: 'aurora',
        latencyMs: Date.now() - started,
        bridgeReachable: payload?.bridgeReachable ?? null,
        centralReachable: payload?.centralReachable ?? null,
        probePlantel: payload?.plantel || probePlantel || null,
        status: payload?.status || 'ok'
      }
    } finally { clearTimeout(timeout) }
  } catch (cause: any) {
    return {
      reachable: false,
      source: String(useRuntimeConfig().summerSourceMode || 'aurora'),
      latencyMs: Date.now() - started,
      error: String(cause?.message || cause || 'Error desconocido'),
      statusCode: Number.isFinite(Number(cause?.statusCode)) ? Number(cause.statusCode) : null,
      details: cause?.diagnostic || null
    }
  }
}
