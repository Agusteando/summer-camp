<script setup lang="ts">
import { AlertTriangle, Bug, Check, ChevronDown, Clipboard, LoaderCircle, RefreshCw, X } from '@lucide/vue'
import type { SummerDiagnosticsResponse } from '~/types/summer'

const config = useRuntimeConfig()
const summer = useSummerData()
const connectivity = useConnectivity()
const report = useState<SummerDiagnosticsResponse | null>('summer-diagnostic-report', () => null)
const loading = useState('summer-diagnostic-loading', () => false)
const fetchError = useState<string | null>('summer-diagnostic-fetch-error', () => null)
const copied = ref(false)
const details = ref<HTMLDetailsElement | null>(null)

const enabled = computed(() => String(config.public.diagnosticsEnabled) !== 'false')
const snapshotOk = computed(() => summer.requestDiagnostic.value?.ok === true)
const hasFailure = computed(() => Boolean(summer.error.value || fetchError.value || report.value?.ok === false))
const failedChecks = computed(() => report.value?.checks.filter((check) => !check.ok) || [])
const completedChecks = computed(() => report.value?.checks.filter((check) => check.ok).length || 0)
const reportPayload = computed(() => ({
  client: {
    browserOnline: connectivity.browserOnline.value,
    sourceState: connectivity.sourceState.value,
    appState: connectivity.appState.value,
    sourceName: connectivity.sourceName.value,
    healthLatencyMs: connectivity.latencyMs.value,
    healthCheckedAt: connectivity.checkedAt.value,
    snapshotError: summer.error.value,
    snapshotRequest: summer.requestDiagnostic.value,
    selectedDate: summer.selectedDate.value,
    cachedSnapshot: summer.snapshot.value?.meta.cached || false,
    cachedStudents: summer.snapshot.value?.students.length || 0
  },
  server: report.value,
  diagnosticFetchError: fetchError.value
}))
const formatted = computed(() => JSON.stringify(reportPayload.value, null, 2))

const run = async () => {
  if (!enabled.value || loading.value) return
  loading.value = true
  fetchError.value = null
  try {
    report.value = await $fetch<SummerDiagnosticsResponse>('/api/summer/diagnostics', {
      query: { date: summer.selectedDate.value },
      cache: 'no-store',
      retry: 0
    })
  } catch (cause: any) {
    fetchError.value = cause?.data?.message || cause?.message || 'No se pudo ejecutar el diagnóstico.'
  } finally {
    loading.value = false
    if (hasFailure.value) await nextTick(() => { if (details.value) details.value.open = true })
  }
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(formatted.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch {}
}

watch(() => summer.error.value, (value) => {
  if (value) void run()
})
watch(() => summer.selectedDate.value, () => {
  report.value = null
})

onMounted(() => {
  if (summer.error.value) void run()
})
</script>

<template>
  <section v-if="enabled" class="diagnostic-shell" :class="{ 'diagnostic-shell--error': hasFailure }">
    <details ref="details" class="diagnostic-panel" :open="hasFailure">
      <summary>
        <span class="diagnostic-panel__icon"><Bug :size="16" /></span>
        <span class="diagnostic-panel__title">
          <strong>Diagnóstico temporal</strong>
          <small v-if="loading">Ejecutando pruebas…</small>
          <small v-else-if="hasFailure">{{ failedChecks.length || 1 }} falla(s) detectada(s)</small>
          <small v-else-if="report">{{ completedChecks }}/{{ report.checks.length }} pruebas correctas</small>
          <small v-else>Disponible para validar la carga</small>
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
        <div class="diagnostic-actions">
          <button :disabled="loading" @click="run">
            <LoaderCircle v-if="loading" :size="15" class="spin" />
            <RefreshCw v-else :size="15" />
            Ejecutar diagnóstico
          </button>
          <button @click="copy"><Check v-if="copied" :size="15" /><Clipboard v-else :size="15" />{{ copied ? 'Copiado' : 'Copiar JSON' }}</button>
        </div>

        <div class="diagnostic-summary-grid">
          <div>
            <span>Solicitud de lista</span>
            <strong :class="summer.requestDiagnostic.value?.ok ? 'is-ok' : summer.requestDiagnostic.value ? 'is-bad' : ''">
              {{ summer.requestDiagnostic.value?.statusCode || '—' }} · {{ summer.requestDiagnostic.value?.durationMs ?? '—' }} ms
            </strong>
          </div>
          <div>
            <span>Fuente externa</span>
            <strong :class="connectivity.sourceState.value === 'online' ? 'is-ok' : 'is-bad'">{{ connectivity.sourceState.value }}</strong>
          </div>
          <div>
            <span>MySQL app</span>
            <strong :class="connectivity.appState.value === 'online' ? 'is-ok' : 'is-bad'">{{ connectivity.appState.value }}</strong>
          </div>
          <div>
            <span>Alumnos en caché</span>
            <strong>{{ summer.snapshot.value?.students.length || 0 }}</strong>
          </div>
        </div>

        <div v-if="summer.error.value" class="diagnostic-primary-error">
          <AlertTriangle :size="18" />
          <div><strong>Error de carga</strong><span>{{ summer.error.value }}</span></div>
        </div>

        <div v-if="report?.checks.length" class="diagnostic-checks">
          <article v-for="check in report.checks" :key="check.key" :class="check.ok ? 'is-ok' : 'is-bad'">
            <span><Check v-if="check.ok" :size="14" /><X v-else :size="14" /></span>
            <div><strong>{{ check.label }}</strong><small>{{ check.latencyMs }} ms · {{ check.key }}</small></div>
            <code v-if="!check.ok">{{ check.error?.code || check.error?.statusCode || 'ERROR' }}</code>
          </article>
        </div>

        <pre class="diagnostic-json">{{ formatted }}</pre>
      </div>
    </details>
  </section>
</template>
