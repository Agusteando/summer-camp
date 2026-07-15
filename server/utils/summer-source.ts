import { financialQuery } from './db'
import { demoStudents } from './demo'
import { resolveSummerPlantelConfiguration } from './summer-config'

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
const auroraTimeoutMs = () => Math.max(25000, Number(useRuntimeConfig().auroraTimeoutMs || 25000))

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
  responseBody: cause?.responseBody ? String(cause.responseBody).slice(0, 12000) : null
})

const fetchAuroraPlantel = async (plantel: string): Promise<{ rows: SourceStudent[]; meta: Record<string, unknown> | null; latencyMs: number }> => {
  const config = useRuntimeConfig()
  const base = clean(config.auroraBaseUrl, 500).replace(/\/+$/, '')
  const token = clean(config.auroraApiToken, 500)
  if (!base || !token) throw Object.assign(new Error('Aurora no está configurada'), { code: 'AURORA_NOT_CONFIGURED' })

  const started = Date.now()
  const controller = new AbortController()
  const timeoutMs = auroraTimeoutMs()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = new URL('/api/external/v1/summer/students', base)
    url.searchParams.set('plantel', plantel)
    url.searchParams.set('year', String(config.summerYear || '2026'))
    url.searchParams.set('cycle', String(config.summerCycle || '2026'))
    url.searchParams.set('concepts', conceptIds().join(','))
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    })
    if (!response.ok) {
      const responseBody = (await response.text().catch(() => '')).slice(0, 12000)
      const error: any = new Error(`Aurora respondió ${response.status} para ${plantel}`)
      error.code = 'AURORA_HTTP_ERROR'
      error.statusCode = response.status
      error.responseBody = responseBody || null
      throw error
    }

    const responseBody = await response.text()
    let payload: any = null
    try {
      payload = responseBody ? JSON.parse(responseBody) : null
    } catch (cause: any) {
      const error: any = new Error(`Aurora devolvió JSON inválido para ${plantel}`)
      error.code = 'AURORA_INVALID_JSON'
      error.statusCode = response.status
      error.responseBody = responseBody.slice(0, 12000) || null
      error.cause = cause
      throw error
    }
    if (!Array.isArray(payload?.data)) {
      const error: any = new Error(`Aurora no devolvió data[] para ${plantel}`)
      error.code = 'AURORA_RESPONSE_SHAPE_INVALID'
      error.statusCode = response.status
      error.responseBody = responseBody.slice(0, 12000) || null
      throw error
    }

    const allowedConcepts = new Set(conceptIds())
    const rows = payload.data.map((student: any) => ({
      matricula: normalizeMatricula(student.matricula),
      nombreCompleto: clean(student.nombreCompleto || student.fullName || student.name, 255),
      plantel: clean(student.plantel || plantel, 40).toUpperCase(),
      curp: clean(student.curp, 18).toUpperCase(),
      conceptId: Number(student.conceptId || student.conceptoId || 0),
      photoAvailable: Boolean(student.photoAvailable || student.foto),
      source: 'aurora' as const
    })).filter((student: SourceStudent) => Boolean(student.matricula) && allowedConcepts.has(student.conceptId))

    return {
      rows,
      meta: payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : null,
      latencyMs: Date.now() - started
    }
  } catch (cause: any) {
    if (cause?.name === 'AbortError') {
      cause.code = 'AURORA_TIMEOUT'
      cause.message = `Aurora excedió ${timeoutMs} ms para ${plantel}`
    }
    throw cause
  } finally {
    clearTimeout(timeout)
  }
}

const fetchFromAurora = async (): Promise<SourceResult> => {
  const plantelConfig = resolveSummerPlantelConfiguration()
  const configuredPlanteles = plantelConfig.resolved
  const settled = await Promise.allSettled(configuredPlanteles.map(async (plantel) => ({ plantel, result: await fetchAuroraPlantel(plantel) })))
  const rows: SourceStudent[] = []
  const successfulPlanteles: string[] = []
  const emptyPlanteles: string[] = []
  const failedPlanteles: string[] = []
  const failures: SourceFailure[] = []
  const plantelResults: SourcePlantelResult[] = []

  settled.forEach((result, index) => {
    const plantel = configuredPlanteles[index]
    if (result.status === 'fulfilled') {
      successfulPlanteles.push(plantel)
      rows.push(...result.value.result.rows)
      if (!result.value.result.rows.length) emptyPlanteles.push(plantel)
      plantelResults.push({
        plantel,
        ok: true,
        rowCount: result.value.result.rows.length,
        latencyMs: result.value.result.latencyMs,
        meta: result.value.result.meta,
        error: null
      })
      return
    }
    const failure = toFailure(plantel, result.reason)
    failedPlanteles.push(plantel)
    failures.push(failure)
    plantelResults.push({ plantel, ok: false, rowCount: 0, latencyMs: 0, meta: null, error: failure })
  })

  if (!successfulPlanteles.length) {
    const error: any = new Error('Aurora no respondió correctamente para ningún plantel financiero')
    error.code = 'AURORA_ALL_PLANTELES_FAILED'
    error.failures = failures
    error.diagnostic = {
      requestedPlanteles: configuredPlanteles,
      successfulPlanteles,
      failedPlanteles,
      timeoutMs: auroraTimeoutMs(),
      configurationCorrections: plantelConfig.corrections
    }
    throw error
  }

  return {
    students: mergeStudents(rows),
    source: 'aurora',
    reachable: true,
    partial: failedPlanteles.length > 0,
    requestedPlanteles: configuredPlanteles,
    successfulPlanteles,
    emptyPlanteles,
    failedPlanteles,
    failures,
    plantelResults,
    configurationCorrections: plantelConfig.corrections
  }
}

