<script setup lang="ts">
import { AlertTriangle, Bug, Check, ChevronDown, Clipboard, FileJson, LoaderCircle, RefreshCw, X } from '@lucide/vue'
import type { SummerDiagnosticsResponse } from '~/types/summer'

type DxExecutionStatus = 'idle' | 'scheduled' | 'running' | 'complete' | 'failed'
type DxExecution = {
  status: DxExecutionStatus
  attempt: number
  runId: string | null
  trigger: string | null
  stage: string
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  error: string | null
}

const config = useRuntimeConfig()
const CLIENT_BUILD_ID = 'summer-v10-stability'
const CLIENT_DX_VERSION = 10
const route = useRoute()
const summer = useSummerData()
const connectivity = useConnectivity()
const report = useState<SummerDiagnosticsResponse | null>('summer-diagnostic-report-v10', () => null)
const loading = useState('summer-diagnostic-loading-v10', () => false)
const fetchError = useState<string | null>('summer-diagnostic-fetch-error-v10', () => null)
const rawProbes = useState<Record<string, any> | null>('summer-diagnostic-raw-probes-v10', () => null)
const browserContext = useState<Record<string, unknown> | null>('summer-diagnostic-browser-context-v10', () => null)
const execution = useState<DxExecution>('summer-diagnostic-execution-v10', () => ({
  status: 'idle',
  attempt: 0,
  runId: null,
  trigger: null,
  stage: 'not-started',
  scheduledAt: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  error: null
}))
const copied = ref(false)
const copying = ref(false)
const selected = ref(false)
const clientMounted = ref(false)
const details = ref<HTMLDetailsElement | null>(null)
const jsonField = ref<HTMLTextAreaElement | null>(null)
let autoTimer: ReturnType<typeof setTimeout> | null = null
let activeRun: Promise<void> | null = null

const enabled = computed(() => String(config.public.diagnosticsEnabled) !== 'false')
const loadAttempted = computed(() => summer.loadLifecycle.value.loadAttempted)
const initialLoadFinished = computed(() => ['success', 'failure'].includes(summer.loadLifecycle.value.lastLoadOutcome))
const snapshotOk = computed(() => Boolean(summer.snapshot.value?.students && summer.snapshot.value?.summaries))
const diagnosticComplete = computed(() => Boolean(
  execution.value.status === 'complete' &&
  browserContext.value &&
  rawProbes.value?.build &&
  rawProbes.value?.health &&
  rawProbes.value?.snapshot &&
  rawProbes.value?.diagnostics
))
const hasFailure = computed(() => Boolean(
  summer.error.value ||
  fetchError.value ||
  report.value?.ok === false ||
  (clientMounted.value && loadAttempted.value && initialLoadFinished.value && !summer.snapshot.value)
))
const completedChecks = computed(() => report.value?.checks.filter((check) => check.ok).length || 0)
const primaryFinding = computed(() => (report.value as any)?.conclusion?.primaryFinding || null)
const copyPayloadReady = computed(() => diagnosticComplete.value || execution.value.status === 'failed')

const safeError = (cause: any) => ({
  name: cause?.name || null,
  message: cause?.message || String(cause || 'Error desconocido'),
  code: cause?.code || null,
  statusCode: cause?.statusCode || cause?.status || cause?.response?.status || null,
  statusMessage: cause?.statusMessage || cause?.response?.statusText || null,
  data: cause?.data || null,
  stack: cause?.stack || null,
  cause: cause?.cause?.message || (cause?.cause ? String(cause.cause) : null)
})

