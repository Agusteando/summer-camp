<script setup lang="ts">
import { AlertTriangle, Bug, Check, ChevronDown, Clipboard, FileJson, LoaderCircle, RefreshCw, X } from '@lucide/vue'
import type { SummerDiagnosticsResponse } from '~/types/summer'

const config = useRuntimeConfig()
const route = useRoute()
const summer = useSummerData()
const connectivity = useConnectivity()
const report = useState<SummerDiagnosticsResponse | null>('summer-diagnostic-report', () => null)
const loading = useState('summer-diagnostic-loading', () => false)
const fetchError = useState<string | null>('summer-diagnostic-fetch-error', () => null)
const rawProbes = useState<Record<string, unknown> | null>('summer-diagnostic-raw-probes', () => null)
const browserContext = useState<Record<string, unknown> | null>('summer-diagnostic-browser-context', () => null)
const copied = ref(false)
const selected = ref(false)
const details = ref<HTMLDetailsElement | null>(null)
const jsonField = ref<HTMLTextAreaElement | null>(null)
let autoTimer: ReturnType<typeof setTimeout> | null = null

const enabled = computed(() => String(config.public.diagnosticsEnabled) !== 'false')
const snapshotOk = computed(() => summer.requestDiagnostic.value?.ok === true && Boolean(summer.snapshot.value))
const hasFailure = computed(() => Boolean(
  summer.error.value ||
  fetchError.value ||
  report.value?.ok === false ||
  (!summer.loading.value && !summer.snapshot.value)
))
const failedChecks = computed(() => report.value?.checks.filter((check) => !check.ok) || [])
const completedChecks = computed(() => report.value?.checks.filter((check) => check.ok).length || 0)
const primaryFinding = computed(() => (report.value as any)?.conclusion?.primaryFinding || null)

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
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      signal: controller.signal
    })
    const body = await response.text()
    let json: any = null
    let parseError: string | null = null
    try { json = body ? JSON.parse(body) : null } catch (cause: any) { parseError = cause?.message || String(cause) }
    const object = json && typeof json === 'object' && !Array.isArray(json) ? json : null
    return {
      request: { url: url.toString(), method: 'GET', credentials: 'same-origin', cache: 'no-store' },
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
        bodyPreview: !response.ok || parseError ? body.slice(0, 5000) : '[JSON válido omitido para no copiar datos personales; se reportan estructura, conteos y meta.]',
        jsonParsed: parseError === null,
        parseError,
        jsonType: json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json,
        topLevelKeys: object ? Object.keys(object).sort() : [],
        studentsIsArray: Array.isArray(object?.students),
        studentsLength: Array.isArray(object?.students) ? object.students.length : null,
        summariesIsArray: Array.isArray(object?.summaries),
        summariesLength: Array.isArray(object?.summaries) ? object.summaries.length : null,
        errorMessage: object?.message || object?.statusMessage || object?.data?.message || null,
        diagnostic: object?.data?.diagnostic || object?.diagnostic || null
      },
      parsedJson: json
    }
  } catch (cause: any) {
    return {
      request: { url: url.toString(), method: 'GET', credentials: 'same-origin', cache: 'no-store' },
      response: {
        ok: false,
        status: null,
        statusText: null,
        latencyMs: Math.round(performance.now() - started),
        networkError: {
          name: cause?.name || null,
          message: cause?.message || String(cause),
          stack: cause?.stack || null,
          cause: cause?.cause?.message || String(cause?.cause || '') || null,
          timeoutMs
        }
      },
      parsedJson: null
    }
  } finally {
    window.clearTimeout(timer)
  }
}

