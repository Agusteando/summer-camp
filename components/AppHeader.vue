<script setup lang="ts">
import { CloudOff, LoaderCircle, RefreshCw, WifiOff } from '@lucide/vue'

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
        <span class="brand-lockup__mark"><img src="/brand/iecs-iedis-logo.png" alt="IECS IEDIS"></span>
        <div class="brand-lockup__name"><strong>Summer Camp</strong><span>26</span></div>
      </NuxtLink>

      <div class="topbar__actions">
        <span
          class="sync-mark"
          :class="{ 'is-offline': !connectivity.browserOnline.value || !sourceOnline }"
          :title="!connectivity.browserOnline.value ? 'Sin conexión' : sourceOnline ? `Sincronizado ${syncedAt}` : 'Hoja no disponible'"
        >
          <WifiOff v-if="!connectivity.browserOnline.value" :size="15" />
          <CloudOff v-else-if="!sourceOnline" :size="15" />
          <i v-else />
          <b>{{ !connectivity.browserOnline.value ? 'Offline' : sourceOnline ? syncedAt || 'Live' : 'Error' }}</b>
        </span>
        <button class="icon-button" type="button" :disabled="summer.updating.value" aria-label="Actualizar lista" @click="summer.refresh(true)">
          <LoaderCircle v-if="summer.updating.value" class="spin" :size="19" />
          <RefreshCw v-else :size="19" />
        </button>
      </div>
    </div>
  </header>
</template>