const summarizeJson = (json: any) => {
  const object = json && typeof json === 'object' && !Array.isArray(json) ? json : null
  const students = Array.isArray(object?.students) ? object.students : null
  const summaries = Array.isArray(object?.summaries) ? object.summaries : null
  return {
    jsonType: json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json,
    topLevelKeys: object ? Object.keys(object).sort() : [],
    studentsIsArray: Boolean(students),
    studentsLength: students?.length ?? null,
    studentFields: students?.[0] && typeof students[0] === 'object' ? Object.keys(students[0]).sort() : [],
    summariesIsArray: Boolean(summaries),
    summariesLength: summaries?.length ?? null,
    summaryRows: summaries?.slice(0, 30).map((row: any) => ({
      plantel: row?.plantel ?? null,
      campus: row?.campus ?? null,
      total: row?.total ?? null,
      present: row?.present ?? null,
      absent: row?.absent ?? null,
      unmarked: row?.unmarked ?? null,
      pendingProgram: row?.pendingProgram ?? null
    })) ?? [],
    buildId: object?.buildId ?? object?.meta?.buildId ?? null,
    dxVersion: object?.dxVersion ?? object?.diagnosticVersion ?? null,
    snapshotVersion: object?.snapshotVersion ?? object?.meta?.snapshotVersion ?? null,
    requestId: object?.requestId ?? object?.meta?.requestId ?? object?.data?.diagnostic?.requestId ?? null,
    meta: object?.meta || null,
    errorMessage: object?.message || object?.statusMessage || object?.data?.message || null,
    diagnostic: object?.data?.diagnostic || object?.diagnostic || null
  }
}

const endpointProbe = async (path: string, timeoutMs: number) => {
  const started = performance.now()
  const url = new URL(path, window.location.origin)
  url.searchParams.set('_dx_client', String(Date.now()))
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'X-Summer-Client-Build': CLIENT_BUILD_ID,
        'X-Summer-Client-DX-Version': String(CLIENT_DX_VERSION)
      },
      signal: controller.signal
    })
    const body = await response.text()
    let json: any = null
    let parseError: string | null = null
    try { json = body ? JSON.parse(body) : null } catch (cause: any) { parseError = cause?.message || String(cause) }
    const summary = summarizeJson(json)
    return {
      request: { url: url.toString(), pathname: url.pathname, search: url.search, method: 'GET', credentials: 'same-origin', cache: 'no-store', timeoutMs },
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        redirected: response.redirected,
        finalUrl: response.url,
        type: response.type,
        latencyMs: Math.round(performance.now() - started),
        headers: Object.fromEntries(response.headers.entries()),
        bodyCharacters: body.length,
        bodyPreview: !response.ok || parseError || summary.studentsLength === 0 || url.pathname.endsWith('/health') ? body.slice(0, 12000) : '[Cuerpo omitido; se conserva estructura, meta, resúmenes y conteos sin datos personales.]',
        jsonParsed: parseError === null,
        parseError,
        ...summary
      },
      parsedJson: json
    }
  } catch (cause: any) {
    return {
      request: { url: url.toString(), pathname: url.pathname, search: url.search, method: 'GET', credentials: 'same-origin', cache: 'no-store', timeoutMs },
      response: {
        ok: false,
        status: null,
        statusText: null,
        latencyMs: Math.round(performance.now() - started),
        networkError: safeError(cause)
      },
      parsedJson: null
    }
  } finally {
    window.clearTimeout(timer)
  }
}

const safeRegistrations = async () => {
  if (!('serviceWorker' in navigator)) return { value: [], error: null }
  try { return { value: await navigator.serviceWorker.getRegistrations(), error: null } }
  catch (cause: any) { return { value: [], error: safeError(cause) } }
}

const safeCacheNames = async () => {
  if (!('caches' in window)) return { value: [], error: null }
  try { return { value: await caches.keys(), error: null } }
  catch (cause: any) { return { value: [], error: safeError(cause) } }
}

