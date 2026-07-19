<script setup lang="ts">
const connectivity = useConnectivity()
const scope = useSummerScope()
scope.initialize()

onMounted(() => connectivity.start())
onBeforeUnmount(() => connectivity.stop())
</script>

<template>
  <div class="app-shell" :class="{ 'has-bottom-nav': scope.ready.value }">
    <AppHeader />
    <main class="app-main"><slot /></main>
    <BottomNav v-if="scope.ready.value" />
  </div>
</template>
