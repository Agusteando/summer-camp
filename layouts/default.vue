<script setup lang="ts">
const connectivity = useConnectivity()
onMounted(() => connectivity.start())
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <AppDiagnostics />
    <main class="app-main">
      <slot />
    </main>
    <BottomNav />
  </div>
</template>
