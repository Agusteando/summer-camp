<script setup lang="ts">
import { Coffee, Moon, RotateCcw, Search, SlidersHorizontal, Timer, Utensils, X } from '@lucide/vue'
import { AGE_GROUPS } from '~/shared/catalog'

const props = defineProps<{
  search: string
  group: string
  program: string
  service: string
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:group': [value: string]
  'update:program': [value: string]
  'update:service': [value: string]
}>()

const activeCount = computed(() => [props.group, props.program, props.service].filter((value) => value !== 'all').length)
const reset = () => {
  emit('update:group', 'all')
  emit('update:program', 'all')
  emit('update:service', 'all')
}
</script>

<template>
  <section class="filter-dock">
    <div class="filter-dock__top">
      <label class="search-box">
        <Search :size="19" />
        <input :value="search" type="search" placeholder="Buscar por nombre o folio" autocomplete="off" @input="emit('update:search', ($event.target as HTMLInputElement).value)">
        <button v-if="search" aria-label="Limpiar búsqueda" @click="emit('update:search', '')"><X :size="17" /></button>
      </label>

      <details class="filter-sheet">
        <summary>
          <SlidersHorizontal :size="18" />
          <span>Filtros</span>
          <b v-if="activeCount">{{ activeCount }}</b>
        </summary>
        <div class="filter-sheet__body">
          <div class="filter-group">
            <strong>Edad</strong>
            <div class="filter-chips">
              <button :class="{ 'is-active': group === 'all' }" @click="emit('update:group', 'all')">Todas</button>
              <button v-for="item in AGE_GROUPS" :key="item.key" :class="{ 'is-active': group === item.key }" @click="emit('update:group', item.key)">{{ item.label }}</button>
              <button :class="{ 'is-active': group === 'missing-age' }" @click="emit('update:group', 'missing-age')">Sin edad</button>
            </div>
          </div>

          <div class="filter-group">
            <strong>Programa</strong>
            <div class="filter-chips">
              <button :class="{ 'is-active': program === 'all' }" @click="emit('update:program', 'all')">Todos</button>
              <button :class="{ 'is-active': program === 'husky_dreamers' }" @click="emit('update:program', 'husky_dreamers')">Husky Dreamers</button>
              <button :class="{ 'is-active': program === 'clinica_futbol' }" @click="emit('update:program', 'clinica_futbol')">Fútbol</button>
            </div>
          </div>

          <div class="filter-group">
            <strong>Servicio</strong>
            <div class="filter-chips">
              <button :class="{ 'is-active': service === 'all' }" @click="emit('update:service', 'all')">Todos</button>
              <button :class="{ 'is-active': service === 'breakfast' }" @click="emit('update:service', 'breakfast')"><Coffee :size="14" />Desayuno</button>
              <button :class="{ 'is-active': service === 'lunch' }" @click="emit('update:service', 'lunch')"><Utensils :size="14" />Comida</button>
              <button :class="{ 'is-active': service === 'dinner' }" @click="emit('update:service', 'dinner')"><Moon :size="14" />Cena</button>
              <button :class="{ 'is-active': service === 'extendedTime' }" @click="emit('update:service', 'extendedTime')"><Timer :size="14" />Extendido</button>
            </div>
          </div>

          <button v-if="activeCount" class="filter-reset" @click="reset"><RotateCcw :size="15" />Limpiar</button>
        </div>
      </details>
    </div>
  </section>
</template>
