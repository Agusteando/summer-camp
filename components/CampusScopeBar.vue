<script setup lang="ts">
import { Building2, Check, MapPin, School2 } from '@lucide/vue'
import { plantelSortIndex } from '~/shared/catalog'
import type { CampusFilter, CampusName, PlantelSummary } from '~/types/summer'

const props = defineProps<{
  summaries: PlantelSummary[]
  selectedCampus: CampusFilter
  selectedPlantel: string
}>()

const emit = defineEmits<{
  campus: [campus: CampusName]
  plantel: [plantel: string]
}>()

const campusOrder: CampusName[] = ['Toluca', 'Metepec']
const campusMeta: Record<CampusName, { code: string }> = {
  Toluca: { code: 'TOL' },
  Metepec: { code: 'MET' }
}

const campusTotals = computed(() => campusOrder.map((campus) => {
  const rows = props.summaries.filter((summary) => summary.campus === campus)
  return {
    campus,
    ...campusMeta[campus],
    total: rows.reduce((sum, item) => sum + item.total, 0),
    planteles: rows.sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel))
  }
}))

const visiblePlanteles = computed(() => {
  if (!props.selectedCampus) return []
  return props.summaries
    .filter((summary) => summary.campus === props.selectedCampus)
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel))
})
</script>

<template>
  <section class="campus-entry" aria-label="Campus">
    <header class="campus-entry__heading">
      <span><Building2 :size="18" /> Selecciona campus</span>
    </header>

    <div class="campus-entry__grid">
      <button
        v-for="item in campusTotals"
        :key="item.campus"
        class="campus-card"
        :class="{ 'is-active': selectedCampus === item.campus }"
        @click="emit('campus', item.campus)"
      >
        <span class="campus-card__illustration"><School2 :size="46" :stroke-width="1.3" /></span>
        <div>
          <strong>{{ item.campus }}</strong>
          <small>{{ item.total }} alumnos</small>
        </div>
        <span class="campus-card__check"><Check v-if="selectedCampus === item.campus" :size="16" /></span>
      </button>
    </div>

    <div v-if="selectedCampus" class="plantel-strip">
      <Building2 :size="16" />
      <strong>Plantel</strong>
      <button :class="{ 'is-active': selectedPlantel === 'all' }" @click="emit('plantel', 'all')">Todos</button>
      <button
        v-for="item in visiblePlanteles"
        :key="item.plantel"
        :class="{ 'is-active': selectedPlantel === item.plantel }"
        @click="emit('plantel', item.plantel)"
      >
        <MapPin :size="13" />{{ item.plantel }}
      </button>
    </div>
  </section>
</template>
