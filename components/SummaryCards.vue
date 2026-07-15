<script setup lang="ts">
import { CheckCircle2, MapPin, Utensils } from '@lucide/vue'
import { plantelSortIndex } from '~/shared/catalog'
import type { CampusFilter, CampusName, PlantelSummary, ProgramKind, SummerStudent } from '~/types/summer'

type ModeProgram = Exclude<ProgramKind, 'unassigned'>

const props = defineProps<{
  students: SummerStudent[]
  summaries: PlantelSummary[]
  selectedCampus: CampusFilter
  selectedPlantel: string
  selectedProgram: 'all' | ProgramKind
}>()

const emit = defineEmits<{
  campus: [campus: CampusFilter]
  plantel: [plantel: string]
  program: [program: 'all' | ProgramKind]
}>()

const campusOrder: CampusName[] = ['Toluca', 'Metepec']
const modes: Array<{ program: ModeProgram; label: string; code: string }> = [
  { program: 'husky_dreamers', label: 'Husky Dreamers', code: 'HD' },
  { program: 'clinica_futbol', label: 'Clínica de fútbol', code: 'CF' }
]

const totalStudents = computed(() => props.students.length)
const unassigned = computed(() => props.students.filter((student) => student.program === 'unassigned').length)

const cards = computed(() => campusOrder.flatMap((campus) => modes.map((mode) => {
  const rows = props.students.filter((student) => student.campus === campus && student.program === mode.program)
  const present = rows.filter((student) => student.attendance === 'present').length
  const absent = rows.filter((student) => student.attendance === 'absent').length
  const unmarked = rows.filter((student) => student.attendance === 'unmarked').length
  const food = rows.filter((student) => student.mealCount > 0).length
  const marked = present + absent

  return {
    campus,
    ...mode,
    total: rows.length,
    present,
    unmarked,
    food,
    percent: rows.length ? Math.round((marked / rows.length) * 100) : 0
  }
})))

const plantelGroups = computed(() => campusOrder.map((campus) => ({
  campus,
  planteles: props.summaries
    .filter((summary) => summary.campus === campus)
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es'))
})))

const selectCard = (campus: CampusName, program: ModeProgram) => {
  const clear = props.selectedCampus === campus && props.selectedProgram === program && props.selectedPlantel === 'all'
  emit('campus', clear ? 'all' : campus)
  emit('program', clear ? 'all' : program)
  emit('plantel', 'all')
}

const reset = () => {
  emit('campus', 'all')
  emit('program', 'all')
  emit('plantel', 'all')
}

const showUnassigned = () => {
  emit('campus', 'all')
  emit('program', 'unassigned')
  emit('plantel', 'all')
}
</script>

<template>
  <section class="campus-kpis" aria-label="Resumen por campus y modalidad">
    <header class="campus-kpis__header">
      <div>
        <span>Resumen</span>
        <strong>{{ totalStudents }} alumnos</strong>
      </div>
      <div class="campus-kpis__actions">
        <button v-if="unassigned" class="campus-kpis__pending" :class="{ 'is-active': selectedProgram === 'unassigned' }" @click="showUnassigned">
          {{ unassigned }} sin modalidad
        </button>
        <button v-if="selectedCampus !== 'all' || selectedPlantel !== 'all' || selectedProgram !== 'all'" @click="reset">
          Ver todo
        </button>
      </div>
    </header>

    <div class="campus-kpis__grid">
      <button
        v-for="card in cards"
        :key="`${card.campus}-${card.program}`"
        class="mode-kpi"
        :class="[
          `mode-kpi--${card.campus.toLowerCase()}`,
          `mode-kpi--${card.program}`,
          {
            'is-selected': selectedCampus === card.campus && selectedProgram === card.program,
            'is-muted': (selectedCampus !== 'all' && selectedCampus !== card.campus) || (selectedProgram !== 'all' && selectedProgram !== card.program)
          }
        ]"
        @click="selectCard(card.campus, card.program)"
      >
        <span class="mode-kpi__topline">
          <span>{{ card.campus }}</span>
          <b>{{ card.code }}</b>
        </span>
        <strong class="mode-kpi__title">{{ card.label }}</strong>
        <span class="mode-kpi__total">{{ card.total }}</span>
        <span class="mode-kpi__metrics">
          <span><CheckCircle2 :size="14" />{{ card.present }}</span>
          <span><Utensils :size="14" />{{ card.food }}</span>
        </span>
        <span class="mode-kpi__progress" aria-hidden="true"><i :style="{ width: `${card.percent}%` }" /></span>
        <span class="mode-kpi__pending">{{ card.unmarked }} por marcar</span>
      </button>
    </div>

    <div class="campus-kpis__plantel-groups" aria-label="Conteo por plantel">
      <div v-for="group in plantelGroups" :key="group.campus" class="plantel-kpis">
        <span>{{ group.campus }}</span>
        <div>
          <button
            v-for="plantel in group.planteles"
            :key="plantel.plantel"
            :class="{ 'is-active': selectedPlantel === plantel.plantel }"
            @click="emit('plantel', plantel.plantel)"
          >
            <MapPin :size="12" />{{ plantel.plantel }}<b>{{ plantel.total }}</b>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
