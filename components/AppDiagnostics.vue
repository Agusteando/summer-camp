<script setup lang="ts">
import { Bug, Clipboard, RefreshCw } from '@lucide/vue'

const config = useRuntimeConfig()
const route = useRoute()
const summer = useSummerData()
const report = ref<Record<string, any> | null>(null)
const fetchError = ref<Record<string, any> | null>(null)
const loading = ref(false)
const copied = ref(false)
const capturedAt = ref(new Date().toISOString())
const details = ref<HTMLDetailsElement | null>(null)
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const enabled = computed(() => String(config.public.diagnosticsEnabled) !== 'false')
const hasFailure = computed(() => Boolean(summer.error.value || summer.requestDiagnostic.value?.ok === false || report.value?.ok === false))

const safeError = (cause: any) => ({
  name: cause?.name || null,
  message: cause?.data?.message || cause?.message || String(cause || 'Error desconocido'),
  code: cause?.data?.code || cause?.code || null,
  statusCode: cause?.statusCode || cause?.status || cause?.response?.status || null,
  statusMessage: cause?.statusMessage || cause?.response?.statusText || null,
  data: cause?.data || null,
  stack: cause?.stack || null
})

const payload = computed(() => ({
  dxVersion: 12,
  buildId: String(config.public.buildId || 'unknown'),
  capturedAt: capturedAt.value,
  purpose: 'Diagnóstico temporal de carga. Es observacional y no dispara consultas adicionales contra Aurora.',
  visibleProblem: {
    title: summer.snapshot.value ? null : 'No se pudo cargar la lista',
    message: summer.error.value || null
  },
  client: {
    route: route.fullPath,
    selectedDate: summer.selectedDate.value,
    online: import.meta.client ? navigator.onLine : null,
    loading: summer.loading.value,
    updating: summer.updating.value,
    snapshotPresent: Boolean(summer.snapshot.value),
    snapshotStudents: summer.snapshot.value?.students.length || 0,
    snapshotSummaries: summer.snapshot.value?.summaries.length || 0,
    snapshotMeta: summer.snapshot.value?.meta || null,
    loadLifecycle: summer.loadLifecycle.value,
    requestDiagnostic: summer.requestDiagnostic.value,
    recentTrace: summer.clientTrace.value.slice(-25)
  },
  server: report.value,
  diagnosticFetchError: fetchError.value
}))

const jsonText = computed(() => JSON.stringify(payload.value, null, 2))

const refresh = async () => {
  if (!enabled.value || loading.value) return
  loading.value = true
  fetchError.value = null
  try {
    report.value = await $fetch<Record<string, any>>('/api/summer/diagnostics', {
      query: { date: summer.selectedDate.value, _dx: Date.now() },
      cache: 'no-store',
      retry: 0,
      headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' }
    })
  } catch (cause: any) {
    fetchError.value = safeError(cause)
  } finally {
    capturedAt.value = new Date().toISOString()
    loading.value = false
  }
}

const copy = async () => {
  if (!report.value && !loading.value) await refresh()
  capturedAt.value = new Date().toISOString()
  try {
    await navigator.clipboard.writeText(jsonText.value)
  } catch {
    const field = document.createElement('textarea')
    field.value = jsonText.value
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    document.execCommand('copy')
    field.remove()
  }
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1800)
}

const scheduleRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => void refresh(), 250)
}

watch(() => summer.requestDiagnostic.value?.finishedAt, scheduleRefresh)
watch(hasFailure, (failed) => {
  if (failed) {
    nextTick(() => { if (details.value) details.value.open = true })
    scheduleRefresh()
  }
}, { immediate: true })

onMounted(() => {
  if (hasFailure.value) scheduleRefresh()
})

onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<template>
  <details v-if="enabled" ref="details" class="dx-panel">
    <summary>
      <span class="dx-panel__identity"><Bug :size="15" /> DX12 · Carga</span>
      <span :class="['dx-panel__status', hasFailure ? 'is-error' : 'is-ok']">
        {{ hasFailure ? 'Error capturado' : 'Sin falla activa' }}
      </span>
    </summary>

    <div class="dx-panel__body">
      <div class="dx-panel__actions">
        <button type="button" :disabled="loading" @click="refresh">
          <RefreshCw :size="15" :class="{ spin: loading }" />
          {{ loading ? 'Actualizando' : 'Actualizar DX' }}
        </button>
        <button type="button" class="is-primary" @click="copy">
          <Clipboard :size="15" />
          {{ copied ? 'Copiado' : 'Copiar DX' }}
        </button>
      </div>

      <p v-if="summer.error.value" class="dx-panel__error">{{ summer.error.value }}</p>
      <textarea readonly spellcheck="false" :value="jsonText" aria-label="Diagnóstico JSON completo" />
    </div>
  </details>
</template>

<style scoped>
.dx-panel {
  width: min(1180px, calc(100% - 24px));
  margin: 8px auto 0;
  border: 1px solid #c9d9e6;
  border-radius: 13px;
  background: #fff;
  color: #18364d;
  box-shadow: 0 5px 16px rgba(29, 73, 105, .06);
  overflow: hidden;
  position: relative;
  z-index: 3;
}
.dx-panel summary {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 11px;
  cursor: pointer;
  list-style: none;
  font-size: 12px;
  font-weight: 800;
}
.dx-panel summary::-webkit-details-marker { display: none; }
.dx-panel__identity { display: inline-flex; align-items: center; gap: 7px; }
.dx-panel__status { padding: 5px 8px; border-radius: 999px; background: #e9f7ee; color: #197344; }
.dx-panel__status.is-error { background: #ffe8e8; color: #a4232d; }
.dx-panel__body { border-top: 1px solid #dce7ef; padding: 10px; }
.dx-panel__actions { display: flex; gap: 8px; margin-bottom: 8px; }
.dx-panel button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid #bdd1df;
  border-radius: 9px;
  background: #fff;
  color: #164f79;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.dx-panel button.is-primary { background: #0c78c8; border-color: #0c78c8; color: #fff; }
.dx-panel button:disabled { opacity: .58; cursor: wait; }
.dx-panel__error { margin: 0 0 8px; padding: 8px 10px; border-radius: 8px; background: #fff1f1; color: #a4232d; font: 700 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
.dx-panel textarea {
  width: 100%;
  min-height: 220px;
  max-height: 54vh;
  resize: vertical;
  border: 0;
  border-radius: 9px;
  padding: 11px;
  background: #102d42;
  color: #eaf7ff;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
  outline: none;
}
.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .dx-panel { width: calc(100% - 16px); margin-top: 5px; }
  .dx-panel__actions { display: grid; grid-template-columns: 1fr 1fr; }
  .dx-panel textarea { min-height: 190px; }
}
</style>