const collectBrowserContext = async () => {
  const registrations = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistrations().catch(() => [])
    : []
  const cacheNames = 'caches' in window ? await caches.keys().catch(() => []) : []
  const storage = (() => {
    try {
      return {
        snapshotKey: `summer-snapshot:v8:${summer.selectedDate.value}`,
        snapshotCharacters: localStorage.getItem(`summer-snapshot:v8:${summer.selectedDate.value}`)?.length || 0,
        allSummerKeys: Object.keys(localStorage).filter((key) => key.startsWith('summer-')).sort()
      }
    } catch (cause: any) {
      return { error: cause?.message || String(cause) }
    }
  })()

  return {
    capturedAt: new Date().toISOString(),
    page: { href: window.location.href, origin: window.location.origin, route: route.fullPath, protocol: window.location.protocol },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      visibilityState: document.visibilityState,
      cookiesEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency || null
    },
    serviceWorker: {
      supported: 'serviceWorker' in navigator,
      controlled: Boolean(navigator.serviceWorker?.controller),
      controllerScriptUrl: navigator.serviceWorker?.controller?.scriptURL || null,
      controllerState: navigator.serviceWorker?.controller?.state || null,
      registrations: registrations.map((registration) => ({
        scope: registration.scope,
        active: registration.active ? { scriptURL: registration.active.scriptURL, state: registration.active.state } : null,
        waiting: registration.waiting ? { scriptURL: registration.waiting.scriptURL, state: registration.waiting.state } : null,
        installing: registration.installing ? { scriptURL: registration.installing.scriptURL, state: registration.installing.state } : null
      })),
      cacheNames
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

const reportPayload = computed(() => ({
  dxVersion: 8,
  purpose: 'Diagnóstico temporal de la carga de alumnos. Copiar este objeto completo.',
  capturedAt: new Date().toISOString(),
  visibleProblem: {
    title: !summer.snapshot.value && !summer.loading.value ? 'No se pudo cargar la lista' : null,
    message: summer.error.value || (!summer.snapshot.value && !summer.loading.value ? 'La solicitud terminó sin datos.' : null)
  },
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
    requestDiagnostic: summer.requestDiagnostic.value,
    clientTrace: summer.clientTrace.value
  },
  directBrowserProbes: rawProbes.value,
  serverDiagnostic: report.value,
  diagnosticFetchError: fetchError.value
}))
const formatted = computed(() => JSON.stringify(reportPayload.value, null, 2))

const run = async () => {
  if (!enabled.value || loading.value || !import.meta.client) return
  loading.value = true
  fetchError.value = null
  selected.value = false
  try {
    browserContext.value = await collectBrowserContext()
    const date = encodeURIComponent(summer.selectedDate.value)
    const [snapshotProbe, diagnosticsProbe] = await Promise.all([
      endpointProbe(`/api/summer/snapshot?date=${date}`, 45000),
      endpointProbe(`/api/summer/diagnostics?date=${date}`, 90000)
    ])
    rawProbes.value = {
      snapshot: { request: snapshotProbe.request, response: snapshotProbe.response },
      diagnostics: { request: diagnosticsProbe.request, response: diagnosticsProbe.response }
    }
    const candidate = diagnosticsProbe.parsedJson
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.checks)) {
      report.value = candidate as SummerDiagnosticsResponse
    } else {
      report.value = null
      fetchError.value = `El endpoint de diagnóstico no devolvió SummerDiagnosticsResponse. HTTP ${diagnosticsProbe.response.status ?? 'sin estado'}; JSON=${diagnosticsProbe.response.jsonParsed ?? false}.`
    }
  } catch (cause: any) {
    fetchError.value = cause?.data?.message || cause?.message || 'No se pudo ejecutar el diagnóstico.'
  } finally {
    browserContext.value = await collectBrowserContext().catch(() => browserContext.value)
    loading.value = false
    await nextTick()
    if (details.value) details.value.open = true
  }
}

const selectAll = () => {
  jsonField.value?.focus()
  jsonField.value?.select()
  selected.value = true
}

const copy = async () => {
  let success = false
  try {
    await navigator.clipboard.writeText(formatted.value)
    success = true
  } catch {
    try {
      selectAll()
      success = document.execCommand('copy')
    } catch {}
  }
  copied.value = success
  if (!success) selectAll()
  setTimeout(() => { copied.value = false }, 1800)
}

const scheduleAutoRun = () => {
  if (autoTimer) clearTimeout(autoTimer)
  autoTimer = setTimeout(() => {
    if (!summer.loading.value && !summer.snapshot.value) void run()
  }, 900)
}

watch(() => [summer.loading.value, Boolean(summer.snapshot.value), summer.error.value] as const, ([isLoading, hasSnapshot]: readonly [boolean, boolean, string | null]) => {
  if (!isLoading && !hasSnapshot) scheduleAutoRun()
}, { immediate: true })
watch(() => summer.selectedDate.value, () => {
  report.value = null
  rawProbes.value = null
  browserContext.value = null
  scheduleAutoRun()
})

onMounted(() => scheduleAutoRun())
onBeforeUnmount(() => { if (autoTimer) clearTimeout(autoTimer) })
</script>

