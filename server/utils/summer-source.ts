import { financialQuery } from './db'
import { demoStudents } from './demo'

export type SourceStudent = {
  matricula: string
  nombreCompleto: string
  plantel: string
  curp: string
  conceptId: number
  photoAvailable: boolean
  source: 'aurora' | 'mysql' | 'demo'
}

type SourceResult = {
  students: SourceStudent[]
  source: string
  reachable: boolean
  partial: boolean
  failedPlanteles: string[]
}

const clean = (value: unknown, max = 255) => String(value || '').trim().slice(0, max)
const normalizeMatricula = (value: unknown) => clean(value, 64).toUpperCase().replace(/\s+/g, '')
const conceptIds = () => String(useRuntimeConfig().summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite)
const planteles = () => String(useRuntimeConfig().summerPlanteles || '').split(',').map((item) => clean(item, 40).toUpperCase()).filter(Boolean)
const isDemo = () => String(useRuntimeConfig().demoMode || '').toLowerCase() === 'true'

const preferredConcept = (left: number, right: number) => Math.max(Number(left || 0), Number(right || 0))

const mergeStudents = (rows: SourceStudent[]) => {
  const map = new Map<string, SourceStudent>()
  for (const row of rows) {
    const matricula = normalizeMatricula(row.matricula)
    if (!matricula) continue
    const current = map.get(matricula)
    if (!current) {
      map.set(matricula, { ...row, matricula, nombreCompleto: clean(row.nombreCompleto, 255), plantel: clean(row.plantel, 40).toUpperCase(), curp: clean(row.curp, 18).toUpperCase() })
      continue
    }
    const conceptId = preferredConcept(current.conceptId, row.conceptId)
    map.set(matricula, {
      ...current,
      nombreCompleto: current.nombreCompleto || row.nombreCompleto,
      plantel: current.plantel || row.plantel,
      curp: current.curp || row.curp,
      conceptId,
      photoAvailable: current.photoAvailable || row.photoAvailable
    })
  }
  return Array.from(map.values()).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'))
}

const fetchAuroraPlantel = async (plantel: string): Promise<SourceStudent[]> => {
  const config = useRuntimeConfig()
  const base = clean(config.auroraBaseUrl, 500).replace(/\/+$/, '')
  const token = clean(config.auroraApiToken, 500)
  if (!base || !token) throw new Error('Aurora no está configurada')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(config.auroraTimeoutMs || 12000))
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
    if (!response.ok) throw new Error(`Aurora respondió ${response.status}`)
    const payload: any = await response.json()
    return (Array.isArray(payload?.data) ? payload.data : []).map((student: any) => ({
      matricula: normalizeMatricula(student.matricula),
      nombreCompleto: clean(student.nombreCompleto || student.fullName || student.name, 255),
      plantel: clean(student.plantel || plantel, 40).toUpperCase(),
      curp: clean(student.curp, 18).toUpperCase(),
      conceptId: Number(student.conceptId || student.conceptoId || 0),
      photoAvailable: Boolean(student.photoAvailable || student.foto),
      source: 'aurora' as const
    }))
  } finally {
    clearTimeout(timeout)
  }
}

const fetchFromAurora = async (): Promise<SourceResult> => {
  const settled = await Promise.allSettled(planteles().map(async (plantel) => ({ plantel, rows: await fetchAuroraPlantel(plantel) })))
  const rows: SourceStudent[] = []
  const failedPlanteles: string[] = []
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') rows.push(...result.value.rows)
    else failedPlanteles.push(planteles()[index])
  })
  if (!rows.length && failedPlanteles.length) throw new Error('Aurora no respondió para ningún plantel')
  return { students: mergeStudents(rows), source: 'aurora', reachable: failedPlanteles.length < settled.length, partial: failedPlanteles.length > 0, failedPlanteles }
}

const fetchFromMysql = async (): Promise<SourceResult> => {
  const ids = conceptIds()
  if (!ids.length) throw new Error('No hay conceptos configurados')
  const placeholders = ids.map(() => '?').join(',')
  const cycle = String(useRuntimeConfig().summerCycle || '2026')

  const paid = await financialQuery<any[]>(`
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
  `, [cycle, ...ids]).catch(() => [])

  const charged = await financialQuery<any[]>(`
    SELECT
      UPPER(TRIM(D.matricula)) AS matricula,
      MAX(TRIM(COALESCE(B.nombreCompleto, ''))) AS nombreCompleto,
      MAX(UPPER(TRIM(COALESCE(D.plantel, B.plantel, '')))) AS plantel,
      MAX(TRIM(COALESCE(B.curp, ''))) AS curp,
      MAX(CAST(COALESCE(P.concepto_id, D.concepto) AS UNSIGNED)) AS conceptId
    FROM documentos D
    LEFT JOIN documento_concepto_periodos P ON P.documento = D.documento AND P.estatus = 'Activo'
    LEFT JOIN base B ON B.matricula = D.matricula
    WHERE D.estatus = 'Activo'
      AND D.ciclo = ?
      AND CAST(COALESCE(P.concepto_id, D.concepto) AS UNSIGNED) IN (${placeholders})
    GROUP BY UPPER(TRIM(D.matricula))
  `, [cycle, ...ids]).catch(() => [])

  const rows = [...paid, ...charged].map((row: any) => ({
    matricula: normalizeMatricula(row.matricula),
    nombreCompleto: clean(row.nombreCompleto, 255),
    plantel: clean(row.plantel, 40).toUpperCase(),
    curp: clean(row.curp, 18).toUpperCase(),
    conceptId: Number(row.conceptId || 0),
    photoAvailable: false,
    source: 'mysql' as const
  }))
  return { students: mergeStudents(rows), source: 'mysql', reachable: true, partial: false, failedPlanteles: [] }
}

export const loadSummerSource = async (): Promise<SourceResult> => {
  if (isDemo()) return { students: demoStudents(), source: 'demo', reachable: true, partial: false, failedPlanteles: [] }
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
    const timeout = setTimeout(() => controller.abort(), Math.min(7000, Number(config.auroraTimeoutMs || 12000)))
    try {
      const response = await fetch(`${base}/api/external/v1/summer/health`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
    } finally { clearTimeout(timeout) }
    return { reachable: true, source: 'aurora', latencyMs: Date.now() - started }
  } catch {
    return { reachable: false, source: String(useRuntimeConfig().summerSourceMode || 'aurora'), latencyMs: Date.now() - started }
  }
}