const collectBrowserContext = async () => {
  const [registrationResult, cacheResult] = await Promise.all([safeRegistrations(), safeCacheNames()])
  const registrations = registrationResult.value
  const storage = (() => {
    try {
      const currentKey = `summer-snapshot:v10:${summer.selectedDate.value}`
      return {
        currentSnapshotKey: currentKey,
        currentSnapshotCharacters: localStorage.getItem(currentKey)?.length || 0,
        allSummerKeys: Object.keys(localStorage).filter((key) => key.startsWith('summer-')).sort(),
        legacySnapshotKeys: Object.keys(localStorage).filter((key) => /^summer-snapshot:v(?:[1-9]):/.test(key)).sort()
      }
    } catch (cause: any) {
      return { error: safeError(cause) }
    }
  })()
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const apiResources = performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/api/summer/'))
    .slice(-30)
    .map((entry: any) => ({ name: entry.name, initiatorType: entry.initiatorType, startTime: Math.round(entry.startTime), durationMs: Math.round(entry.duration), transferSize: entry.transferSize ?? null }))

  return {
    capturedAt: new Date().toISOString(),
    buildIdentity: { clientBuildId: CLIENT_BUILD_ID, clientDxVersion: CLIENT_DX_VERSION, runtimeBuildId: config.public.buildId || null, runtimeDxVersion: config.public.diagnosticVersion || null },
    prebootCleanup: (window as any).__SUMMER_PREBOOT__ || null,
    page: {
      href: window.location.href,
      origin: window.location.origin,
      route: route.fullPath,
      protocol: window.location.protocol,
      documentReadyState: document.readyState,
      visibilityState: document.visibilityState,
      scriptSources: Array.from(document.scripts).map((script) => script.src || '[inline]').filter(Boolean),
      stylesheetSources: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) => link.href),
      nuxtStateKeys: Object.keys((window as any).__NUXT__?.state || {}).sort(),
      nuxtConfigPublic: (window as any).__NUXT__?.config?.public || null
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency || null
    },
    navigation: navigation ? {
      type: navigation.type,
      durationMs: Math.round(navigation.duration),
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadEventMs: Math.round(navigation.loadEventEnd),
      transferSize: navigation.transferSize
    } : null,
    apiResourceTimings: apiResources,
    serviceWorker: {
      supported: 'serviceWorker' in navigator,
      controlled: Boolean(navigator.serviceWorker?.controller),
      controllerScriptUrl: navigator.serviceWorker?.controller?.scriptURL || null,
      controllerState: navigator.serviceWorker?.controller?.state || null,
      registrationReadError: registrationResult.error,
      registrations: registrations.map((registration) => ({
        scope: registration.scope,
        active: registration.active ? { scriptURL: registration.active.scriptURL, state: registration.active.state } : null,
        waiting: registration.waiting ? { scriptURL: registration.waiting.scriptURL, state: registration.waiting.state } : null,
        installing: registration.installing ? { scriptURL: registration.installing.scriptURL, state: registration.installing.state } : null
      })),
      cacheReadError: cacheResult.error,
      cacheNames: cacheResult.value
    },
    localStorage: storage,
    applicationState: {
      selectedDate: summer.selectedDate.value,
      loading: summer.loading.value,
      updating: summer.updating.value,
      error: summer.error.value,
      snapshotPresent: Boolean(summer.snapshot.value),
      snapshotStudents: summer.snapshot.value?.students.length || 0,
      snapshotSummaries: summer.snapshot.value?.summaries.length || 0,
      snapshotMeta: summer.snapshot.value?.meta || null,
      requestDiagnostic: summer.requestDiagnostic.value,
      loadLifecycle: summer.loadLifecycle.value,
      clientTrace: summer.clientTrace.value
    },
    connectivity: {
      browserOnline: connectivity.browserOnline.value,
      sourceState: connectivity.sourceState.value,
      appState: connectivity.appState.value,
      sourceName: connectivity.sourceName.value,
      healthLatencyMs: connectivity.latencyMs.value,
      healthCheckedAt: connectivity.checkedAt.value
    }
  }
}

