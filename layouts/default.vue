<script setup lang="ts">
const connectivity = useConnectivity()
onMounted(() => connectivity.start())
onBeforeUnmount(() => connectivity.stop())
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main"><slot /></main>
    <BottomNav />
  </div>
</template>
