import { createHash } from 'node:crypto'
import { PLANTEL_ORDER, campusForPlantel } from '~/shared/catalog'

const clean = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max)
const normalizeMatricula = (value: unknown) => clean(value, 64).toUpperCase().replace(/\s+/g, '')
const maskMatricula = (value: unknown) => {
  const matricula = normalizeMatricula(value)
  if (!matricula) return null
  return matricula.length <= 4 ? `***${matricula}` : `${matricula.slice(0, 2)}***${matricula.slice(-4)}`
}
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  return Number.isFinite(Number(value)) ? Number(value) : null
}

const discoverArrays = (value: unknown, path = '$', depth = 0, output: Array<{ path: string; length: number }> = []) => {
  if (output.length >= 30 || depth > 3 || value === null || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    output.push({ path, length: value.length })
    return output
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (output.length >= 30) break
    discoverArrays(nested, `${path}.${key}`, depth + 1, output)
  }
  return output
}

const rowKeys = (rows: any[]) => Array.from(new Set(rows.flatMap((row) => row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : []))).sort()

const analyzeRows = (rows: any[], requestedPlantel: string, concepts: number[]) => {
  const matriculaCounts = new Map<string, number>()
  const byConcept: Record<string, number> = {}
  const byReportedPlantel: Record<string, number> = {}
  const invalidRows: Array<Record<string, unknown>> = []
  const outsideConceptRows: Array<Record<string, unknown>> = []
  const plantelMismatchRows: Array<Record<string, unknown>> = []
  let missingMatricula = 0
  let missingName = 0
  let missingPlantel = 0
  let missingCurp = 0
  let configuredConceptRows = 0
  const identityRecords: Array<{ hash: string; masked: string | null; requestedPlantel: string; reportedPlantel: string | null; conceptId: number | null }> = []

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      invalidRows.push({ index, type: Array.isArray(row) ? 'array' : typeof row, preview: clean(JSON.stringify(row), 300) })
      return
    }
    const matricula = normalizeMatricula(row.matricula)
    const conceptId = numberOrNull(row.conceptId ?? row.conceptoId ?? row.concepto_id ?? row.concepto)
    const reportedPlantel = clean(row.plantel, 40).toUpperCase()
    const name = clean(row.nombreCompleto ?? row.fullName ?? row.name, 255)
    const curp = clean(row.curp, 18).toUpperCase()

    if (!matricula) missingMatricula += 1
    else {
      matriculaCounts.set(matricula, (matriculaCounts.get(matricula) || 0) + 1)
      identityRecords.push({
        hash: createHash('sha256').update(matricula).digest('hex').slice(0, 16),
        masked: maskMatricula(matricula),
        requestedPlantel,
        reportedPlantel: reportedPlantel || null,
        conceptId
      })
    }
    if (!name) missingName += 1
    if (!reportedPlantel) missingPlantel += 1
    if (!curp) missingCurp += 1

    const conceptKey = conceptId === null ? 'null' : String(conceptId)
    byConcept[conceptKey] = (byConcept[conceptKey] || 0) + 1
    if (conceptId !== null && concepts.includes(conceptId)) configuredConceptRows += 1
    else if (outsideConceptRows.length < 12) outsideConceptRows.push({ index, matricula: maskMatricula(matricula), conceptRaw: row.conceptId ?? row.conceptoId ?? row.concepto_id ?? row.concepto ?? null, conceptParsed: conceptId })

    const plantelKey = reportedPlantel || '(vacío)'
    byReportedPlantel[plantelKey] = (byReportedPlantel[plantelKey] || 0) + 1
    if (reportedPlantel && reportedPlantel !== requestedPlantel && plantelMismatchRows.length < 12) {
      plantelMismatchRows.push({ index, matricula: maskMatricula(matricula), requestedPlantel, reportedPlantel })
    }
  })

  const duplicates = Array.from(matriculaCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])

  return {
    rawRows: rows.length,
    objectRows: rows.length - invalidRows.length,
    distinctMatriculas: matriculaCounts.size,
    configuredConceptRows,
    rowsOutsideConfiguredConcepts: rows.length - configuredConceptRows,
    byConcept,
    byReportedPlantel,
    missing: { matricula: missingMatricula, name: missingName, plantel: missingPlantel, curp: missingCurp },
    duplicates: { matriculas: duplicates.length, extraRows: duplicates.reduce((sum, [, count]) => sum + count - 1, 0), sample: duplicates.slice(0, 12).map(([matricula, count]) => ({ matricula: maskMatricula(matricula), count })) },
    plantelMismatch: { count: plantelMismatchRows.length, sample: plantelMismatchRows },
    invalidRows: { count: invalidRows.length, sample: invalidRows.slice(0, 12) },
    outsideConfiguredConcepts: { count: rows.length - configuredConceptRows, sample: outsideConceptRows },
    fieldsObserved: rowKeys(rows),
    _identityRecords: identityRecords,
    sampleRows: rows.slice(0, 5).map((row, index) => ({
      index,
      keys: row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row).sort() : [],
      matricula: maskMatricula(row?.matricula),
      namePresent: Boolean(clean(row?.nombreCompleto ?? row?.fullName ?? row?.name, 255)),
      plantel: clean(row?.plantel, 40).toUpperCase() || null,
      conceptRaw: row?.conceptId ?? row?.conceptoId ?? row?.concepto_id ?? row?.concepto ?? null,
      conceptParsed: numberOrNull(row?.conceptId ?? row?.conceptoId ?? row?.concepto_id ?? row?.concepto),
      curpPresent: Boolean(clean(row?.curp, 18)),
      photoAvailable: Boolean(row?.photoAvailable ?? row?.foto)
    }))
  }
}

