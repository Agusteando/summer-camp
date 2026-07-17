import { ageGroupFor, normalizeProgram } from '../../shared/catalog'
import type { CampusName, StudentContact, StudentSchedule, StudentServices } from '../../types/summer'

type SheetStudent = {
  id: string
  folio: string
  name: string
  age: number | null
  modality: string
  studentType: string
  plantel: string
  plantelLabel: string
  campus: CampusName
  services: StudentServices
  schedule: StudentSchedule
  contacts: { primary: StudentContact; alternate: StudentContact }
  allergies: string
  observations: string
  source: { sheet: string; row: number }
}

type SheetSummary = {
  plantel: string
  label: string
  campus: CampusName
  total: number
  breakfast: number
  lunch: number
  dinner: number
  extendedTime: number
  huskyDreamers: number
  footballClinic: number
}

type SheetEnvelope = {
  ok: boolean
  version: number
  generatedAt: string
  revision: string
  spreadsheet: { id: string; name: string; timezone: string }
  students: SheetStudent[]
  summaries: SheetSummary[]
  meta: { cache?: string; warningCount?: number; warnings?: unknown[] }
  error?: { name?: string; message?: string; stack?: string | null }
}

export type SourceStudent = SheetStudent & {
  ageGroup: string
  program: ReturnType<typeof normalizeProgram>
}

export type SheetSource = {
  generatedAt: string
  revision: string
  spreadsheetName: string
  warningCount: number
  students: SourceStudent[]
}

type SourceCache = {
  value: SheetSource | null
  storedAt: number
  inFlight: Promise<SheetSource> | null
  lastError: string | null
}

const globalCache = globalThis as typeof globalThis & { __summerSheetSource?: SourceCache }
const cache = () => globalCache.__summerSheetSource ||= { value: null, storedAt: 0, inFlight: null, lastError: null }

const required = (value: unknown, name: string) => {
  const clean = String(value || '').trim()
  if (!clean) throw createError({ statusCode: 503, message: `${name} no está configurado.` })
  return clean
}

const asText = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max)
const asBoolean = (value: unknown) => value === true
const asNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const asCampus = (value: unknown): CampusName => value === 'Toluca' ? 'Toluca' : 'Metepec'

const normalizeContact = (value: any): StudentContact => ({
  name: asText(value?.name, 300),
  relation: asText(value?.relation, 120),
  phone: asText(value?.phone, 80)
})

const normalizeStudent = (value: any): SourceStudent => {
  const id = asText(value?.id, 120)
  const name = asText(value?.name, 400)
  const plantel = asText(value?.plantel, 20).toUpperCase()
  if (!id || !name || !plantel) throw new Error('Apps Script devolvió un alumno sin id, nombre o plantel.')

  const age = value?.age === null || value?.age === '' || value?.age === undefined
    ? null
    : Number.isFinite(Number(value.age)) ? Number(value.age) : null
  const modality = asText(value?.modality, 160)

  return {
    id,
    folio: asText(value?.folio, 80),
    name,
    age,
    ageGroup: ageGroupFor(age),
    modality,
    program: normalizeProgram(modality),
    studentType: asText(value?.studentType, 100),
    plantel,
    plantelLabel: asText(value?.plantelLabel, 120) || plantel,
    campus: asCampus(value?.campus),
    services: {
      breakfast: asBoolean(value?.services?.breakfast),
      lunch: asBoolean(value?.services?.lunch),
      dinner: asBoolean(value?.services?.dinner),
      extendedTime: asBoolean(value?.services?.extendedTime)
    },
    schedule: {
      entry: asText(value?.schedule?.entry, 30),
      exit: asText(value?.schedule?.exit, 30)
    },
    contacts: {
      primary: normalizeContact(value?.contacts?.primary),
      alternate: normalizeContact(value?.contacts?.alternate)
    },
    allergies: asText(value?.allergies, 3000),
    observations: asText(value?.observations, 3000),
    source: {
      sheet: asText(value?.source?.sheet, 40) || plantel,
      row: Math.max(1, Math.floor(asNumber(value?.source?.row)))
    }
  }
}

