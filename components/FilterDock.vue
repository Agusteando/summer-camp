<script setup lang="ts">
import { MapPin, Search, SlidersHorizontal, X } from '@lucide/vue'
import { AGE_GROUPS } from '~/shared/catalog'
import type { PlantelSummary } from '~/types/summer'

const props = defineProps<{
  search: string
  group: string
  program: string
  plantel: string
  planteles: PlantelSummary[]
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:group': [value: string]
  'update:program': [value: string]
  'update:plantel': [value: string]
}>()
</script>

<template>
  <section class="filter-dock">
    <label class="search-box">
      <Search :size="19" />
      <input :value="search" type="search" placeholder="Buscar alumno" autocomplete="off" @input="emit('update:search', ($event.target as HTMLInputElement).value)">
      <button v-if="search" aria-label="Limpiar" @click="emit('update:search', '')"><X :size="17" /></button>
    </label>

    <div class="filter-row filter-row--plantel">
      <MapPin :size="16" />
      <div class="filter-row__scroll">
        <button :class="{ 'is-active': plantel === 'all' }" @click="emit('update:plantel', 'all')">Todos los planteles</button>
        <button v-for="item in planteles" :key="item.plantel" :class="{ 'is-active': plantel === item.plantel }" @click="emit('update:plantel', item.plantel)">
          {{ item.plantel }} <b>{{ item.total }}</b>
        </button>
      </div>
    </div>

    <div class="filter-row">
      <img class="filter-row__mascot" src="/icons/abejas.png" alt="">
      <div class="filter-row__scroll">
        <button :class="{ 'is-active': group === 'all' }" @click="emit('update:group', 'all')">Todas las edades</button>
        <button v-for="item in AGE_GROUPS" :key="item.key" :class="{ 'is-active': group === item.key }" @click="emit('update:group', item.key)">
          {{ item.label }}
        </button>
        <button :class="{ 'is-active': group === 'missing-age' }" @click="emit('update:group', 'missing-age')">Sin edad</button>
      </div>
    </div>

    <div class="filter-row filter-row--program">
      <SlidersHorizontal :size="16" />
      <div class="filter-row__scroll">
        <button :class="{ 'is-active': program === 'all' }" @click="emit('update:program', 'all')">Todos los programas</button>
        <button :class="{ 'is-active': program === 'husky_dreamers' }" @click="emit('update:program', 'husky_dreamers')">Husky</button>
        <button :class="{ 'is-active': program === 'clinica_futbol' }" @click="emit('update:program', 'clinica_futbol')">Fútbol</button>
        <button :class="{ 'is-active': program === 'unassigned' }" @click="emit('update:program', 'unassigned')">Pendientes</button>
      </div>
    </div>
  </section>
</template>
