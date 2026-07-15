<script setup lang="ts">
import { Check, CircleHelp, Clock3, Moon, Utensils, X } from '@lucide/vue'
import { mealLabel, programLabel } from '~/shared/catalog'
import type { SummerStudent } from '~/types/summer'
const props = defineProps<{ student: SummerStudent; busy?: boolean }>()
const emit = defineEmits<{ mark: [student: SummerStudent, status: 'present' | 'absent'] }>()
const mealIcon = computed(() => props.student.mealPlan === 'cena' ? Moon : Utensils)
</script>

<template>
  <article class="student-card" :class="`student-card--${student.attendance}`">
    <StudentPhoto :matricula="student.matricula" :name="student.name" :available="student.photoAvailable" :token="student.photoToken" />
    <div class="student-card__body">
      <div class="student-card__top">
        <div>
          <h3>{{ student.name }}</h3>
          <p>{{ student.age !== null ? `${student.age} años` : 'Edad pendiente' }} · {{ student.plantelLabel }}</p>
        </div>
        <span class="attendance-dot" :title="student.attendance" />
      </div>
      <div class="student-card__chips">
        <span class="chip" :class="{ 'chip--warning': student.program === 'unassigned' }">
          <CircleHelp v-if="student.program === 'unassigned'" :size="13" />{{ programLabel(student.program) }}
        </span>
        <span class="chip" :class="{ 'chip--warning': student.mealPlan === 'pending_one' }">
          <component :is="mealIcon" :size="13" />{{ mealLabel(student.mealPlan) }}
        </span>
      </div>
    </div>
    <div class="attendance-actions">
      <button class="attendance-button attendance-button--absent" :class="{ 'is-active': student.attendance === 'absent' }" :disabled="busy" aria-label="Ausente" @click="emit('mark', student, 'absent')">
        <X :size="22" />
      </button>
      <button class="attendance-button attendance-button--present" :class="{ 'is-active': student.attendance === 'present' }" :disabled="busy" aria-label="Presente" @click="emit('mark', student, 'present')">
        <Check :size="24" />
      </button>
    </div>
  </article>
</template>
