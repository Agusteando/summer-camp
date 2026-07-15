import { SUMMER_BUILD_ID, SUMMER_DX_VERSION, SUMMER_SNAPSHOT_VERSION } from '../../utils/build'
import { appQuery } from '../../utils/db'
import { serializeDiagnosticError } from '../../utils/diagnostic-error'
import { resolveSummerPlantelConfiguration } from '../../utils/summer-config'
import { getLastSummerSourceTrace } from '../../utils/summer-source-trace'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  const config = useRuntimeConfig()
  if (String(config.public.diagnosticsEnabled) === 'false') {
    throw createError({ statusCode: 404, message: 'Diagnóstico deshabilitado.' })
  }

  const started = Date.now()
  const plantelConfiguration = resolveSummerPlantelConfiguration()
  const sourceTrace = getLastSummerSourceTrace()
  let appDatabase: Record<string, unknown>
  try {
    const rows = await appQuery<any[]>('SELECT DATABASE() AS databaseName, NOW() AS serverTime')
    appDatabase = {
      ok: true,
      databaseName: rows?.[0]?.databaseName || null,
      serverTime: rows?.[0]?.serverTime || null
    }
  } catch (cause: any) {
    appDatabase = { ok: false, error: serializeDiagnosticError(cause) }
  }

  const findings: Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string; evidence?: unknown }> = []
  if (!sourceTrace) {
    findings.push({
      severity: 'warning',
      code: 'NO_SOURCE_TRACE_IN_THIS_SERVER_INSTANCE',
      message: 'Este proceso no conserva todavía una traza de la consulta de alumnos. El error HTTP capturado por el navegador sigue siendo la fuente principal.'
    })
  } else {
    const responseMeta: any = sourceTrace.response?.meta || null
    const plantelResults = Array.isArray(responseMeta?.plantelResults) ? responseMeta.plantelResults : []
    const failedPlanteles = plantelResults.filter((row: any) => row?.ok === false)
    const successfulPlanteles = plantelResults.filter((row: any) => row?.ok === true)

    if (sourceTrace.error) {
      findings.push({ severity: 'error', code: sourceTrace.error.code || 'AURORA_AGGREGATE_REQUEST_FAILED', message: sourceTrace.error.message, evidence: sourceTrace.error })
    }
    if (sourceTrace.response && !sourceTrace.response.dataIsArray) {
      findings.push({ severity: 'error', code: 'AURORA_AGGREGATE_CONTRACT_INVALID', message: 'La respuesta agregada de Aurora no contiene data[].', evidence: sourceTrace.response })
    }
    if (responseMeta && Number(responseMeta.queryVersion || 0) !== 3) {
      findings.push({
        severity: 'error',
        code: 'AURORA_SUMMER_BUILD_STALE',
        message: 'Aurora respondió con una versión anterior del query Summer. Debe exponer queryVersion 3.',
        evidence: { queryVersion: responseMeta.queryVersion ?? null, queryStrategy: responseMeta.queryStrategy ?? null }
      })
    }
    if (failedPlanteles.length) {
      findings.push({
        severity: successfulPlanteles.length ? 'warning' : 'error',
        code: successfulPlanteles.length ? 'AURORA_PARTIAL_FINANCIAL_AGENTS' : 'AURORA_ALL_FINANCIAL_AGENTS_FAILED',
        message: successfulPlanteles.length
          ? 'Aurora entregó datos parciales; los errores por agente están incluidos.'
          : 'Aurora no pudo consultar ningún agente financiero.',
        evidence: { successfulPlanteles, failedPlanteles }
      })
    }
    if (sourceTrace.response?.dataLength === 0 && !sourceTrace.error) {
      findings.push({
        severity: 'warning',
        code: 'AURORA_VALID_ZERO_ENROLLMENTS',
        message: 'Aurora respondió correctamente, pero no encontró matrículas con concepto 986, 987 o 988 para el ciclo configurado.',
        evidence: responseMeta
      })
    }
    if ((sourceTrace.response?.dataLength || 0) > 0 && sourceTrace.normalization?.distinctStudents === 0) {
      findings.push({
        severity: 'error',
        code: 'ROWS_REJECTED_DURING_SUMMER_NORMALIZATION',
        message: 'Aurora devolvió filas, pero Summer Camp rechazó todas durante normalización.',
        evidence: sourceTrace.normalization
      })
    }
  }

  if (appDatabase.ok === false) {
    findings.push({ severity: 'error', code: 'SUMMER_APP_DATABASE_FAILED', message: 'MySQL de Summer Camp no respondió.', evidence: appDatabase })
  }

  return {
    diagnosticVersion: SUMMER_DX_VERSION,
    buildId: SUMMER_BUILD_ID,
    snapshotVersion: SUMMER_SNAPSHOT_VERSION,
    ok: !findings.some((finding) => finding.severity === 'error'),
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    purpose: 'Diagnóstico observacional. No ejecuta nuevas consultas contra Aurora ni multiplica tráfico al Bridge.',
    configuration: {
      sourceMode: String(config.summerSourceMode || 'aurora'),
      auroraBaseUrl: String(config.auroraBaseUrl || '').replace(/\/+$/, ''),
      auroraTokenConfigured: Boolean(String(config.auroraApiToken || '').trim()),
      cycle: String(config.summerCycle || '2026'),
      concepts: String(config.summerConceptIds || '986,987,988').split(',').map(Number).filter(Number.isFinite),
      planteles: plantelConfiguration.resolved,
      auroraTimeoutMs: Math.max(60000, Number(config.auroraTimeoutMs || 60000)),
      expectedAuroraQueryVersion: 3,
      expectedAuroraQueryStrategy: 'single-union-direct-concept'
    },
    appDatabase,
    sourceTrace,
    findings
  }
})