const clientFindings = computed(() => {
  const findings: Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string; evidence?: unknown }> = []
  const lifecycle = summer.loadLifecycle.value
  if (!clientMounted.value) findings.push({ severity: 'warning', code: 'DX_COMPONENT_NOT_MOUNTED', message: 'El bloque DX todavía no terminó de montar en el navegador.' })
  if (!lifecycle.loadAttempted) findings.push({ severity: 'error', code: 'CLIENT_LOAD_NEVER_ATTEMPTED', message: 'La aplicación no llamó useSummerData().load(). El problema ocurre antes de consultar /api/summer/snapshot.', evidence: lifecycle })
  if (lifecycle.loadAttempted && !summer.requestDiagnostic.value && lifecycle.lastLoadOutcome !== 'running') findings.push({ severity: 'error', code: 'CLIENT_REFRESH_NOT_REACHED', message: 'load() sí inició, pero no existe requestDiagnostic. La ejecución se detuvo antes o dentro de paintCache()/cola local.', evidence: { lifecycle, trace: summer.clientTrace.value } })
  if (lifecycle.loadAttempted && summer.clientTrace.value.length === 0) findings.push({ severity: 'error', code: 'CLIENT_TRACE_EMPTY_AFTER_LOAD', message: 'El estado indica que hubo intento de carga, pero no se registró ningún evento cliente; revisar hidratación o estado Nuxt duplicado.', evidence: lifecycle })
  if (summer.requestDiagnostic.value?.ok && !summer.snapshot.value) findings.push({ severity: 'error', code: 'FETCH_OK_STATE_EMPTY', message: '$fetch terminó correctamente, pero snapshot quedó nulo. La falla está en validación/asignación o en una sustitución posterior del estado.', evidence: summer.requestDiagnostic.value })
  const serverBuildId = rawProbes.value?.build?.response?.buildId || rawProbes.value?.build?.response?.headers?.['x-summer-build-id'] || null
  const serverDxVersion = Number(rawProbes.value?.build?.response?.dxVersion || rawProbes.value?.build?.response?.headers?.['x-summer-dx-version'] || 0) || null
  if (serverBuildId && serverBuildId !== CLIENT_BUILD_ID) findings.push({ severity: 'error', code: 'CLIENT_SERVER_BUILD_MISMATCH', message: 'El navegador y el servidor ejecutan builds distintos. Cualquier otro resultado DX puede mezclar código viejo y nuevo.', evidence: { clientBuildId: CLIENT_BUILD_ID, serverBuildId, clientDxVersion: CLIENT_DX_VERSION, serverDxVersion } })
  if (serverDxVersion && serverDxVersion !== CLIENT_DX_VERSION) findings.push({ severity: 'error', code: 'CLIENT_SERVER_DX_VERSION_MISMATCH', message: 'La versión DX del navegador no coincide con la versión reportada por el servidor.', evidence: { clientDxVersion: CLIENT_DX_VERSION, serverDxVersion } })
  if (rawProbes.value?.snapshot?.response?.ok && Number(rawProbes.value.snapshot.response.studentsLength) > 0 && !summer.snapshot.value) findings.push({ severity: 'error', code: 'DIRECT_SNAPSHOT_OK_UI_EMPTY', message: 'El GET nativo a /snapshot devuelve alumnos, pero la UI no tiene snapshot. La fuente y el servidor funcionan; falla el estado cliente.', evidence: rawProbes.value.snapshot.response })
  if (rawProbes.value?.snapshot?.response?.status && !rawProbes.value.snapshot.response.ok) findings.push({ severity: 'error', code: 'DIRECT_SNAPSHOT_HTTP_ERROR', message: 'El endpoint /snapshot falla por HTTP. El cuerpo y diagnostic de esa respuesta están incluidos en directBrowserProbes.snapshot.', evidence: rawProbes.value.snapshot.response })
  if (execution.value.status !== 'complete') findings.push({ severity: 'warning', code: 'DX_NOT_COMPLETE', message: 'El diagnóstico todavía no contiene todas las pruebas. Usar “Ejecutar y copiar”.', evidence: execution.value })
  return findings
})

