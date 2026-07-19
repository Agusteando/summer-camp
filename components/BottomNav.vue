<script setup lang="ts">
import { ClipboardCheck, List } from '@lucide/vue'
const route = useRoute()
const items = [
  { to: '/', label: 'Lista', icon: List },
  { to: '/attendance', label: 'Asistencia', icon: ClipboardCheck }
]
</script>

<template>
  <nav class="bottom-nav" aria-label="Navegación principal">
    <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="bottom-nav__item" :class="{ 'is-active': route.path === item.to }">
      <component :is="item.icon" :size="22" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
