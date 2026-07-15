<script setup lang="ts">
import { CheckCircle2, MapPin, School2, Utensils } from '@lucide/vue'
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
const cards = computed(() => campusOrder.map((campus) => {
  const planteles = props.summaries
    .filter((summary) => summary.campus === campus)
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es'))
  const total = planteles.reduce((sum, item) => sum + item.total, 0)
  const present = planteles.reduce((sum, item) => sum + item.present, 0)
  const food = planteles.reduce((sum, item) => sum + item.food, 0)
  const unmarked = planteles.reduce((sum, item) => sum + item.unmarked, 0)
  return {
    campus,
    planteles,
    total,
    present,
    food,
    unmarked,
    percent: total ? Math.round((present / total) * 100) : 0
  }
}))

const selectCampus = (campus: CampusName) => {
  emit('campus', props.selectedCampus === campus && props.selectedPlantel === 'all' ? 'all' : campus)
}
</script>

<template>
  <section class="campus-kpis" aria-label="Campus">
    <header class="campus-kpis__header">
      <div>
        <span>Campus</span>
        <strong>{{ summaries.reduce((sum, item) => sum + item.total, 0) }} alumnos</strong>
      </div>
      <button v-if="selectedCampus !== 'all' || selectedPlantel !== 'all'" @click="emit('campus', 'all'); emit('plantel', 'all')">
        Ver ambos
      </button>
    </header>

    <div class="campus-kpis__grid">
      <article
        v-for="card in cards"
        :key="card.campus"
        class="campus-card"
        :class="{
          'is-selected': selectedCampus === card.campus,
          'is-muted': selectedCampus !== 'all' && selectedCampus !== card.campus
        }"
      >
        <button class="campus-card__main" @click="selectCampus(card.campus)">
          <span class="campus-card__icon"><School2 :size="21" /></span>
          <span class="campus-card__identity">
            <small>Campus</small>
            <strong>{{ card.campus }}</strong>
          </span>
          <span class="campus-card__total">{{ card.total }}</span>
          <span class="campus-card__metrics">
            <span><CheckCircle2 :size="15" />{{ card.present }} presentes</span>
            <span><Utensils :size="15" />{{ card.food }} con alimento</span>
          </span>
          <span class="campus-card__progress" aria-hidden="true"><i :style="{ width: `${card.percent}%` }" /></span>
          <span class="campus-card__pending">{{ card.unmarked }} por marcar</span>
        </button>

        <div class="campus-card__planteles" aria-label="Planteles">
          <button
            v-for="plantel in card.planteles"
            :key="plantel.plantel"
            :class="{ 'is-active': selectedPlantel === plantel.plantel }"
            @click="emit('plantel', plantel.plantel)"
          >
            <MapPin :size="13" />
            <span>{{ plantel.plantel }}</span>
            <strong>{{ plantel.total }}</strong>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