const reportPayload = computed(() => ({
  dxVersion: CLIENT_DX_VERSION,
  buildId: CLIENT_BUILD_ID,
  purpose: 'Diagnóstico temporal de la carga de alumnos. El botón de copia ejecuta y espera todas las pruebas antes de copiar.',
  capturedAt: new Date().toISOString(),
  diagnosticExecution: execution.value,
  diagnosticCompleteness: {
    complete: diagnosticComplete.value,
    browserCaptured: Boolean(browserContext.value),
    buildProbeCaptured: Boolean(rawProbes.value?.build),
    healthProbeCaptured: Boolean(rawProbes.value?.health),
    snapshotProbeCaptured: Boolean(rawProbes.value?.snapshot),
    serverDiagnosticProbeCaptured: Boolean(rawProbes.value?.diagnostics),
    serverDiagnosticParsed: Boolean(report.value),
    diagnosticFetchErrorCaptured: Boolean(fetchError.value),
    copyActionWaitsForCompleteRun: true,
    staleDx8ReportRejectedByVersion: true,
    readyForCopy: diagnosticComplete.value
  },
  visibleProblem: {
    title: !loadAttempted.value
      ? 'La carga inicial todavía no fue intentada'
      : !summer.snapshot.value && initialLoadFinished.value
        ? 'No se pudo cargar la lista'
        : null,
    message: summer.error.value || summer.loadLifecycle.value.lastLoadError || (!summer.snapshot.value && initialLoadFinished.value ? 'La solicitud terminó sin datos.' : null)
  },
  clientFindings: clientFindings.value,
  browser: browserContext.value,
  clientStateNow: {
    route: route.fullPath,
    selectedDate: summer.selectedDate.value,
    loading: summer.loading.value,
    updating: summer.updating.value,
    error: summer.error.value,
    snapshotPresent: Boolean(summer.snapshot.value),
    snapshotStudents: summer.snapshot.value?.students.length || 0,
    snapshotSummaries: summer.snapshot.value?.summaries.length || 0,
    snapshotMeta: summer.snapshot.value?.meta || null,
    requestDiagnostic: summer.requestDiagnostic.value,
    loadLifecycle: summer.loadLifecycle.value,
    clientTrace: summer.clientTrace.value
  },
  directBrowserProbes: rawProbes.value,
  serverDiagnostic: report.value,
  diagnosticFetchError: fetchError.value
}))
const stringifyReport = (value: unknown) => {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_key, nested) => {
    if (typeof nested === 'bigint') return nested.toString()
    if (nested && typeof nested === 'object') {
      if (seen.has(nested)) return '[Circular]'
      seen.add(nested)
    }
    return nested
  }, 2)
}
const formatted = computed(() => stringifyReport(reportPayload.value))
const displayedJson = computed(() => copyPayloadReady.value
  ? formatted.value
  : 'DX10 aún está ejecutando o no ha iniciado. Usa “Ejecutar y copiar todo”; el JSON incompleto no se puede seleccionar.')

const unwrapDiagnostics = (payload: any) => {
  const candidates = [payload, payload?.data, payload?.data?.data]
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && Array.isArray(candidate.checks)) || null
}

