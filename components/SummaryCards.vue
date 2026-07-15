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
  loading?: boolean
  error?: string | null
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
const unavailable = computed(() => Boolean(props.error && !props.students.length))

const cards = computed(() => campusOrder.flatMap((campus) => modes.map((mode) => {
  const rows = props.students.filter((student) => student.campus === campus && student.program === mode.program)
  const present = rows.filter((student) => student.attendance === 'present').length
  const absent = rows.filter((student) => student.attendance === 'absent').length
  const unmarked = rows.filter((student) => student.attendance === 'unmarked').length
  const food = rows.filter((student) => student.mealCount > 0).length

  return {
    campus,
    ...mode,
    total: rows.length,
    present,
    absent,
    unmarked,
    food,
    percent: rows.length ? Math.round((present / rows.length) * 100) : 0
  }
})))

const plantelGroups = computed(() => campusOrder.map((campus) => ({
  campus,
  planteles: props.summaries
    .filter((summary) => summary.campus === campus)
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es'))
})))

const selectCard = (campus: CampusName, program: ModeProgram) => {
  if (props.loading || unavailable.value) return
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
  <section class="campus-kpis" aria-label="Inscripciones por campus y modalidad">
    <header class="campus-kpis__header">
      <div>
        <span>Inscripciones por campus y modalidad</span>
        <strong>{{ loading && !students.length ? 'Cargando alumnos…' : `${totalStudents} inscritos en Summer Camp` }}</strong>
      </div>
      <div class="campus-kpis__actions">
        <button v-if="unassigned" class="campus-kpis__pending" :class="{ 'is-active': selectedProgram === 'unassigned' }" @click="showUnassigned">
          {{ unassigned }} sin modalidad
        </button>
        <button v-if="selectedCampus !== 'all' || selectedPlantel !== 'all' || selectedProgram !== 'all'" @click="reset">Ver todos</button>
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
            'is-muted': (selectedCampus !== 'all' && selectedCampus !== card.campus) || (selectedProgram !== 'all' && selectedProgram !== card.program),
            'is-loading': loading && !students.length,
            'is-unavailable': unavailable
          }
        ]"
        @click="selectCard(card.campus, card.program)"
      >
        <span class="mode-kpi__topline"><span>{{ card.campus }}</span><b>{{ card.code }}</b></span>
        <strong class="mode-kpi__title">{{ card.label }}</strong>

        <div class="mode-kpi__enrollment">
          <strong>{{ loading && !students.length || unavailable ? '—' : card.total }}</strong>
          <span>inscritos</span>
        </div>

        <div class="mode-kpi__attendance">
          <span>Asistencia hoy</span>
          <strong>{{ loading && !students.length || unavailable ? '— / —' : `${card.present} / ${card.total}` }}</strong>
        </div>

        <span class="mode-kpi__progress" aria-hidden="true"><i :style="{ width: `${card.percent}%` }" /></span>

        <div class="mode-kpi__footer">
          <span><CheckCircle2 :size="14" />{{ unavailable ? '—' : card.unmarked }} por marcar</span>
          <span><Utensils :size="14" />{{ unavailable ? '—' : card.food }} con alimento</span>
        </div>
      </button>
    </div>

    <div v-if="summaries.length" class="campus-kpis__plantel-groups" aria-label="Inscripción por plantel">
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
    <div v-else-if="loading" class="plantel-kpis-skeleton"><span v-for="item in 6" :key="item" /></div>
    <div v-else-if="unavailable" class="campus-kpis__unavailable">Los cuatro indicadores están visibles, pero no hay datos porque falló la carga de la lista.</div>
  </section>
</template>