const fetchSheetSource = async (): Promise<SheetSource> => {
  const config = useRuntimeConfig()
  const baseUrl = required(config.summerSheetsApiUrl, 'SUMMER_SHEETS_API_URL')
  const key = required(config.summerSheetsApiKey, 'SUMMER_SHEETS_API_KEY')
  const timeoutMs = Math.max(3000, Number(config.summerSheetsTimeoutMs || 20000))
  const url = new URL(baseUrl)
  url.searchParams.set('action', 'snapshot')
  url.searchParams.set('key', key)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    })
    const bodyText = await response.text()
    let body: SheetEnvelope
    try {
      body = JSON.parse(bodyText) as SheetEnvelope
    } catch {
      throw new Error(`Apps Script respondió ${response.status} con contenido no JSON.`)
    }
    if (!response.ok) throw new Error(`Apps Script respondió HTTP ${response.status}.`)
    if (!body?.ok) throw new Error(body?.error?.message || 'Apps Script indicó que la lectura falló.')
    if (!Array.isArray(body.students)) throw new Error('Apps Script no devolvió students[].')
    if (!body.generatedAt || !body.revision) throw new Error('Apps Script no devolvió generatedAt o revision.')

    const students = body.students.map(normalizeStudent)
    const unique = new Set<string>()
    students.forEach((student) => {
      if (unique.has(student.id)) throw new Error(`Apps Script devolvió el id duplicado ${student.id}.`)
      unique.add(student.id)
    })

    return {
      generatedAt: body.generatedAt,
      revision: body.revision,
      spreadsheetName: asText(body.spreadsheet?.name, 200) || 'Google Sheets',
      warningCount: Math.max(0, Math.floor(asNumber(body.meta?.warningCount))),
      students
    }
  } catch (cause: any) {
    if (cause?.name === 'AbortError') throw new Error(`Apps Script excedió ${timeoutMs} ms.`)
    throw cause
  } finally {
    clearTimeout(timer)
  }
}

export const readSheetSource = async (options: { force?: boolean } = {}) => {
  const state = cache()
  const config = useRuntimeConfig()
  const freshMs = Math.max(5000, Number(config.summerSheetsCacheMs || 60000))
  const staleMs = Math.max(freshMs, Number(config.summerSheetsStaleMs || 900000))
  const ageMs = state.value ? Date.now() - state.storedAt : Number.POSITIVE_INFINITY

  if (!options.force && state.value && ageMs < freshMs) {
    return { source: state.value, cacheState: 'fresh' as const, ageMs }
  }

  if (state.inFlight) {
    const source = await state.inFlight
    return { source, cacheState: 'fresh' as const, ageMs: Date.now() - state.storedAt }
  }

  const hadCachedValue = Boolean(state.value)
  state.inFlight = fetchSheetSource()
  try {
    const source = await state.inFlight
    state.value = source
    state.storedAt = Date.now()
    state.lastError = null
    return { source, cacheState: hadCachedValue ? 'refreshed' as const : 'miss' as const, ageMs: 0 }
  } catch (cause: any) {
    state.lastError = asText(cause?.message || cause, 1000)
    if (state.value && ageMs < staleMs) {
      return { source: state.value, cacheState: 'stale' as const, ageMs }
    }
    throw createError({ statusCode: 502, message: state.lastError || 'No se pudo leer Google Sheets.' })
  } finally {
    state.inFlight = null
  }
}

export const sheetSourceHealth = async () => {
  const started = Date.now()
  try {
    const result = await readSheetSource()
    return {
      reachable: true,
      latencyMs: Date.now() - started,
      cacheState: result.cacheState,
      ageMs: result.ageMs,
      generatedAt: result.source.generatedAt,
      students: result.source.students.length,
      revision: result.source.revision
    }
  } catch (cause: any) {
    return {
      reachable: false,
      latencyMs: Date.now() - started,
      error: asText(cause?.message || cause, 1000)
    }
  }
}
