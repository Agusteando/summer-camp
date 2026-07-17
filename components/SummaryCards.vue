<script setup lang="ts">
import { CheckCircle2, Coffee, Moon, Timer, Utensils, UsersRound } from '@lucide/vue'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ students: SummerStudent[]; loading?: boolean }>()

const metrics = computed(() => [
  { key: 'students', label: 'Inscritos', value: props.students.length, icon: UsersRound, tone: 'ink' },
  { key: 'present', label: 'Presentes', value: props.students.filter((student) => student.attendance === 'present').length, icon: CheckCircle2, tone: 'green' },
  { key: 'breakfast', label: 'Desayuno', value: props.students.filter((student) => student.services.breakfast).length, icon: Coffee, tone: 'sun' },
  { key: 'lunch', label: 'Comida', value: props.students.filter((student) => student.services.lunch).length, icon: Utensils, tone: 'coral' },
  { key: 'dinner', label: 'Cena', value: props.students.filter((student) => student.services.dinner).length, icon: Moon, tone: 'violet' },
  { key: 'extended', label: 'Extendido', value: props.students.filter((student) => student.services.extendedTime).length, icon: Timer, tone: 'blue' }
])
</script>

<template>
  <section class="summary-grid" aria-label="Resumen global">
    <article v-for="metric in metrics" :key="metric.key" class="summary-card" :class="`summary-card--${metric.tone}`">
      <span><component :is="metric.icon" :size="18" /></span>
      <div><strong>{{ loading && !students.length ? '—' : metric.value }}</strong><small>{{ metric.label }}</small></div>
    </article>
  </section>
</template>