const fetchFromMysql = async (): Promise<SourceResult> => {
  const ids = conceptIds()
  if (!ids.length) throw new Error('No hay conceptos configurados')
  const placeholders = ids.map(() => '?').join(',')
  const cycle = String(useRuntimeConfig().summerCycle || '2026')

  const paidQuery = () => financialQuery<any[]>(`
    SELECT
      UPPER(TRIM(R.matricula)) AS matricula,
      MAX(TRIM(COALESCE(R.nombreCompleto, B.nombreCompleto, ''))) AS nombreCompleto,
      MAX(UPPER(TRIM(COALESCE(R.plantel, B.plantel, '')))) AS plantel,
      MAX(TRIM(COALESCE(B.curp, ''))) AS curp,
      MAX(CAST(COALESCE(P.concepto_id, D.concepto, R.concepto) AS UNSIGNED)) AS conceptId
    FROM referenciasdepago R
    LEFT JOIN documentos D ON D.documento = R.documento
    LEFT JOIN documento_concepto_periodos P
      ON P.documento = R.documento
      AND P.estatus = 'Activo'
      AND CAST(R.mes AS UNSIGNED) >= P.start_mes
      AND (P.end_mes IS NULL OR CAST(R.mes AS UNSIGNED) <= P.end_mes)
    LEFT JOIN base B ON B.matricula = R.matricula
    WHERE R.estatus = 'Vigente'
      AND R.ciclo = ?
      AND CAST(COALESCE(P.concepto_id, D.concepto, R.concepto) AS UNSIGNED) IN (${placeholders})
    GROUP BY UPPER(TRIM(R.matricula))
  `, [cycle, ...ids])

  const chargedQuery = () => financialQuery<any[]>(`
    SELECT
      UPPER(TRIM(D.matricula)) AS matricula,
      MAX(TRIM(COALESCE(B.nombreCompleto, ''))) AS nombreCompleto,
      MAX(UPPER(TRIM(COALESCE(B.plantel, '')))) AS plantel,
      MAX(TRIM(COALESCE(B.curp, ''))) AS curp,
      MAX(CAST(COALESCE(P.concepto_id, D.concepto) AS UNSIGNED)) AS conceptId
    FROM documentos D
    LEFT JOIN documento_concepto_periodos P ON P.documento = D.documento AND P.estatus = 'Activo'
    LEFT JOIN base B ON B.matricula = D.matricula
    WHERE D.estatus = 'Activo'
      AND D.ciclo = ?
      AND (P.accion IS NULL OR P.accion <> 'cancelacion')
      AND CAST(COALESCE(P.concepto_id, D.concepto) AS UNSIGNED) IN (${placeholders})
    GROUP BY UPPER(TRIM(D.matricula))
  `, [cycle, ...ids])

  const [paidResult, chargedResult] = await Promise.allSettled([paidQuery(), chargedQuery()])
  const failures: SourceFailure[] = []
  if (paidResult.status === 'rejected') failures.push(toFailure('financial.paid', paidResult.reason))
  if (chargedResult.status === 'rejected') failures.push(toFailure('financial.charged', chargedResult.reason))
  if (paidResult.status === 'rejected' && chargedResult.status === 'rejected') {
    const error: any = new Error('No se pudieron consultar las inscripciones financieras.')
    error.code = 'FINANCIAL_QUERIES_FAILED'
    error.failures = failures
    throw error
  }
  const paid = paidResult.status === 'fulfilled' ? paidResult.value : []
  const charged = chargedResult.status === 'fulfilled' ? chargedResult.value : []
  const rows = [...paid, ...charged].map((row: any) => ({
    matricula: normalizeMatricula(row.matricula),
    nombreCompleto: clean(row.nombreCompleto, 255),
    plantel: clean(row.plantel, 40).toUpperCase(),
    curp: clean(row.curp, 18).toUpperCase(),
    conceptId: Number(row.conceptId || 0),
    photoAvailable: false,
    source: 'mysql' as const
  }))

  return {
    students: mergeStudents(rows),
    source: 'mysql',
    reachable: true,
    partial: failures.length > 0,
    requestedPlanteles: [],
    successfulPlanteles: [],
    emptyPlanteles: [],
    failedPlanteles: [],
    failures,
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
    const timeout = setTimeout(() => controller.abort(), Math.min(10000, auroraTimeoutMs()))
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
        status: payload?.status || 'ok',
        configurationCorrections: plantelConfig.corrections
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