const run = async (trigger = 'manual') => {
  if (!enabled.value || !import.meta.client) return
  if (activeRun) return await activeRun

  activeRun = (async () => {
    const runId = `dx10-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const started = Date.now()
    loading.value = true
    fetchError.value = null
    selected.value = false
    execution.value = {
      status: 'running',
      attempt: execution.value.attempt + 1,
      runId,
      trigger,
      stage: 'collect-browser-before',
      scheduledAt: execution.value.scheduledAt,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: null,
      error: null
    }

    try {
      browserContext.value = await collectBrowserContext()
      const date = encodeURIComponent(summer.selectedDate.value)
      rawProbes.value = {}
      const executeProbe = async (key: string, path: string, timeoutMs: number) => {
        execution.value = { ...execution.value, stage: `probe-${key}` }
        const probe = await endpointProbe(path, timeoutMs)
        rawProbes.value = {
          ...(rawProbes.value || {}),
          [key]: { request: probe.request, response: probe.response }
        }
        return probe
      }
      const buildProbe = await executeProbe('build', '/api/summer/build', 15000)
      const healthProbe = await executeProbe('health', '/api/summer/health', 20000)
      const snapshotProbe = await executeProbe('snapshot', `/api/summer/snapshot?date=${date}`, 60000)
      const diagnosticsProbe = await executeProbe('diagnostics', `/api/summer/diagnostics?date=${date}`, 120000)

      execution.value = { ...execution.value, stage: 'parse-server-diagnostic' }
      const candidate = unwrapDiagnostics(diagnosticsProbe.parsedJson)
      if (candidate) {
        report.value = candidate as SummerDiagnosticsResponse
      } else {
        report.value = null
        fetchError.value = `El endpoint de diagnóstico no devolvió checks[]. HTTP ${diagnosticsProbe.response.status ?? 'sin estado'}; JSON=${diagnosticsProbe.response.jsonParsed ?? false}; keys=${(diagnosticsProbe.response.topLevelKeys || []).join(',') || '(ninguna)'}.`
      }

      const serverBuildId = buildProbe.response?.buildId || buildProbe.response?.headers?.['x-summer-build-id'] || null
      const serverDxVersion = Number(buildProbe.response?.dxVersion || buildProbe.response?.headers?.['x-summer-dx-version'] || 0) || null
      if (serverBuildId !== CLIENT_BUILD_ID || serverDxVersion !== CLIENT_DX_VERSION) {
        fetchError.value = [fetchError.value, `BUILD_MISMATCH client=${CLIENT_BUILD_ID}/DX${CLIENT_DX_VERSION} server=${serverBuildId || 'null'}/DX${serverDxVersion || 'null'}`].filter(Boolean).join(' | ')
      }
      execution.value = { ...execution.value, stage: 'collect-browser-after' }
      browserContext.value = await collectBrowserContext()
      execution.value = {
        ...execution.value,
        status: 'complete',
        stage: 'complete',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        error: null
      }
    } catch (cause: any) {
      const detail = safeError(cause)
      fetchError.value = cause?.data?.message || cause?.message || 'No se pudo ejecutar el diagnóstico.'
      execution.value = {
        ...execution.value,
        status: 'failed',
        stage: 'failed',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        error: JSON.stringify(detail)
      }
      browserContext.value = await collectBrowserContext().catch(() => browserContext.value)
    } finally {
      loading.value = false
      await nextTick()
      if (details.value) details.value.open = true
    }
  })()

  try { await activeRun } finally { activeRun = null }
}

const ensureFullDiagnostic = async (trigger: string) => {
  if (!summer.loadLifecycle.value.loadAttempted) {
    execution.value = { ...execution.value, status: 'running', trigger, stage: 'forcing-initial-load', startedAt: new Date().toISOString(), error: null }
    await summer.load(`dx-${trigger}-initial-load`)
  }
  if (!diagnosticComplete.value) await run(trigger)
}

const selectAll = () => {
  jsonField.value?.focus()
  jsonField.value?.select()
  selected.value = true
}

const writeClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      selectAll()
      return document.execCommand('copy')
    } catch { return false }
  }
}

const copy = async () => {
  if (copying.value) return
  copying.value = true
  copied.value = false
  try {
    await ensureFullDiagnostic('copy-button')
    if (!diagnosticComplete.value && execution.value.status !== 'failed') {
      const missing = {
        browser: !browserContext.value,
        build: !rawProbes.value?.build,
        health: !rawProbes.value?.health,
        snapshot: !rawProbes.value?.snapshot,
        diagnostics: !rawProbes.value?.diagnostics
      }
      fetchError.value = [fetchError.value, `DX_RUN_INCOMPLETE ${JSON.stringify(missing)}`].filter(Boolean).join(' | ')
      execution.value = { ...execution.value, status: 'failed', stage: 'incomplete-after-run', finishedAt: new Date().toISOString(), error: fetchError.value }
    }
    browserContext.value = await collectBrowserContext().catch(() => browserContext.value)
    await nextTick()
    const success = await writeClipboard(formatted.value)
    copied.value = success
    if (!success) selectAll()
  } finally {
    copying.value = false
    window.setTimeout(() => { copied.value = false }, 2200)
  }
}

const scheduleAutoRun = (delay = 700, reason = 'auto-after-load') => {
  if (!import.meta.client) return
  if (autoTimer) clearTimeout(autoTimer)
  execution.value = { ...execution.value, status: execution.value.status === 'running' ? 'running' : 'scheduled', scheduledAt: new Date().toISOString(), trigger: reason, stage: execution.value.status === 'running' ? execution.value.stage : 'waiting-for-client-load' }
  autoTimer = window.setTimeout(async () => {
    if (!summer.loadLifecycle.value.loadAttempted) await summer.load('dx-auto-load-failsafe')
    if (summer.loadLifecycle.value.lastLoadOutcome === 'running') {
      scheduleAutoRun(1200, `${reason}-waiting-for-load`)
      return
    }
    if (!summer.snapshot.value) await run(reason)
  }, delay)
}

watch(
  () => [summer.loadLifecycle.value.loadAttempted, summer.loadLifecycle.value.lastLoadOutcome, Boolean(summer.snapshot.value), summer.error.value] as const,
  ([attempted, outcome, hasSnapshot]) => {
    if (clientMounted.value && attempted && outcome === 'failure' && !hasSnapshot) scheduleAutoRun(150, 'auto-after-client-failure')
  }
)
watch(() => summer.selectedDate.value, () => {
  report.value = null
  rawProbes.value = null
  fetchError.value = null
  execution.value = { ...execution.value, status: 'scheduled', stage: 'date-changed', scheduledAt: new Date().toISOString(), trigger: 'date-change' }
  scheduleAutoRun(500, 'auto-after-date-change')
})

onMounted(async () => {
  clientMounted.value = true
  summer.noteClientMounted('dx-component-mounted')
  browserContext.value = await collectBrowserContext().catch(() => null)
  scheduleAutoRun(2500, 'auto-on-mount')
})
onBeforeUnmount(() => { if (autoTimer) clearTimeout(autoTimer) })
</script>

<template>
  <section v-if="enabled" class="diagnostic-shell" :class="{ 'diagnostic-shell--error': hasFailure }">
    <details ref="details" class="diagnostic-panel" :open="hasFailure">
      <summary>
        <span class="diagnostic-panel__icon"><Bug :size="16" /></span>
        <span class="diagnostic-panel__title">
          <strong>DX10 · Carga de alumnos</strong>
          <small v-if="loading">{{ execution.stage }} · {{ execution.runId || 'preparando' }}</small>
          <small v-else-if="primaryFinding">{{ primaryFinding.code }} · {{ primaryFinding.message }}</small>
          <small v-else-if="!loadAttempted">Esperando la primera carga del cliente</small>
          <small v-else-if="hasFailure">Sin lista · el botón de copia ejecuta todas las pruebas</small>
          <small v-else-if="report">{{ completedChecks }}/{{ report.checks.length }} límites correctos</small>
          <small v-else>Prueba completa disponible</small>
        </span>
        <span class="diagnostic-panel__state" :class="hasFailure ? 'is-bad' : snapshotOk ? 'is-ok' : 'is-idle'">
          <LoaderCircle v-if="loading || copying" :size="14" class="spin" />
          <X v-else-if="hasFailure" :size="14" />
          <Check v-else-if="snapshotOk" :size="14" />
          <ChevronDown v-else :size="14" />
          {{ loading ? 'Probando' : copying ? 'Copiando' : hasFailure ? 'Falla' : snapshotOk ? 'Lista OK' : 'Revisar' }}
        </span>
      </summary>

      <div class="diagnostic-panel__body">
        <div class="diagnostic-focus">
          <AlertTriangle :size="18" />
          <div>
            <strong>Problema actual</strong>
            <span v-if="!loadAttempted">La carga inicial todavía no se ejecutó; DX la forzará antes de probar los endpoints.</span>
            <span v-else>{{ summer.error.value || summer.loadLifecycle.value.lastLoadError || (!summer.snapshot.value ? 'La solicitud terminó sin datos y el estado cliente quedó sin snapshot.' : 'La lista está disponible; se puede validar el pipeline completo.') }}</span>
          </div>
        </div>

        <div class="diagnostic-actions diagnostic-actions--sticky">
          <button :disabled="loading || copying" @click="run('manual-button')">
            <LoaderCircle v-if="loading" :size="15" class="spin" />
            <RefreshCw v-else :size="15" />
            Ejecutar prueba completa
          </button>
          <button :disabled="copying" @click="copy"><LoaderCircle v-if="copying" :size="15" class="spin" /><Check v-else-if="copied" :size="15" /><Clipboard v-else :size="15" />{{ copying ? 'Ejecutando y copiando…' : copied ? 'Copiado' : 'Ejecutar y copiar todo' }}</button>
          <button :disabled="!copyPayloadReady" @click="selectAll"><FileJson :size="15" />{{ selected ? 'Seleccionado' : 'Seleccionar JSON' }}</button>
        </div>

        <div class="diagnostic-summary-grid">
          <div><span>Build</span><strong :class="rawProbes?.build?.response?.buildId === CLIENT_BUILD_ID ? 'is-ok' : 'is-bad'">{{ CLIENT_BUILD_ID }} / {{ rawProbes?.build?.response?.buildId || 'servidor pendiente' }}</strong></div>
          <div><span>Carga cliente</span><strong :class="loadAttempted ? 'is-ok' : 'is-bad'">{{ summer.loadLifecycle.value.lastLoadOutcome }} · {{ summer.loadLifecycle.value.loadCallCount }} llamada(s)</strong></div>
          <div><span>Estado cliente</span><strong :class="summer.snapshot.value ? 'is-ok' : 'is-bad'">{{ summer.snapshot.value ? `${summer.snapshot.value.students.length} alumnos` : 'snapshot = null' }}</strong></div>
          <div><span>Solicitud $fetch</span><strong :class="summer.requestDiagnostic.value?.ok ? 'is-ok' : 'is-bad'">{{ summer.requestDiagnostic.value?.statusCode ?? 'sin estado' }} · {{ summer.requestDiagnostic.value?.durationMs ?? '—' }} ms</strong></div>
          <div><span>GET /snapshot directo</span><strong :class="rawProbes?.snapshot?.response?.ok ? 'is-ok' : 'is-bad'">{{ rawProbes?.snapshot?.response?.status ?? '—' }} · {{ rawProbes?.snapshot?.response?.studentsLength ?? '—' }} alumnos</strong></div>
          <div><span>DX servidor</span><strong :class="report ? 'is-ok' : 'is-bad'">{{ report ? `${completedChecks}/${report.checks.length} checks` : execution.stage }}</strong></div>
          <div><span>Filas Aurora directas</span><strong :class="Number((report as any)?.conclusion?.sourceRowsObservedDirectly || 0) > 0 ? 'is-ok' : 'is-bad'">{{ (report as any)?.conclusion?.sourceRowsObservedDirectly ?? '—' }}</strong></div>
          <div><span>Filas tras normalizar</span><strong :class="Number((report as any)?.conclusion?.sourceRowsAfterLoader || 0) > 0 ? 'is-ok' : 'is-bad'">{{ (report as any)?.conclusion?.sourceRowsAfterLoader ?? '—' }}</strong></div>
          <div><span>Límite que falla</span><strong>{{ (report as any)?.conclusion?.failureBoundary?.key || (report as any)?.conclusion?.nextBoundaryToInspect || '—' }}</strong></div>
        </div>

        <div v-if="summer.error.value || fetchError || execution.error" class="diagnostic-primary-error">
          <AlertTriangle :size="18" />
          <div><strong>Error completo</strong><span>{{ summer.error.value || fetchError || execution.error }}</span></div>
        </div>

        <div v-if="report?.checks.length" class="diagnostic-checks">
          <article v-for="check in report.checks" :key="check.key" :class="check.ok ? 'is-ok' : 'is-bad'">
            <span><Check v-if="check.ok" :size="14" /><X v-else :size="14" /></span>
            <div><strong>{{ check.label }}</strong><small>{{ check.latencyMs }} ms · {{ check.key }}</small></div>
            <code v-if="!check.ok">{{ (check.error as any)?.code || (check.error as any)?.statusCode || 'ERROR' }}</code>
          </article>
        </div>

        <label class="diagnostic-json-label" for="summer-diagnostic-json">JSON completo para copiar y pegar</label>
        <textarea
          id="summer-diagnostic-json"
          ref="jsonField"
          class="diagnostic-json"
          readonly
          spellcheck="false"
          :value="displayedJson"
          @focus="($event.target as HTMLTextAreaElement).select()"
        />

        <div class="diagnostic-actions diagnostic-actions--bottom">
          <button :disabled="copying" @click="copy"><LoaderCircle v-if="copying" :size="15" class="spin" /><Check v-else-if="copied" :size="15" /><Clipboard v-else :size="15" />{{ copying ? 'Esperando diagnóstico completo…' : copied ? 'Diagnóstico copiado' : 'Ejecutar prueba y copiar diagnóstico' }}</button>
        </div>
      </div>
    </details>
  </section>
</template>
