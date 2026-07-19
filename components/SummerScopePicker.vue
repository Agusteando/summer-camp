<script setup lang="ts">
import { ArrowRight, Check, Dumbbell, GraduationCap, MapPin, RotateCcw } from '@lucide/vue'
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
  reset: []
}>()

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
</script>

<template>
  <section class="scope-picker" aria-label="Seleccionar grupo de trabajo">
    <header class="scope-picker__header">
      <div>
        <span>Grupo de trabajo</span>
        <h2>¿Qué alumnos vas a consultar?</h2>
        <p>Selecciona campus y después modalidad. La app recordará esta elección en este dispositivo.</p>
      </div>
      <button v-if="selectedCampus || selectedProgram" class="text-button" type="button" @click="emit('reset')">
        <RotateCcw :size="16" /> Reiniciar
      </button>
    </header>

    <div class="scope-step">
      <div class="scope-step__label"><strong>1</strong><span>Campus</span></div>
      <div class="scope-options scope-options--campus">
        <button
          v-for="campus in campusOrder"
          :key="campus"
          type="button"
          class="scope-option"
          :class="{ 'is-active': selectedCampus === campus }"
          @click="emit('campus', campus)"
        >
          <span class="scope-option__icon"><MapPin :size="23" /></span>
          <div><strong>{{ campus }}</strong><small>{{ campusTotal(campus) }} alumnos inscritos</small></div>
          <span class="scope-option__check"><Check v-if="selectedCampus === campus" :size="16" /></span>
        </button>
      </div>
    </div>

    <div class="scope-connector" :class="{ 'is-ready': selectedCampus }"><ArrowRight :size="18" /></div>

    <div class="scope-step" :class="{ 'is-disabled': !selectedCampus }">
      <div class="scope-step__label"><strong>2</strong><span>Modalidad</span></div>
      <div class="scope-options scope-options--program">
        <button
          v-for="program in PROGRAM_ORDER"
          :key="program"
          type="button"
          class="scope-option scope-option--program"
          :class="{ 'is-active': selectedProgram === program }"
          :disabled="!selectedCampus || programTotal(program) === 0"
          @click="emit('program', program)"
        >
          <span class="scope-option__icon">
            <GraduationCap v-if="program === 'husky_dreamers'" :size="24" />
            <Dumbbell v-else :size="24" />
          </span>
          <div><strong>{{ programLabel(program) }}</strong><small>{{ selectedCampus ? `${programTotal(program)} alumnos` : 'Selecciona campus primero' }}</small></div>
          <span class="scope-option__check"><Check v-if="selectedProgram === program" :size="16" /></span>
        </button>
      </div>
    </div>
  </section>
</template>
