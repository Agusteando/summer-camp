<script setup lang="ts">
import { Cloud, CloudOff, Clock3, LoaderCircle, RefreshCw, Wifi, WifiOff } from '@lucide/vue'
const { browserOnline, sourceState, sourceName } = useConnectivity()
const { updating, pendingCount, refresh, snapshot } = useSummerData()
const effectiveSourceState = computed(() => snapshot.value?.meta.sourceReachable ? 'online' : sourceState.value)
const effectiveSourceName = computed(() => String(snapshot.value?.meta.source || sourceName.value || 'aurora').toLowerCase())
const sourceLabel = computed(() => {
  if (effectiveSourceState.value === 'checking') return 'Revisando'
  if (effectiveSourceState.value !== 'online') return 'Sin base'
  if (effectiveSourceName.value === 'mysql') return 'Base'
  if (effectiveSourceName.value === 'demo') return 'Demo'
  return 'Aurora'
})
const failedPlantelLabel = computed(() => {
  const failed = snapshot.value?.meta.failedPlanteles || []
  return failed.length ? `Datos parciales · faltan ${failed.join(', ')}` : ''
})
const cachedTime = computed(() => {
  const value = snapshot.value?.meta.generatedAt
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
})
const serverCache = computed(() => snapshot.value?.meta.serverCache || null)
const generatedAgeMs = computed(() => {
  const value = snapshot.value?.meta.generatedAt
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : 0
})
const edgeStaleVisible = computed(() => generatedAgeMs.value > 120000)
const backgroundRefresh = computed(() => Boolean(serverCache.value?.refreshing || serverCache.value?.state === 'stale-while-revalidate' || edgeStaleVisible.value))
const serverCacheLabel = computed(() => {
  const cache = serverCache.value
  if (cache?.state === 'stale-if-error') return `Últimos datos disponibles · ${cachedTime.value}`
  if (edgeStaleVisible.value) return `Datos de ${cachedTime.value} · verificando actualización`
  if (backgroundRefresh.value) return `Datos visibles · actualizando en segundo plano`
  return ''
})
</script>

<template>
  <header class="topbar">
    <div class="topbar__inner">
      <NuxtLink to="/" class="brand-lockup" aria-label="Summer Camp">
        <img src="/brand/iecs-iedis-logo.png" alt="IECS IEDIS" class="brand-lockup__logo">
        <div>
          <strong>Summer Camp</strong>
          <span>2026</span>
        </div>
      </NuxtLink>

      <div class="topbar__status">
        <span class="signal" :class="browserOnline ? 'signal--ok' : 'signal--bad'" :title="browserOnline ? 'Internet disponible' : 'Sin internet'">
          <Wifi v-if="browserOnline" :size="15" />
          <WifiOff v-else :size="15" />
          <small>{{ browserOnline ? 'Internet' : 'Sin red' }}</small>
        </span>
        <span class="signal" :class="effectiveSourceState === 'online' ? 'signal--ok' : effectiveSourceState === 'checking' ? 'signal--wait' : 'signal--bad'" :title="sourceLabel">
          <Cloud v-if="effectiveSourceState === 'online'" :size="15" />
          <LoaderCircle v-else-if="effectiveSourceState === 'checking'" :size="15" class="spin" />
          <CloudOff v-else :size="15" />
          <small>{{ sourceLabel }}</small>
        </span>
        <span v-if="pendingCount" class="queue-badge">{{ pendingCount }}</span>
        <button class="icon-button" :disabled="updating" aria-label="Actualizar" @click="refresh(true)">
          <LoaderCircle v-if="updating" :size="19" class="spin" />
          <RefreshCw v-else :size="19" />
        </button>
      </div>
    </div>
    <div v-if="snapshot?.meta.partial" class="cache-ribbon">
      <CloudOff :size="14" />
      <span>{{ failedPlantelLabel }}</span>
    </div>
    <div v-else-if="snapshot?.meta.cached || serverCacheLabel" class="cache-ribbon">
      <LoaderCircle v-if="updating || backgroundRefresh" :size="14" class="spin" />
      <Clock3 v-else :size="14" />
      <span>{{ serverCacheLabel || (updating ? 'Actualizando datos guardados' : `Datos guardados · ${cachedTime}`) }}</span>
    </div>
    <div v-if="updating" class="sync-line sync-line--active" />
  </header>
</template>
