<script setup lang="ts">
import { Check, Utensils, UsersRound } from '@lucide/vue'
import type { PlantelSummary } from '~/types/summer'
defineProps<{ summaries: PlantelSummary[]; selected: string }>()
const emit = defineEmits<{ select: [plantel: string] }>()
</script>

<template>
  <div class="summary-strip">
    <button class="summary-card summary-card--all" :class="{ 'is-selected': selected === 'all' }" @click="emit('select', 'all')">
      <span class="summary-card__eyebrow">Todos</span>
      <strong>{{ summaries.reduce((sum, item) => sum + item.total, 0) }}</strong>
      <span><Check :size="14" /> {{ summaries.reduce((sum, item) => sum + item.present, 0) }} hoy</span>
    </button>
    <button v-for="summary in summaries" :key="summary.plantel" class="summary-card" :class="{ 'is-selected': selected === summary.plantel }" @click="emit('select', summary.plantel)">
      <span class="summary-card__eyebrow">{{ summary.campus }}</span>
      <strong>{{ summary.total }}</strong>
      <h3>{{ summary.label }}</h3>
      <div class="summary-card__metrics">
        <span><UsersRound :size="14" /> {{ summary.present }}/{{ summary.total }}</span>
        <span><Utensils :size="14" /> {{ summary.food }}</span>
      </div>
    </button>
  </div>
</template>
