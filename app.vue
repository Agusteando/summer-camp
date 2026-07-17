<template>
  <ClientOnly>
    <NuxtLayout><NuxtPage /></NuxtLayout>
    <template #fallback><div class="app-boot" aria-label="Cargando" /></template>
  </ClientOnly>
</template>
