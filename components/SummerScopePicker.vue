<script setup lang="ts">
import { ArrowLeft, Dumbbell, GraduationCap, MapPin } from '@lucide/vue'
import { PROGRAM_ORDER, programLabel } from '~/shared/catalog'
import type { CampusFilter, CampusName, PlantelSummary, ProgramScope } from '~/types/summer'

const props = defineProps<{
  summaries: PlantelSummary[]
  selectedCampus: CampusFilter
  selectedProgram: ProgramScope | null
}>()

const emit = defineEmits<{
  campus: [campus: CampusName]
  program: [program: ProgramScope]
  back: []
}>()

const campusSection = ref<HTMLElement | null>(null)
const programSection = ref<HTMLElement | null>(null)
const campusOrder: CampusName[] = ['Toluca', 'Metepec']

const campusTotal = (campus: CampusName) => props.summaries
  .filter((summary) => summary.campus === campus)
  .reduce((sum, summary) => sum + summary.huskyDreamers + summary.footballClinic, 0)

const programTotal = (program: ProgramScope) => {
  if (!props.selectedCampus) return 0
  return props.summaries
    .filter((summary) => summary.campus === props.selectedCampus)
    .reduce((sum, summary) => sum + (program === 'husky_dreamers' ? summary.huskyDreamers : summary.footballClinic), 0)
}

const focusStep = async (element: HTMLElement | null) => {
  if (!import.meta.client || !element) return
  await nextTick()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  window.setTimeout(() => {
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, reducedMotion ? 0 : 260)
}

watch(() => props.selectedCampus, async (campus, previous) => {
  await nextTick()
  if (campus && !props.selectedProgram && campus !== previous) void focusStep(programSection.value)
  if (!campus && previous) void focusStep(campusSection.value)
}, { flush: 'post' })
</script>

<template>
  <section class="scope-picker" :class="{ 'scope-picker--program': selectedCampus }" aria-label="Seleccionar grupo">
    <div v-if="selectedCampus" class="scope-picker__navigation">
      <button class="scope-back-button" type="button" aria-label="Volver a campus" @click="emit('back')">
        <ArrowLeft :size="17" />
        <span>Atrás</span>
      </button>
      <span class="scope-picker__current"><MapPin :size="15" /><strong>{{ selectedCampus }}</strong></span>
    </div>

    <header class="scope-picker__header">
      <div class="scope-picker__step">
        <span>{{ selectedCampus ? 'Modalidad' : 'Campus' }}</span>
        <b>{{ selectedCampus ? '2' : '1' }}/2</b>
      </div>
      <h2>{{ selectedCampus ? 'Elige modalidad' : 'Elige campus' }}</h2>
    </header>

    <div v-if="!selectedCampus" ref="campusSection" class="scope-options scope-options--campus">
      <button
        v-for="campus in campusOrder"
        :key="campus"
        type="button"
        class="scope-option"
        @click="emit('campus', campus)"
      >
        <span class="scope-option__icon"><MapPin :size="23" /></span>
        <div><strong>{{ campus }}</strong><small>{{ campusTotal(campus) }} alumnos</small></div>
      </button>
    </div>

    <div v-else ref="programSection" class="scope-options scope-options--program">
      <button
        v-for="program in PROGRAM_ORDER"
        :key="program"
        type="button"
        class="scope-option scope-option--program"
        :disabled="programTotal(program) === 0"
        @click="emit('program', program)"
      >
        <span class="scope-option__icon">
          <GraduationCap v-if="program === 'husky_dreamers'" :size="24" />
          <Dumbbell v-else :size="24" />
        </span>
        <div><strong>{{ programLabel(program) }}</strong><small>{{ programTotal(program) }} alumnos</small></div>
      </button>
    </div>
  </section>
</template>
