<script setup lang="ts">
import { Search, SlidersHorizontal, X } from '@lucide/vue'
import { AGE_GROUPS } from '~/shared/catalog'
const props = defineProps<{ search: string; group: string; program: string }>()
const emit = defineEmits<{ 'update:search': [value: string]; 'update:group': [value: string]; 'update:program': [value: string] }>()
</script>

<template>
  <section class="filter-dock">
    <label class="search-box">
      <Search :size="19" />
      <input :value="search" type="search" placeholder="Buscar alumno" autocomplete="off" @input="emit('update:search', ($event.target as HTMLInputElement).value)">
      <button v-if="search" aria-label="Limpiar" @click="emit('update:search', '')"><X :size="17" /></button>
    </label>
    <div class="segmented-scroll">
      <button :class="{ 'is-active': group === 'all' }" @click="emit('update:group', 'all')">Todos</button>
      <button v-for="item in AGE_GROUPS" :key="item.key" :class="{ 'is-active': group === item.key }" @click="emit('update:group', item.key)">
        <img :src="item.icon" alt=""> {{ item.label }}
      </button>
      <button :class="{ 'is-active': group === 'missing-age' }" @click="emit('update:group', 'missing-age')">Sin edad</button>
    </div>
    <div class="program-pills">
      <SlidersHorizontal :size="16" />
      <button :class="{ 'is-active': program === 'all' }" @click="emit('update:program', 'all')">Ambos</button>
      <button :class="{ 'is-active': program === 'husky_dreamers' }" @click="emit('update:program', 'husky_dreamers')">Husky</button>
      <button :class="{ 'is-active': program === 'clinica_futbol' }" @click="emit('update:program', 'clinica_futbol')">Fútbol</button>
      <button :class="{ 'is-active': program === 'unassigned' }" @click="emit('update:program', 'unassigned')">Pendientes</button>
    </div>
  </section>
</template>
