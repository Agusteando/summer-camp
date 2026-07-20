<script setup lang="ts">
import { Check, X } from '@lucide/vue'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ student: SummerStudent; index: number; busy?: boolean }>()
const emit = defineEmits<{
  mark: [student: SummerStudent, status: 'present' | 'absent']
}>()
const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const statusLabel = computed(() => ({ present: 'Presente', absent: 'Ausente', unmarked: 'Pendiente' })[props.student.attendance])
</script>

<template>
  <article class="attendance-row" :class="`is-${student.attendance}`">
    <span class="attendance-row__number">{{ index + 1 }}</span>
    <span class="student-avatar student-avatar--small">{{ initials }}</span>
    <div class="attendance-row__identity">
      <strong>{{ student.name }}</strong>
      <small>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} · {{ student.plantel }} · #{{ student.folio }}</small>
      <StudentServiceLabels :services="student.services" compact />
    </div>
    <span class="attendance-row__status">{{ statusLabel }}</span>
    <div class="attendance-row__actions">
      <button
        type="button"
        class="attendance-choice attendance-choice--absent"
        :class="{ 'is-active': student.attendance === 'absent' }"
        :disabled="busy"
        :aria-pressed="student.attendance === 'absent'"
        :title="student.attendance === 'absent' ? 'Volver a pendiente' : 'Marcar ausente'"
        :aria-label="`Marcar ausencia de ${student.name}`"
        @click="emit('mark', student, 'absent')"
      ><X :size="19" /><span>Ausente</span></button>
      <button
        type="button"
        class="attendance-choice attendance-choice--present"
        :class="{ 'is-active': student.attendance === 'present' }"
        :disabled="busy"
        :aria-pressed="student.attendance === 'present'"
        :title="student.attendance === 'present' ? 'Volver a pendiente' : 'Marcar presente'"
        :aria-label="`Marcar asistencia de ${student.name}`"
        @click="emit('mark', student, 'present')"
      ><Check :size="19" /><span>Presente</span></button>
    </div>
  </article>
</template>