export type AuroraPlantelProbe = Awaited<ReturnType<typeof probeAuroraPlantel>>

const probeAuroraPlantel = async (options: {
  baseUrl: string
  token: string
  plantel: string
  year: string
  cycle: string
  concepts: number[]
  timeoutMs: number
}) => {
  const { baseUrl, token, plantel, year, cycle, concepts, timeoutMs } = options
  const started = Date.now()
  let requestUrl = ''
  try {
    const url = new URL('/api/external/v1/summer/students', baseUrl)
    url.searchParams.set('plantel', plantel)
    url.searchParams.set('year', year)
    url.searchParams.set('cycle', cycle)
    url.searchParams.set('concepts', concepts.join(','))
    url.searchParams.set('_dx', String(Date.now()))
    requestUrl = url.toString()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        signal: controller.signal
      })
    } finally {
      clearTimeout(timer)
    }

    const body = await response.text()
    let parsed: any = null
    let parseError: string | null = null
    try { parsed = body ? JSON.parse(body) : null } catch (cause: any) { parseError = clean(cause?.message || cause, 1000) }
    const dataIsArray = Array.isArray(parsed?.data)
    const rows = dataIsArray ? parsed.data : []
    const analysis = analyzeRows(rows, plantel, concepts)
    const arraysDiscovered = discoverArrays(parsed)
    const meta = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta) ? parsed.meta : null

    return {
      plantel,
      campus: campusForPlantel(plantel),
      request: { method: 'GET', url: requestUrl, year, cycle, concepts, timeoutMs },
      transport: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        latencyMs: Date.now() - started,
        contentType: response.headers.get('content-type'),
        contentLengthHeader: response.headers.get('content-length'),
        cacheControl: response.headers.get('cache-control'),
        serverHeader: response.headers.get('server'),
        poweredByHeader: response.headers.get('x-powered-by'),
        responseDate: response.headers.get('date'),
        requestIdHeader: response.headers.get('x-request-id') || response.headers.get('x-vercel-id'),
        bodyCharacters: body.length,
        bodySha256: createHash('sha256').update(body).digest('hex').slice(0, 16),
        bodyPreview: !response.ok || parseError || (dataIsArray && rows.length === 0) || arraysDiscovered.every((entry) => entry.length === 0)
          ? clean(body, 2500) || null
          : '[JSON con arreglos no vacíos omitido para no copiar datos personales; se reportan estructura, conteos y muestras enmascaradas.]'
      },
      contract: {
        jsonParsed: parseError === null,
        parseError,
        topLevelType: parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed,
        topLevelKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).sort() : [],
        arraysDiscovered,
        dataIsArray,
        dataLength: rows.length,
        meta,
        metaTotal: numberOrNull(meta?.total),
        metaPlantel: clean(meta?.plantel, 40).toUpperCase() || null,
        metaCycle: clean(meta?.cycle, 40) || null,
        metaConcepts: Array.isArray(meta?.concepts) ? meta.concepts : null,
        metaTotalMatchesData: numberOrNull(meta?.total) === null ? null : Number(meta.total) === rows.length,
        metaPlantelMatchesRequest: clean(meta?.plantel, 40).toUpperCase() ? clean(meta?.plantel, 40).toUpperCase() === plantel : null,
        metaCycleMatchesRequest: clean(meta?.cycle, 40) ? clean(meta?.cycle, 40) === cycle : null,
        metaConceptsMatchRequest: Array.isArray(meta?.concepts) ? concepts.every((concept) => meta.concepts.map(Number).includes(concept)) : null
      },
      analysis,
      verdict: !response.ok
        ? 'http_error'
        : parseError
          ? 'invalid_json'
          : !dataIsArray
            ? 'contract_mismatch'
            : rows.length === 0
              ? 'valid_empty_result'
              : analysis.configuredConceptRows === 0
                ? 'rows_without_configured_concepts'
                : 'students_found'
    }
  } catch (cause: any) {
    return {
      plantel,
      campus: campusForPlantel(plantel),
      request: { method: 'GET', url: requestUrl || null, year, cycle, concepts, timeoutMs },
      transport: {
        ok: false,
        status: null,
        statusText: null,
        latencyMs: Date.now() - started,
        contentType: null,
        contentLengthHeader: null,
        cacheControl: null,
        bodyCharacters: 0,
        bodyPreview: null
      },
      contract: null,
      analysis: null,
      error: {
        name: clean(cause?.name || 'Error', 200),
        message: clean(cause?.message || cause || 'Error desconocido', 4000),
        code: clean(cause?.code, 200) || null,
        cause: clean(cause?.cause?.message || cause?.cause, 2000) || null,
        stack: clean(cause?.stack, 12000) || null
      },
      verdict: cause?.name === 'AbortError' ? 'timeout' : 'network_error'
    }
  }
}


