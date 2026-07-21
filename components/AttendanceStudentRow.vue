<script setup lang="ts">
import { Check, X } from '@lucide/vue'
import type { AttendanceStatus, AttendanceType, StudentServiceKey, SummerStudent } from '~/types/summer'

const props = defineProps<{
  student: SummerStudent
  index: number
  status: AttendanceStatus
  attendanceType: AttendanceType
  busy?: boolean
}>()
const emit = defineEmits<{
  mark: [student: SummerStudent, status: 'present' | 'absent']
}>()
const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const statusLabel = computed(() => ({ present: 'Presente', absent: 'Ausente', unmarked: 'Pendiente' })[props.status])
const focusedService = computed<StudentServiceKey | undefined>(() => props.attendanceType === 'general' ? undefined : props.attendanceType)
</script>

<template>
  <article class="attendance-row" :class="`is-${status}`">
    <span class="attendance-row__number">{{ index + 1 }}</span>
    <span class="student-avatar student-avatar--small">{{ initials }}</span>
    <div class="attendance-row__identity">
      <strong>{{ student.name }}</strong>
      <small>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} · {{ student.plantel }} · #{{ student.folio }}</small>
      <StudentServiceLabels :services="student.services" :values="student.serviceValues" :only="focusedService" compact />
    </div>
    <span class="attendance-row__status">{{ statusLabel }}</span>
    <div class="attendance-row__actions">
      <button
        type="button"
        class="attendance-choice attendance-choice--absent"
        :class="{ 'is-active': status === 'absent' }"
        :disabled="busy"
        :aria-pressed="status === 'absent'"
        :title="status === 'absent' ? 'Volver a pendiente' : 'Marcar ausente'"
        :aria-label="`Marcar ausencia de ${student.name}`"
        @click="emit('mark', student, 'absent')"
      ><X :size="19" /><span>Ausente</span></button>
      <button
        type="button"
        class="attendance-choice attendance-choice--present"
        :class="{ 'is-active': status === 'present' }"
        :disabled="busy"
        :aria-pressed="status === 'present'"
        :title="status === 'present' ? 'Volver a pendiente' : 'Marcar presente'"
        :aria-label="`Marcar asistencia de ${student.name}`"
        @click="emit('mark', student, 'present')"
      ><Check :size="19" /><span>Presente</span></button>
    </div>
  </article>
</template>
