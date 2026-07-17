<script setup lang="ts">
import { Cloud, CloudOff, LoaderCircle, RefreshCw, Wifi, WifiOff } from '@lucide/vue'

const connectivity = useConnectivity()
const summer = useSummerData()

const sourceOnline = computed(() => summer.snapshot.value?.meta.sourceReachable || connectivity.sourceState.value === 'online')
const syncedAt = computed(() => {
  const value = summer.snapshot.value?.meta.sourceGeneratedAt
  if (!value) return ''
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
})
</script>

<template>
  <header class="topbar">
    <div class="topbar__inner">
      <NuxtLink to="/" class="brand-lockup" aria-label="Summer Camp">
        <img src="/brand/iecs-iedis-logo.png" alt="IECS IEDIS">
        <div><strong>Summer Camp</strong><span>2026</span></div>
      </NuxtLink>

      <div class="topbar__status">
        <span class="status-pill" :class="connectivity.browserOnline.value ? 'is-online' : 'is-offline'">
          <Wifi v-if="connectivity.browserOnline.value" :size="14" />
          <WifiOff v-else :size="14" />
          {{ connectivity.browserOnline.value ? 'En línea' : 'Sin conexión' }}
        </span>
        <span class="status-pill" :class="sourceOnline ? 'is-online' : 'is-offline'">
          <Cloud v-if="sourceOnline" :size="14" />
          <CloudOff v-else :size="14" />
          {{ sourceOnline ? `Hoja ${syncedAt || ''}` : 'Hoja no disponible' }}
        </span>
        <button class="icon-button" :disabled="summer.updating.value" aria-label="Actualizar datos" @click="summer.refresh(true)">
          <LoaderCircle v-if="summer.updating.value" class="spin" :size="19" />
          <RefreshCw v-else :size="19" />
        </button>
      </div>
    </div>
  </header>
</template>
