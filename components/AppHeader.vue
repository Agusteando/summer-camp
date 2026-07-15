<script setup lang="ts">
import { Cloud, CloudOff, Clock3, LoaderCircle, RefreshCw, Wifi, WifiOff } from '@lucide/vue'
const { browserOnline, sourceState, sourceName } = useConnectivity()
const { updating, pendingCount, refresh, snapshot } = useSummerData()
const sourceLabel = computed(() => {
  if (sourceState.value === 'checking') return 'Revisando'
  if (sourceState.value !== 'online') return 'Sin base'
  if (sourceName.value === 'mysql') return 'Base'
  if (sourceName.value === 'demo') return 'Demo'
  return 'Aurora'
})
const cachedTime = computed(() => {
  const value = snapshot.value?.meta.generatedAt
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
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
        <span class="signal" :class="sourceState === 'online' ? 'signal--ok' : sourceState === 'checking' ? 'signal--wait' : 'signal--bad'" :title="sourceLabel">
          <Cloud v-if="sourceState === 'online'" :size="15" />
          <LoaderCircle v-else-if="sourceState === 'checking'" :size="15" class="spin" />
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
    <div v-if="snapshot?.meta.cached" class="cache-ribbon">
      <LoaderCircle v-if="updating" :size="14" class="spin" />
      <Clock3 v-else :size="14" />
      <span>{{ updating ? 'Actualizando datos guardados' : `Datos guardados · ${cachedTime}` }}</span>
    </div>
    <div v-if="updating" class="sync-line sync-line--active" />
  </header>
</template>
