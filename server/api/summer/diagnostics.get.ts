import { SUMMER_BUILD_ID, SUMMER_DX_VERSION, SUMMER_SNAPSHOT_VERSION } from '../../utils/build'
import { appQuery } from '../../utils/db'
import { serializeDiagnosticError } from '../../utils/diagnostic-error'
import { diagnoseAuroraEnrollment } from '../../utils/summer-source-diagnostics'
import { loadSummerSource, testSourceHealth } from '../../utils/summer-source'
import { buildSnapshot, loadAttendance, loadOverrides } from '../../utils/summer-state'
import { isoDate } from '../../utils/validation'

const elapsed = (started: number) => Date.now() - started
const requestId = () => `diag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const countBy = <T>(rows: T[], key: (row: T) => string) => rows.reduce<Record<string, number>>((acc, row) => {
  const value = key(row) || '(vacío)'
  acc[value] = (acc[value] || 0) + 1
  return acc
}, {})
const maskMatricula = (value: unknown) => {
  const matricula = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return matricula ? `${matricula.slice(0, 2)}***${matricula.slice(-4)}` : null
}

type Check = {
  key: string
  label: string
  ok: boolean
  latencyMs: number
  details?: unknown
  error?: ReturnType<typeof serializeDiagnosticError> | Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  const config = useRuntimeConfig()
  if (String(config.public.diagnosticsEnabled) === 'false') {
    throw createError({ statusCode: 404, message: 'Diagnóstico deshabilitado.' })
  }

  const id = requestId()
  setResponseHeader(event, 'X-Summer-Build-Id', SUMMER_BUILD_ID)
  setResponseHeader(event, 'X-Summer-DX-Version', String(SUMMER_DX_VERSION))
  setResponseHeader(event, 'X-Summer-DX-Request-Id', id)
  const started = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const sourceMode = String(config.summerSourceMode || 'aurora').toLowerCase()
  const concepts = String(config.summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite)
  const planteles = String(config.summerPlanteles || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
  const checks: Check[] = []

  const run = async <T>(key: string, label: string, task: () => Promise<T>): Promise<T | null> => {
    const checkStarted = Date.now()
    try {
      const details = await task()
      checks.push({ key, label, ok: true, latencyMs: elapsed(checkStarted), details })
      return details
    } catch (cause: any) {
      checks.push({
        key,
        label,
        ok: false,
        latencyMs: elapsed(checkStarted),
        details: cause?.diagnostic || cause?.failures || undefined,
        error: serializeDiagnosticError(cause)
      })
      return null
    }
  }

  const runtime = {
    build: { id: SUMMER_BUILD_ID, dxVersion: SUMMER_DX_VERSION, snapshotVersion: SUMMER_SNAPSHOT_VERSION },
    node: process.version,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    region: process.env.VERCEL_REGION || null,
    deploymentUrlPresent: Boolean(process.env.VERCEL_URL),
    serverTime: new Date().toISOString(),
    requestHeaders: {
      host: getHeader(event, 'host') || null,
      userAgent: getHeader(event, 'user-agent') || null,
      forwardedProto: getHeader(event, 'x-forwarded-proto') || null,
      forwardedHost: getHeader(event, 'x-forwarded-host') || null,
      clientBuild: getHeader(event, 'x-summer-client-build') || null,
      clientDxVersion: getHeader(event, 'x-summer-client-dx-version') || null
    }
  }

  const auroraBaseUrl = String(config.auroraBaseUrl || '').trim().replace(/\/+$/, '')
  const safeEndpoint = (pathname: string) => {
    try { return new URL(pathname, auroraBaseUrl).toString() } catch { return null }
  }

  const configuration = {
    sourceMode,
    summerYear: Number(config.summerYear || 2026),
    cycle: String(config.summerCycle || '2026'),
    conceptIds: concepts,
    conceptsExactlyExpected: concepts.length === 3 && [986, 987, 988].every((idValue) => concepts.includes(idValue)),
    configuredPlanteles: planteles,
    configuredPlantelCount: planteles.length,
    auroraBaseUrlConfigured: Boolean(auroraBaseUrl),
    auroraOrigin: (() => { try { const url = new URL(auroraBaseUrl); return `${url.protocol}//${url.host}` } catch { return null } })(),
    auroraStudentsEndpoint: safeEndpoint('/api/external/v1/summer/students'),
    auroraDiagnosticsEndpoint: safeEndpoint('/api/external/v1/summer/diagnostics'),
    auroraHealthEndpoint: safeEndpoint('/api/external/v1/summer/health'),
    auroraApiTokenConfigured: Boolean(String(config.auroraApiToken || '').trim()),
    auroraTimeoutMs: Number(config.auroraTimeoutMs || 12000),
    appMysqlConfigured: Boolean(config.appMysqlHost && config.appMysqlUser && config.appMysqlDatabase),
    diagnosticsEnabled: true
  }

  const diagnosticState: {
    auroraInspection: Awaited<ReturnType<typeof diagnoseAuroraEnrollment>> | null
    sourceResult: Awaited<ReturnType<typeof loadSummerSource>> | null
    appConnectionOk: boolean
    sourceHealth: Awaited<ReturnType<typeof testSourceHealth>> | null
  } = { auroraInspection: null, sourceResult: null, appConnectionOk: false, sourceHealth: null }

  const auroraTask = sourceMode === 'aurora' || sourceMode === 'hybrid'
    ? run('aurora_exact_requests', 'Solicitudes exactas a Aurora por plantel', async () => await diagnoseAuroraEnrollment())
      .then((result) => { diagnosticState.auroraInspection = result })
    : Promise.resolve().then(() => {
      checks.push({
        key: 'aurora_exact_requests',
        label: 'Solicitudes exactas a Aurora por plantel',
        ok: true,
        latencyMs: 0,
        details: { skipped: true, reason: `SUMMER_SOURCE_MODE=${sourceMode}` }
      })
    })

  const healthTask = run('source_health', 'Health reportado por la fuente', async () => {
    diagnosticState.sourceHealth = await testSourceHealth()
    if (!diagnosticState.sourceHealth.reachable) {
      const error: any = new Error('El health de la fuente reporta que no es alcanzable.')
      error.code = 'SOURCE_HEALTH_UNREACHABLE'
      error.diagnostic = diagnosticState.sourceHealth
      throw error
    }
    return diagnosticState.sourceHealth
  })

  const sourceTask = run('source_loader', 'Resultado real de loadSummerSource()', async () => {
    diagnosticState.sourceResult = await loadSummerSource()
    const students = diagnosticState.sourceResult.students
    const byPlantel = countBy(students, (student) => student.plantel)
    const byConcept = countBy(students, (student) => String(student.conceptId))
    const bySource = countBy(students, (student) => student.source)
    const missing = {
      matricula: students.filter((student) => !student.matricula).length,
      name: students.filter((student) => !student.nombreCompleto).length,
      plantel: students.filter((student) => !student.plantel).length,
      curp: students.filter((student) => !student.curp).length
    }
    const outsideConcepts = students.filter((student) => !concepts.includes(Number(student.conceptId)))
    const duplicateCounts = new Map<string, number>()
    students.forEach((student) => duplicateCounts.set(student.matricula, (duplicateCounts.get(student.matricula) || 0) + 1))
    const duplicates = Array.from(duplicateCounts.entries()).filter(([, count]) => count > 1)
    const details = {
      source: diagnosticState.sourceResult.source,
      sourceReachable: diagnosticState.sourceResult.reachable,
      partial: diagnosticState.sourceResult.partial,
      failedPlanteles: diagnosticState.sourceResult.failedPlanteles,
      failures: diagnosticState.sourceResult.failures,
      totalAfterNormalizationAndDeduplication: students.length,
      byPlantel,
      byConcept,
      bySource,
      missing,
      rowsOutsideConfiguredConcepts: outsideConcepts.length,
      outsideConceptSamples: outsideConcepts.slice(0, 10).map((student) => ({ matricula: maskMatricula(student.matricula), conceptId: student.conceptId, plantel: student.plantel })),
      duplicateMatriculasAfterMerge: duplicates.length,
      samples: students.slice(0, 8).map((student) => ({
        matricula: maskMatricula(student.matricula),
        namePresent: Boolean(student.nombreCompleto),
        plantel: student.plantel,
        conceptId: student.conceptId,
        curpPresent: Boolean(student.curp),
        photoAvailable: student.photoAvailable,
        source: student.source
      }))
    }
    if (!students.length) {
      const error: any = new Error('loadSummerSource() terminó correctamente, pero produjo cero alumnos después de leer, normalizar y deduplicar la fuente.')
      error.code = 'SUMMER_SOURCE_LOADER_EMPTY'
      error.diagnostic = details
      throw error
    }
    return details
  })

  const appTask = run('app_connection', 'Conexión de lectura a MySQL de Summer Camp', async () => {
    const rows = await appQuery<any[]>('SELECT DATABASE() AS databaseName, NOW() AS serverTime')
    diagnosticState.appConnectionOk = true
    return { databaseName: rows?.[0]?.databaseName || null, serverTime: rows?.[0]?.serverTime || null }
  })

  await Promise.all([auroraTask, healthTask, sourceTask, appTask])

  const resolvedSource = diagnosticState.sourceResult
  const sourceStudents = resolvedSource?.students || []
  const matriculas = sourceStudents.map((student) => student.matricula)

  if (matriculas.length && diagnosticState.appConnectionOk) {
    await run('overrides_read', 'Lectura de modalidad, alimento y edad', async () => {
      const rows = await loadOverrides(matriculas)
      return {
        requestedMatriculas: matriculas.length,
        matchedOverrides: rows.size,
        unmatchedStudents: matriculas.length - rows.size,
        matchPercent: matriculas.length ? Math.round((rows.size / matriculas.length) * 1000) / 10 : 0
      }
    })

    await run('attendance_read', 'Lectura de asistencia para la fecha seleccionada', async () => {
      const rows = await loadAttendance(date, matriculas)
      return {
        date,
        requestedMatriculas: matriculas.length,
        attendanceRows: rows.size,
        studentsWithoutAttendance: matriculas.length - rows.size
      }
    })

    await run('snapshot_pipeline', 'Construcción exacta de la respuesta /snapshot', async () => {
      const snapshot = await buildSnapshot(date, sourceStudents, resolvedSource!)
      const details = {
        responseIsObject: Boolean(snapshot && typeof snapshot === 'object'),
        date: snapshot.date,
        studentsIsArray: Array.isArray(snapshot.students),
        summariesIsArray: Array.isArray(snapshot.summaries),
        students: snapshot.students.length,
        summaries: snapshot.summaries.length,
        byCampus: countBy(snapshot.students, (student) => student.campus),
        byProgram: countBy(snapshot.students, (student) => student.program),
        byConcept: countBy(snapshot.students, (student) => String(student.conceptId)),
        byPlantel: countBy(snapshot.students, (student) => student.plantel),
        byAttendance: countBy(snapshot.students, (student) => student.attendance),
        missingAge: snapshot.students.filter((student) => student.age === null).length,
        generatedAt: snapshot.meta.generatedAt,
        source: snapshot.meta.source,
        partial: snapshot.meta.partial,
        failedPlanteles: snapshot.meta.failedPlanteles,
        serializedCharacters: JSON.stringify(snapshot).length,
        firstStudentShape: snapshot.students[0] ? Object.keys(snapshot.students[0]).sort() : []
      }
      if (!snapshot.students.length) {
        const error: any = new Error('buildSnapshot() produjo una respuesta válida, pero students[] quedó vacío.')
        error.code = 'SUMMER_SNAPSHOT_EMPTY'
        error.diagnostic = details
        throw error
      }
      return details
    })
  } else {
    checks.push({
      key: 'snapshot_pipeline',
      label: 'Construcción exacta de la respuesta /snapshot',
      ok: false,
      latencyMs: 0,
      details: {
        skipped: true,
        reason: !matriculas.length ? 'No hay matrículas provenientes de la fuente.' : 'MySQL de Summer Camp no está disponible.',
        sourceStudents: matriculas.length,
        appConnectionOk: diagnosticState.appConnectionOk
      },
      error: {
        code: 'SNAPSHOT_PIPELINE_SKIPPED',
        message: 'No fue posible ejecutar la construcción completa.'
      }
    })
  }

  const auroraInspection = diagnosticState.auroraInspection
  const sourceHealth = diagnosticState.sourceHealth
  const findings: Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string; evidence?: unknown }> = [...(auroraInspection?.findings || [])] as Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string; evidence?: unknown }>
  const sourceLoaderCheck = checks.find((check) => check.key === 'source_loader')
  const snapshotCheck = checks.find((check) => check.key === 'snapshot_pipeline')

  if (sourceHealth?.reachable && !sourceLoaderCheck?.ok) {
    findings.push({
      severity: 'error' as const,
      code: 'HEALTH_OK_BUT_ENROLLMENT_FAILED',
      message: 'La prueba de salud es positiva, pero la consulta real de alumnos falla o devuelve cero. El health solo confirma conectividad; no valida ciclo, conceptos, estatus, SQL ni contenido de data[].',
      evidence: { sourceHealth }
    })
  }
  if (auroraInspection?.aggregate?.totalRawRows && !sourceLoaderCheck?.ok) {
    findings.push({
      severity: 'error' as const,
      code: 'ROWS_EXIST_BUT_SOURCE_LOADER_FAILED',
      message: 'Las solicitudes directas a Aurora muestran filas, pero loadSummerSource() no las entrega. Comparar contrato data[], nombres de campos, conceptos, planteles y normalización.'
    })
  }
  if (sourceLoaderCheck?.ok && !snapshotCheck?.ok) {
    findings.push({
      severity: 'error' as const,
      code: 'SOURCE_OK_SNAPSHOT_FAILED',
      message: 'La inscripción llega a Summer Camp, pero falla al combinar overrides/asistencia o al construir tokens y grupos.'
    })
  }
  if (snapshotCheck?.ok) {
    findings.push({
      severity: 'info' as const,
      code: 'SERVER_PIPELINE_COMPLETE',
      message: 'El servidor logra construir una lista completa. Si el navegador sigue sin mostrarla, el problema está en la solicitud del cliente, la respuesta HTTP, el estado compartido, HMR o el service worker.'
    })
  }

  const primaryFinding = findings.find((finding) => finding.severity === 'error') || findings.find((finding) => finding.severity === 'warning') || findings[0] || null
  const ok = checks.every((check) => check.ok)
  const checkByKey = Object.fromEntries(checks.map((check) => [check.key, check])) as Record<string, Check>
  const auroraAggregate = auroraInspection?.aggregate || null
  const sourceLoaderRows = sourceLoaderCheck?.ok ? Number((sourceLoaderCheck.details as any)?.totalAfterNormalizationAndDeduplication || 0) : 0
  const snapshotRows = snapshotCheck?.ok ? Number((snapshotCheck.details as any)?.students || 0) : 0
  const boundaries = [
    {
      key: 'configuration',
      label: 'Configuración requerida',
      ok: concepts.length > 0 && planteles.length > 0 && Boolean(config.appMysqlHost && config.appMysqlUser && config.appMysqlDatabase) && (sourceMode === 'mysql' || sourceMode === 'demo' || Boolean(config.auroraBaseUrl && config.auroraApiToken)),
      evidence: configuration
    },
    {
      key: 'source_transport',
      label: 'Transporte hacia la fuente',
      ok: sourceMode === 'demo' || sourceMode === 'mysql' || Number(auroraAggregate?.httpSuccesses || 0) > 0,
      evidence: sourceMode === 'aurora' || sourceMode === 'hybrid' ? { httpSuccesses: auroraAggregate?.httpSuccesses ?? null, requestedPlanteles: auroraAggregate?.requestedPlanteles ?? null, failedPlanteles: auroraAggregate?.failedPlanteles ?? null } : { sourceMode }
    },
    {
      key: 'source_contract',
      label: 'Contrato JSON de la fuente',
      ok: sourceMode === 'demo' || sourceMode === 'mysql' || Number(auroraAggregate?.contractSuccesses || 0) > 0,
      evidence: sourceMode === 'aurora' || sourceMode === 'hybrid' ? { contractSuccesses: auroraAggregate?.contractSuccesses ?? null, requestedPlanteles: auroraAggregate?.requestedPlanteles ?? null } : { sourceMode }
    },
    {
      key: 'source_raw_rows',
      label: 'Filas de inscripción devueltas por la fuente',
      ok: sourceMode === 'demo' || sourceMode === 'mysql' ? Boolean(sourceLoaderCheck?.ok) : Number(auroraAggregate?.totalRawRows || 0) > 0,
      evidence: { totalRawRows: auroraAggregate?.totalRawRows ?? null, byRequestedPlantel: auroraAggregate?.byRequestedPlantel ?? null }
    },
    {
      key: 'configured_concept_rows',
      label: 'Filas que pertenecen a 986/987/988',
      ok: sourceMode === 'demo' || sourceMode === 'mysql' ? Boolean(sourceLoaderCheck?.ok) : Number(auroraAggregate?.totalConfiguredConceptRows || 0) > 0,
      evidence: { configuredConcepts: concepts, totalConfiguredConceptRows: auroraAggregate?.totalConfiguredConceptRows ?? null, byConcept: auroraAggregate?.byConcept ?? null }
    },
    {
      key: 'source_normalization',
      label: 'Normalización y deduplicación de matrículas',
      ok: Boolean(sourceLoaderCheck?.ok && sourceLoaderRows > 0),
      evidence: sourceLoaderCheck || null
    },
    {
      key: 'app_database',
      label: 'MySQL operativo de Summer Camp',
      ok: Boolean(checkByKey.app_connection?.ok),
      evidence: checkByKey.app_connection || null
    },
    {
      key: 'overrides_read',
      label: 'Lectura de modalidad, alimento y edad',
      ok: Boolean(checkByKey.overrides_read?.ok),
      evidence: checkByKey.overrides_read || null
    },
    {
      key: 'attendance_read',
      label: 'Lectura de asistencia',
      ok: Boolean(checkByKey.attendance_read?.ok),
      evidence: checkByKey.attendance_read || null
    },
    {
      key: 'snapshot_build',
      label: 'Construcción final de students[] y summaries[]',
      ok: Boolean(snapshotCheck?.ok && snapshotRows > 0),
      evidence: snapshotCheck || null
    }
  ]
  const failureBoundaryIndex = boundaries.findIndex((boundary) => !boundary.ok)
  const failureBoundary = failureBoundaryIndex >= 0 ? boundaries[failureBoundaryIndex] : null
  const previousBoundary = failureBoundaryIndex > 0 ? boundaries[failureBoundaryIndex - 1] : null
  const preciseFinding = findings.find((finding) => [
    'AURORA_FINANCIAL_QUERY_ERRORS_EXPOSED',
    'AURORA_QUERIES_OK_ZERO_STUDENTS',
    'AURORA_DEEP_DIAGNOSTICS_UNAUTHORIZED',
    'AURORA_NO_HTTP_SUCCESS',
    'AURORA_RESPONSE_CONTRACT_MISMATCH',
    'AURORA_ROWS_WRONG_CONCEPTS'
  ].includes(finding.code)) || (failureBoundary ? {
    severity: 'error' as const,
    code: `FIRST_FAILED_BOUNDARY_${failureBoundary.key.toUpperCase()}`,
    message: `El primer límite que falla es “${failureBoundary.label}”.`,
    evidence: { failed: failureBoundary, previousSuccessfulBoundary: previousBoundary }
  } : primaryFinding)
  const exactAuroraRequests = (auroraInspection?.probes || []).map((probe: any) => ({
    plantel: probe.plantel,
    campus: probe.campus,
    url: probe.request?.url || null,
    status: probe.transport?.status ?? null,
    verdict: probe.verdict || null,
    dataLength: probe.contract?.dataLength ?? null,
    meta: probe.contract?.meta || null,
    error: probe.error || null
  }))

  return {
    diagnosticVersion: SUMMER_DX_VERSION,
    buildId: SUMMER_BUILD_ID,
    snapshotVersion: SUMMER_SNAPSHOT_VERSION,
    ok,
    requestId: id,
    checkedAt: new Date().toISOString(),
    latencyMs: elapsed(started),
    date,
    runtime,
    configuration,
    assumptions: {
      enrollmentDefinition: 'Una matrícula distinta devuelta por la fuente para concepto 986, 987 o 988. El total KPI no depende de asistencia.',
      sourceEndpoint: 'GET {AURORA_BASE_URL}/api/external/v1/summer/students por cada plantel, con year, cycle y concepts.',
      expectedResponseContract: '{ data: SummerStudent[], meta: { plantel, cycle, concepts, total, ... } }',
      sourcePayloadPath: 'Solo payload.data se considera lista válida. Cualquier otro arreglo se reporta como contract_mismatch.',
      normalization: 'matricula se convierte a mayúsculas y sin espacios; nombre, plantel y CURP se limpian; conceptId se convierte a Number.',
      deduplication: 'Se conserva una fila por matrícula. Si aparece más de una vez, prevalece el concepto numéricamente mayor (988 > 987 > 986).',
      campusRule: 'Toluca = CT, PT, ST. Cualquier otro plantel = Metepec.',
      programRule: 'Husky Dreamers / Clínica se toma de summer_student_overrides; el concepto financiero no identifica modalidad.',
      mealRule: '986 = sin alimento, 987 = un alimento por definir, 988 = comida + cena.',
      snapshotDependencies: 'Una lista visible requiere: fuente con alumnos + lectura MySQL app + buildSnapshot + respuesta HTTP JSON + asignación en el estado cliente.',
      auroraFinancialQueries: 'Aurora actual debe exponer paid y charged por separado. Cada rama reporta ok, rowCount, latencyMs y error SQL serializado.',
      auroraDeepDiagnostic: 'GET /api/external/v1/summer/diagnostics se consulta por cada plantel y debe distinguir consultas correctas con cero filas, una rama fallida, ambas ramas fallidas y fallo de contexto Bridge.'
    },
    diagnosticCompleteness: {
      expectedPlantelProbes: sourceMode === 'aurora' || sourceMode === 'hybrid' ? planteles.length : 0,
      capturedPlantelProbes: auroraInspection?.probes?.length || 0,
      checksCaptured: checks.length,
      allConfiguredPlantelesProbed: sourceMode !== 'aurora' && sourceMode !== 'hybrid' ? true : (auroraInspection?.probes?.length || 0) === planteles.length,
      exactRequestsCaptured: exactAuroraRequests.length,
      failureBoundaryResolved: Boolean(failureBoundary) || snapshotRows > 0
    },
    dataFlow: {
      configuredPlanteles: planteles.length,
      auroraHttpSuccesses: auroraAggregate?.httpSuccesses ?? null,
      auroraContractSuccesses: auroraAggregate?.contractSuccesses ?? null,
      auroraRawRows: auroraAggregate?.totalRawRows ?? null,
      auroraConfiguredConceptRows: auroraAggregate?.totalConfiguredConceptRows ?? null,
      auroraDistinctMatriculas: auroraAggregate?.distinctMatriculasAcrossPlanteles ?? null,
      sourceRowsAfterNormalization: sourceLoaderRows,
      snapshotStudents: snapshotRows,
      rowsLostRawToConfiguredConcept: auroraAggregate ? Math.max(0, Number(auroraAggregate.totalRawRows || 0) - Number(auroraAggregate.totalConfiguredConceptRows || 0)) : null,
      rowsLostConfiguredConceptToNormalized: auroraAggregate ? Math.max(0, Number(auroraAggregate.totalConfiguredConceptRows || 0) - sourceLoaderRows) : null,
      rowsLostNormalizedToSnapshot: Math.max(0, sourceLoaderRows - snapshotRows)
    },
    exactAuroraRequests,
    boundaries,
    conclusion: {
      primaryFinding: preciseFinding,
      originalFinding: primaryFinding,
      failureBoundary,
      failureBoundaryIndex,
      previousSuccessfulBoundary: previousBoundary,
      allFindings: findings,
      serverPipelineComplete: Boolean(snapshotCheck?.ok),
      sourceRowsObservedDirectly: auroraInspection?.aggregate?.totalRawRows ?? null,
      sourceRowsMatchingConfiguredConceptsDirectly: auroraInspection?.aggregate?.totalConfiguredConceptRows ?? null,
      sourceDistinctMatriculasDirectly: auroraInspection?.aggregate?.distinctMatriculasAcrossPlanteles ?? null,
      sourceRowsAfterLoader: sourceLoaderCheck?.ok ? (sourceLoaderCheck.details as any)?.totalAfterNormalizationAndDeduplication ?? null : 0,
      estimatedRowsFilteredOrDeduplicated: auroraInspection?.aggregate && sourceLoaderCheck?.ok
        ? Math.max(0, Number(auroraInspection.aggregate.totalConfiguredConceptRows || 0) - Number((sourceLoaderCheck.details as any)?.totalAfterNormalizationAndDeduplication || 0))
        : null,
      nextBoundaryToInspect: snapshotCheck?.ok ? 'browser_http_and_state' : sourceLoaderCheck?.ok ? 'snapshot_dependencies' : 'aurora_or_source_loader'
    },
    auroraInspection,
    checks
  }
})