<template>
  <section v-if="enabled" class="diagnostic-shell" :class="{ 'diagnostic-shell--error': hasFailure }">
    <details ref="details" class="diagnostic-panel" :open="hasFailure">
      <summary>
        <span class="diagnostic-panel__icon"><Bug :size="16" /></span>
        <span class="diagnostic-panel__title">
          <strong>DX · Carga de alumnos</strong>
          <small v-if="loading">Probando navegador, /snapshot, Aurora, normalización y resultado final…</small>
          <small v-else-if="primaryFinding">{{ primaryFinding.code }} · {{ primaryFinding.message }}</small>
          <small v-else-if="hasFailure">Sin lista: abre, ejecuta y copia el bloque completo</small>
          <small v-else-if="report">{{ completedChecks }}/{{ report.checks.length }} límites correctos</small>
          <small v-else>Prueba completa disponible</small>
        </span>
        <span class="diagnostic-panel__state" :class="hasFailure ? 'is-bad' : snapshotOk ? 'is-ok' : 'is-idle'">
          <LoaderCircle v-if="loading" :size="14" class="spin" />
          <X v-else-if="hasFailure" :size="14" />
          <Check v-else-if="snapshotOk" :size="14" />
          <ChevronDown v-else :size="14" />
          {{ loading ? 'Probando' : hasFailure ? 'Falla' : snapshotOk ? 'Lista OK' : 'Revisar' }}
        </span>
      </summary>

      <div class="diagnostic-panel__body">
        <div class="diagnostic-focus">
          <AlertTriangle :size="18" />
          <div>
            <strong>Problema actual</strong>
            <span>{{ summer.error.value || (!summer.snapshot.value && !summer.loading.value ? 'La solicitud terminó sin datos y el estado cliente quedó sin snapshot.' : 'Validando la carga actual.') }}</span>
          </div>
        </div>

        <div class="diagnostic-actions diagnostic-actions--sticky">
          <button :disabled="loading" @click="run">
            <LoaderCircle v-if="loading" :size="15" class="spin" />
            <RefreshCw v-else :size="15" />
            Ejecutar prueba completa
          </button>
          <button @click="copy"><Check v-if="copied" :size="15" /><Clipboard v-else :size="15" />{{ copied ? 'Copiado' : 'Copiar todo' }}</button>
          <button @click="selectAll"><FileJson :size="15" />{{ selected ? 'Seleccionado' : 'Seleccionar JSON' }}</button>
        </div>

        <div class="diagnostic-summary-grid">
          <div>
            <span>Estado cliente</span>
            <strong :class="summer.snapshot.value ? 'is-ok' : 'is-bad'">{{ summer.snapshot.value ? `${summer.snapshot.value.students.length} alumnos` : 'snapshot = null' }}</strong>
          </div>
          <div>
            <span>Solicitud $fetch</span>
            <strong :class="summer.requestDiagnostic.value?.ok ? 'is-ok' : 'is-bad'">{{ summer.requestDiagnostic.value?.statusCode ?? 'sin estado' }} · {{ summer.requestDiagnostic.value?.durationMs ?? '—' }} ms</strong>
          </div>
          <div>
            <span>GET /snapshot directo</span>
            <strong :class="(rawProbes as any)?.snapshot?.response?.ok ? 'is-ok' : 'is-bad'">{{ (rawProbes as any)?.snapshot?.response?.status ?? '—' }} · {{ (rawProbes as any)?.snapshot?.response?.studentsLength ?? '—' }} alumnos</strong>
          </div>
          <div>
            <span>Filas Aurora directas</span>
            <strong :class="Number((report as any)?.conclusion?.sourceRowsObservedDirectly || 0) > 0 ? 'is-ok' : 'is-bad'">{{ (report as any)?.conclusion?.sourceRowsObservedDirectly ?? '—' }}</strong>
          </div>
          <div>
            <span>Filas tras normalizar</span>
            <strong :class="Number((report as any)?.conclusion?.sourceRowsAfterLoader || 0) > 0 ? 'is-ok' : 'is-bad'">{{ (report as any)?.conclusion?.sourceRowsAfterLoader ?? '—' }}</strong>
          </div>
          <div>
            <span>Siguiente límite</span>
            <strong>{{ (report as any)?.conclusion?.nextBoundaryToInspect || '—' }}</strong>
          </div>
        </div>

        <div v-if="summer.error.value || fetchError" class="diagnostic-primary-error">
          <AlertTriangle :size="18" />
          <div><strong>Error completo</strong><span>{{ summer.error.value || fetchError }}</span></div>
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
          :value="formatted"
          @focus="($event.target as HTMLTextAreaElement).select()"
        />

        <div class="diagnostic-actions diagnostic-actions--bottom">
          <button @click="copy"><Check v-if="copied" :size="15" /><Clipboard v-else :size="15" />{{ copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico completo' }}</button>
        </div>
      </div>
    </details>
  </section>
</template>
