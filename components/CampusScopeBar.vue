<script setup lang="ts">
import { Building2, ChevronDown, MapPin, Sparkles } from '@lucide/vue'
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
const campusMeta: Record<CampusName, { code: string; accent: string }> = {
  Toluca: { code: 'TOL', accent: 'blue' },
  Metepec: { code: 'MET', accent: 'coral' }
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
  <section v-if="!selectedCampus" class="campus-entry" aria-label="Campus">
    <header class="campus-entry__heading">
      <span><Sparkles :size="16" /> Campus</span>
    </header>
    <div class="campus-entry__grid">
      <button
        v-for="item in campusTotals"
        :key="item.campus"
        class="campus-card"
        :class="`campus-card--${item.accent}`"
        @click="emit('campus', item.campus)"
      >
        <span class="campus-card__code">{{ item.code }}</span>
        <div>
          <strong>{{ item.campus }}</strong>
          <small>{{ item.planteles.map((row) => row.plantel).join(' · ') }}</small>
        </div>
        <b>{{ item.total }}</b>
        <ChevronDown :size="20" />
      </button>
    </div>
  </section>

  <section v-else class="scope-panel">
    <div class="campus-tabs" role="tablist" aria-label="Campus">
      <button
        v-for="item in campusTotals"
        :key="item.campus"
        :class="[`campus-tab--${item.accent}`, { 'is-active': selectedCampus === item.campus }]"
        @click="emit('campus', item.campus)"
      >
        <span>{{ item.campus }}</span>
        <b>{{ item.total }}</b>
      </button>
    </div>

    <div class="plantel-strip">
      <Building2 :size="16" />
      <button :class="{ 'is-active': selectedPlantel === 'all' }" @click="emit('plantel', 'all')">Todos</button>
      <button
        v-for="item in visiblePlanteles"
        :key="item.plantel"
        :class="{ 'is-active': selectedPlantel === item.plantel }"
        @click="emit('plantel', item.plantel)"
      >
        <MapPin :size="13" />{{ item.plantel }} <b>{{ item.total }}</b>
      </button>
    </div>
  </section>
</template>