const probeAuroraServerDiagnostics = async (options: {
  baseUrl: string
  token: string
  plantel: string
  year: string
  cycle: string
  concepts: number[]
  timeoutMs: number
}) => {
  const { baseUrl, token, plantel, year, cycle, concepts, timeoutMs } = options
  const started = Date.now()
  const url = new URL('/api/external/v1/summer/diagnostics', baseUrl)
  url.searchParams.set('plantel', plantel)
  url.searchParams.set('year', year)
  url.searchParams.set('cycle', cycle)
  url.searchParams.set('concepts', concepts.join(','))
  url.searchParams.set('_dx', String(Date.now()))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
      signal: controller.signal
    })
    const body = await response.text()
    let parsed: any = null
    let parseError: string | null = null
    try { parsed = body ? JSON.parse(body) : null } catch (cause: any) { parseError = clean(cause?.message || cause, 1000) }
    return {
      plantel,
      request: { method: 'GET', url: url.toString(), timeoutMs },
      transport: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        latencyMs: Date.now() - started,
        contentType: response.headers.get('content-type'),
        diagnosticVersionHeader: response.headers.get('x-aurora-summer-diagnostics-version'),
        bodyCharacters: body.length
      },
      available: response.status !== 404,
      parsed: parseError === null,
      parseError,
      payload: parsed && typeof parsed === 'object' ? parsed : null,
      bodyPreview: !response.ok || parseError ? clean(body, 12000) || null : null
    }
  } catch (cause: any) {
    return {
      plantel,
      request: { method: 'GET', url: url.toString(), timeoutMs },
      transport: { ok: false, status: null, statusText: null, latencyMs: Date.now() - started, contentType: null, diagnosticVersionHeader: null, bodyCharacters: 0 },
      available: null,
      parsed: false,
      parseError: null,
      payload: null,
      bodyPreview: null,
      error: {
        name: clean(cause?.name || 'Error', 200),
        message: clean(cause?.message || cause || 'Error desconocido', 4000),
        code: clean(cause?.code, 200) || null,
        cause: clean(cause?.cause?.message || cause?.cause, 2000) || null,
        stack: clean(cause?.stack, 12000) || null
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

export const diagnoseAuroraEnrollment = async () => {
  const config = useRuntimeConfig()
  const rawBaseUrl = clean(config.auroraBaseUrl, 1000).replace(/\/+$/, '')
  const token = clean(config.auroraApiToken, 2000)
  const year = clean(config.summerYear || '2026', 20)
  const cycle = clean(config.summerCycle || '2026', 40)
  const concepts = String(config.summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite)
  const configuredPlanteles = String(config.summerPlanteles || PLANTEL_ORDER.join(','))
    .split(',').map((value) => clean(value, 40).toUpperCase()).filter(Boolean)
  const timeoutMs = Math.max(1000, Number(config.auroraTimeoutMs || 12000))

  let parsedBase: URL | null = null
  let baseUrlError: string | null = null
  try { parsedBase = new URL(rawBaseUrl) } catch (cause: any) { baseUrlError = clean(cause?.message || cause, 1000) }

  const configuration = {
    sourceMode: clean(config.summerSourceMode || 'aurora', 40).toLowerCase(),
    baseUrlConfigured: Boolean(rawBaseUrl),
    baseUrlValid: Boolean(parsedBase),
    baseUrlError,
    baseUrl: parsedBase ? `${parsedBase.protocol}//${parsedBase.host}${parsedBase.pathname.replace(/\/$/, '')}` : rawBaseUrl || null,
    baseProtocol: parsedBase?.protocol || null,
    baseHost: parsedBase?.host || null,
    tokenConfigured: Boolean(token),
    tokenLength: token.length,
    tokenFingerprint: token ? createHash('sha256').update(token).digest('hex').slice(0, 12) : null,
    year,
    cycle,
    concepts,
    conceptsExactlyExpected: concepts.length === 3 && [986, 987, 988].every((id) => concepts.includes(id)),
    configuredPlanteles,
    configuredPlantelCount: configuredPlanteles.length,
    duplicatePlanteles: configuredPlanteles.filter((plantel, index) => configuredPlanteles.indexOf(plantel) !== index),
    unknownAgainstLocalCatalog: configuredPlanteles.filter((plantel) => !PLANTEL_ORDER.includes(plantel as any)),
    campusMapping: configuredPlanteles.reduce<Record<string, string>>((acc, plantel) => { acc[plantel] = campusForPlantel(plantel); return acc }, {}),
    timeoutMs
  }

  if (!parsedBase || !token || !configuredPlanteles.length || !concepts.length) {
    return {
      configuration,
      probes: [],
      aggregate: null,
      findings: [{ severity: 'error', code: 'AURORA_CONFIGURATION_INCOMPLETE', message: 'No se pueden probar planteles porque la URL, el token, los conceptos o los planteles no están completos.' }]
    }
  }

  const probesWithPrivateIdentity = await Promise.all(configuredPlanteles.map((plantel) => probeAuroraPlantel({ baseUrl: rawBaseUrl, token, plantel, year, cycle, concepts, timeoutMs })))
  const serverDiagnostics = await Promise.all(configuredPlanteles.map((plantel) => probeAuroraServerDiagnostics({ baseUrl: rawBaseUrl, token, plantel, year, cycle, concepts, timeoutMs: Math.max(timeoutMs, 20000) })))
  const identityMap = new Map<string, { masked: string | null; planteles: Set<string>; reportedPlanteles: Set<string>; concepts: Set<number> }>()
  const byConcept: Record<string, number> = {}
  const byRequestedPlantel: Record<string, number> = {}
  let totalRawRows = 0
  let totalConfiguredConceptRows = 0

  for (const probe of probesWithPrivateIdentity) {
    const analysis: any = probe.analysis
    if (!analysis) continue
    totalRawRows += Number(analysis.rawRows || 0)
    totalConfiguredConceptRows += Number(analysis.configuredConceptRows || 0)
    byRequestedPlantel[probe.plantel] = Number(analysis.rawRows || 0)
    for (const [concept, count] of Object.entries(analysis.byConcept || {})) byConcept[concept] = (byConcept[concept] || 0) + Number(count)
    for (const identity of analysis._identityRecords || []) {
      const current = identityMap.get(identity.hash) || { masked: identity.masked, planteles: new Set<string>(), reportedPlanteles: new Set<string>(), concepts: new Set<number>() }
      current.planteles.add(identity.requestedPlantel)
      if (identity.reportedPlantel) current.reportedPlanteles.add(identity.reportedPlantel)
      if (Number.isFinite(identity.conceptId)) current.concepts.add(Number(identity.conceptId))
      identityMap.set(identity.hash, current)
    }
  }

  const crossPlantelDuplicates = Array.from(identityMap.values())
    .filter((identity) => identity.planteles.size > 1 || identity.reportedPlanteles.size > 1)
    .map((identity) => ({ matricula: identity.masked, requestedPlanteles: Array.from(identity.planteles).sort(), reportedPlanteles: Array.from(identity.reportedPlanteles).sort(), concepts: Array.from(identity.concepts).sort() }))
  const multiConceptMatriculas = Array.from(identityMap.values())
    .filter((identity) => identity.concepts.size > 1)
    .map((identity) => ({ matricula: identity.masked, concepts: Array.from(identity.concepts).sort(), planteles: Array.from(identity.planteles).sort() }))

  const probes = probesWithPrivateIdentity.map((probe: any) => {
    if (!probe.analysis) return probe
    const { _identityRecords, ...analysis } = probe.analysis
    return { ...probe, analysis }
  })
  const verdictCounts = probes.reduce<Record<string, number>>((acc, probe) => { acc[probe.verdict] = (acc[probe.verdict] || 0) + 1; return acc }, {})
  const httpSuccesses = probes.filter((probe) => probe.transport.ok).length
  const contractSuccesses = probes.filter((probe) => probe.contract?.dataIsArray).length
  const nonEmptyPlanteles = probes.filter((probe) => Number(probe.contract?.dataLength || 0) > 0).map((probe) => probe.plantel)
  const emptyPlanteles = probes.filter((probe) => probe.verdict === 'valid_empty_result').map((probe) => probe.plantel)
  const failedPlanteles = probes.filter((probe) => !probe.transport.ok || !probe.contract?.dataIsArray).map((probe) => probe.plantel)
  const studentEndpointBranchFailures = probes.flatMap((probe: any) => {
    const paid = probe.contract?.meta?.queryDiagnostics?.paid
    const charged = probe.contract?.meta?.queryDiagnostics?.charged
    return [paid, charged]
      .filter((branch) => branch && branch.ok === false)
      .map((branch) => ({ plantel: probe.plantel, branch: branch.key, rowCount: branch.rowCount ?? 0, latencyMs: branch.latencyMs ?? null, error: branch.error || null, source: 'students.meta.queryDiagnostics' }))
  })

  const serverDiagnosticsAvailable = serverDiagnostics.filter((probe) => probe.available === true).length
  const serverDiagnosticsMissing = serverDiagnostics.filter((probe) => probe.transport.status === 404).map((probe) => probe.plantel)
  const serverDiagnosticsUnauthorized = serverDiagnostics.filter((probe) => probe.transport.status === 401 || probe.transport.status === 403).map((probe) => probe.plantel)
  const serverDiagnosticsTransportFailures = serverDiagnostics
    .filter((probe) => !probe.transport.ok)
    .map((probe) => ({ plantel: probe.plantel, status: probe.transport.status, statusText: probe.transport.statusText, error: probe.error || null, bodyPreview: probe.bodyPreview || null }))
  const serverDiagnosticBranchFailures = serverDiagnostics.flatMap((probe) => {
    const paid = probe.payload?.queryDiagnostics?.paid
    const charged = probe.payload?.queryDiagnostics?.charged
    return [paid, charged]
      .filter((branch) => branch && branch.ok === false)
      .map((branch) => ({ plantel: probe.plantel, branch: branch.key, rowCount: branch.rowCount ?? 0, latencyMs: branch.latencyMs ?? null, error: branch.error || null }))
  })
  const serverDiagnosticConclusions = serverDiagnostics.reduce<Record<string, number>>((acc, probe) => {
    const code = clean(probe.payload?.conclusion?.code || probe.payload?.boundary || (!probe.transport.ok ? `HTTP_${probe.transport.status ?? 'NETWORK'}` : 'UNKNOWN'), 160) || 'UNKNOWN'
    acc[code] = (acc[code] || 0) + 1
    return acc
  }, {})
  const serverDiagnosticCounts = serverDiagnostics.reduce((acc, probe) => {
    acc.paidRows += Number(probe.payload?.counts?.paidRows || probe.payload?.queryDiagnostics?.paid?.rowCount || 0)
    acc.chargedRows += Number(probe.payload?.counts?.chargedRows || probe.payload?.queryDiagnostics?.charged?.rowCount || 0)
    acc.rowsBeforeDeduplication += Number(probe.payload?.counts?.rowsBeforeDeduplication || 0)
    acc.distinctMatriculas += Number(probe.payload?.counts?.distinctMatriculas || 0)
    return acc
  }, { paidRows: 0, chargedRows: 0, rowsBeforeDeduplication: 0, distinctMatriculas: 0 })
  const allDeepDiagnosticsConfirmQueriesOkZero = serverDiagnosticsAvailable === configuredPlanteles.length && serverDiagnostics.every((probe) => probe.payload?.conclusion?.code === 'QUERIES_OK_ZERO_STUDENTS')

  const findings: Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string; evidence?: unknown }> = []
  const allExposedBranchFailures = [...serverDiagnosticBranchFailures, ...studentEndpointBranchFailures]
  if (allExposedBranchFailures.length) findings.push({
    severity: 'error',
    code: 'AURORA_FINANCIAL_QUERY_ERRORS_EXPOSED',
    message: 'Aurora confirmó errores en una o más ramas SQL de inscripción. Los errores exactos están en serverDiagnostics[].payload.queryDiagnostics o en probes[].contract.meta.queryDiagnostics.',
    evidence: allExposedBranchFailures
  })
  if (allDeepDiagnosticsConfirmQueriesOkZero) findings.push({
    severity: 'error',
    code: 'AURORA_QUERIES_OK_ZERO_STUDENTS',
    message: 'Aurora ejecutó correctamente paid y charged para todos los planteles, pero los filtros actuales produjeron cero matrículas. La falla está en las suposiciones de ciclo, estatus, tablas o resolución del concepto, no en red ni en Summer Camp.',
    evidence: { year, cycle, concepts, conclusions: serverDiagnosticConclusions, counts: serverDiagnosticCounts, serverDiagnostics }
  })
  if (httpSuccesses === probes.length && contractSuccesses === probes.length && totalRawRows === 0 && !allExposedBranchFailures.length && !allDeepDiagnosticsConfirmQueriesOkZero) {
    findings.push({
      severity: 'error',
      code: 'AURORA_ALL_PLANTELES_VALID_BUT_EMPTY',
      message: 'Todos los planteles respondieron HTTP correctamente y con data[], pero ninguno devolvió alumnos. La falla está antes de Summer Camp: criterios financieros, ciclo, conceptos, estatus, acceso Bridge o consultas de Aurora.',
      evidence: { emptyPlanteles, year, cycle, concepts }
    })
    if (serverDiagnosticsAvailable < configuredPlanteles.length) findings.push({
      severity: 'warning',
      code: 'AURORA_EMPTY_RESULT_NOT_FULLY_PROVEN',
      message: 'data: [] por sí solo no distingue cero inscritos de una consulta fallida. Faltan diagnósticos profundos de Aurora en uno o más planteles.',
      evidence: { availablePlanteles: serverDiagnosticsAvailable, expectedPlanteles: configuredPlanteles.length, missingPlanteles: serverDiagnosticsMissing, transportFailures: serverDiagnosticsTransportFailures }
    })
  }
  if (serverDiagnosticsUnauthorized.length) findings.push({
    severity: 'error',
    code: 'AURORA_DEEP_DIAGNOSTICS_UNAUTHORIZED',
    message: 'El endpoint profundo de Aurora rechazó el token en uno o más planteles.',
    evidence: { planteles: serverDiagnosticsUnauthorized }
  })
  if (serverDiagnosticsMissing.length === configuredPlanteles.length) findings.push({
    severity: 'warning',
    code: 'AURORA_DEEP_DIAGNOSTICS_NOT_DEPLOYED',
    message: 'Aurora aún no tiene desplegado /api/external/v1/summer/diagnostics. Se puede localizar el límite, pero no leer errores SQL ocultos por Aurora.',
    evidence: { missingPlanteles: serverDiagnosticsMissing }
  })
  if (serverDiagnosticsAvailable === configuredPlanteles.length && !serverDiagnosticBranchFailures.length) findings.push({
    severity: 'info',
    code: 'AURORA_DEEP_DIAGNOSTICS_AVAILABLE',
    message: 'Aurora expuso el estado de las ramas paid y charged para todos los planteles.'
  })
  if (httpSuccesses === 0) findings.push({ severity: 'error', code: 'AURORA_NO_HTTP_SUCCESS', message: 'Ningún plantel respondió correctamente. Revisar URL, token, red, timeout y despliegue de Aurora.', evidence: probes.map((probe) => ({ plantel: probe.plantel, verdict: probe.verdict, status: probe.transport.status, error: (probe as any).error?.message || null })) })
  if (contractSuccesses < httpSuccesses) findings.push({ severity: 'error', code: 'AURORA_RESPONSE_CONTRACT_MISMATCH', message: 'Al menos una respuesta HTTP correcta no contiene el arreglo data esperado. Revisar topLevelKeys y arraysDiscovered por plantel.' })
  if (totalRawRows > 0 && totalConfiguredConceptRows === 0) findings.push({ severity: 'error', code: 'AURORA_ROWS_WRONG_CONCEPTS', message: 'Aurora devolvió filas, pero ninguna pertenece a los conceptos configurados.', evidence: { byConcept, configuredConcepts: concepts } })
  if (nonEmptyPlanteles.length) findings.push({ severity: 'info', code: 'AURORA_STUDENTS_FOUND', message: `Aurora devolvió filas en ${nonEmptyPlanteles.length} plantel(es).`, evidence: { nonEmptyPlanteles, totalRawRows, byConcept } })
  if (failedPlanteles.length && nonEmptyPlanteles.length) findings.push({ severity: 'warning', code: 'AURORA_PARTIAL_RESULT', message: 'La fuente es parcial: hay planteles con alumnos y planteles que fallaron o rompieron el contrato.', evidence: { failedPlanteles, nonEmptyPlanteles } })

  return {
    configuration,
    probes,
    aggregate: {
      requestedPlanteles: probes.length,
      httpSuccesses,
      contractSuccesses,
      totalRawRows,
      totalConfiguredConceptRows,
      verdictCounts,
      nonEmptyPlanteles,
      emptyPlanteles,
      failedPlanteles,
      byRequestedPlantel,
      byConcept,
      distinctMatriculasAcrossPlanteles: identityMap.size,
      crossPlantelDuplicates: { count: crossPlantelDuplicates.length, sample: crossPlantelDuplicates.slice(0, 20) },
      multiConceptMatriculas: { count: multiConceptMatriculas.length, sample: multiConceptMatriculas.slice(0, 20) },
      deepDiagnostics: {
        availablePlanteles: serverDiagnosticsAvailable,
        missingPlanteles: serverDiagnosticsMissing,
        branchFailures: allExposedBranchFailures.length,
        studentEndpointBranchFailures,
        unauthorizedPlanteles: serverDiagnosticsUnauthorized,
        transportFailures: serverDiagnosticsTransportFailures,
        conclusions: serverDiagnosticConclusions,
        counts: serverDiagnosticCounts,
        allQueriesOkZeroStudents: allDeepDiagnosticsConfirmQueriesOkZero
      }
    },
    serverDiagnostics,
    findings
  }
}
