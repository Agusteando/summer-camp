<script setup lang="ts">
import { CheckCircle2, Coffee, Moon, Timer, Utensils, UsersRound } from '@lucide/vue'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ students: SummerStudent[]; loading?: boolean }>()

const metrics = computed(() => [
  { key: 'students', label: 'Inscritos', value: props.students.length, icon: UsersRound },
  { key: 'present', label: 'Presentes', value: props.students.filter((student) => student.attendance === 'present').length, icon: CheckCircle2 },
  { key: 'breakfast', label: 'Desayuno', value: props.students.filter((student) => student.services.breakfast).length, icon: Coffee },
  { key: 'lunch', label: 'Comida', value: props.students.filter((student) => student.services.lunch).length, icon: Utensils },
  { key: 'dinner', label: 'Cena', value: props.students.filter((student) => student.services.dinner).length, icon: Moon },
  { key: 'extended', label: 'Extendido', value: props.students.filter((student) => student.services.extendedTime).length, icon: Timer }
])
</script>

<template>
  <section class="summary-grid" aria-label="Resumen operativo">
    <article v-for="metric in metrics" :key="metric.key" class="summary-card">
      <span><component :is="metric.icon" :size="18" /></span>
      <div><strong>{{ loading && !students.length ? '—' : metric.value }}</strong><small>{{ metric.label }}</small></div>
    </article>
  </section>
</template>
