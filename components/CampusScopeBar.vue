<script setup lang="ts">
import { MapPin, School2 } from '@lucide/vue'
import { plantelSortIndex } from '~/shared/catalog'
import type { CampusFilter, CampusName, PlantelSummary } from '~/types/summer'

const props = defineProps<{
  summaries: PlantelSummary[]
  selectedCampus: CampusFilter
  selectedPlantel: string
}>()

const emit = defineEmits<{
  campus: [campus: CampusFilter]
  plantel: [plantel: string]
}>()

const campusOrder: CampusName[] = ['Toluca', 'Metepec']
const campusTotals = computed(() => campusOrder.map((campus) => ({
  campus,
  total: props.summaries.filter((summary) => summary.campus === campus).reduce((sum, item) => sum + item.total, 0)
})))
const visiblePlanteles = computed(() => props.summaries
  .filter((summary) => props.selectedCampus === 'all' || summary.campus === props.selectedCampus)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel)))
</script>

<template>
  <section class="scope-bar">
    <div class="scope-bar__campuses">
      <button :class="{ 'is-active': selectedCampus === 'all' }" @click="emit('campus', 'all')">
        <School2 :size="17" /><span>Ambos campus</span><b>{{ summaries.reduce((sum, item) => sum + item.total, 0) }}</b>
      </button>
      <button v-for="item in campusTotals" :key="item.campus" :class="{ 'is-active': selectedCampus === item.campus }" @click="emit('campus', item.campus)">
        <span>{{ item.campus }}</span><b>{{ item.total }}</b>
      </button>
    </div>
    <div class="scope-bar__planteles">
      <MapPin :size="15" />
      <button :class="{ 'is-active': selectedPlantel === 'all' }" @click="emit('plantel', 'all')">Todos</button>
      <button v-for="item in visiblePlanteles" :key="item.plantel" :class="{ 'is-active': selectedPlantel === item.plantel }" @click="emit('plantel', item.plantel)">
        {{ item.plantel }} <b>{{ item.total }}</b>
      </button>
    </div>
  </section>
</template>
