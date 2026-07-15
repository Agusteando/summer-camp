<script setup lang="ts">
import { CalendarRange, Check, ChevronDown, ChevronUp, X } from '@lucide/vue'
const today = new Date()
const to = ref(today.toISOString().slice(0, 10))
const start = new Date(today)
start.setDate(start.getDate() - 14)
const from = ref(start.toISOString().slice(0, 10))
const busy = ref(false)
const days = ref<any[]>([])
const expanded = ref<string | null>(null)

const load = async () => {
  busy.value = true
  try {
    const response: any = await $fetch('/api/summer/attendance/history', { query: { from: from.value, to: to.value }, cache: 'no-store' })
    days.value = response.days || []
  } finally { busy.value = false }
}
const formatDate = (value: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`))
onMounted(load)
</script>

<template>
  <div class="page-container history-page">
    <section class="page-heading">
      <div><span>Summer Camp 2026</span><h1>Asistencia</h1></div>
      <CalendarRange :size="34" />
    </section>

    <section class="range-card">
      <label><span>Desde</span><input v-model="from" type="date"></label>
      <label><span>Hasta</span><input v-model="to" type="date"></label>
      <button class="primary-button" :disabled="busy" @click="load">Ver</button>
    </section>

    <div v-if="busy" class="skeleton-stack"><div v-for="item in 5" :key="item" class="history-skeleton" /></div>
    <div v-else-if="days.length" class="history-list">
      <article v-for="day in days" :key="day.date" class="history-day">
        <button class="history-day__summary" @click="expanded = expanded === day.date ? null : day.date">
          <div>
            <span>{{ formatDate(day.date) }}</span>
            <strong>{{ day.total }} registros</strong>
          </div>
          <div class="history-day__numbers">
            <span class="history-number history-number--present"><Check :size="17" />{{ day.present }}</span>
            <span class="history-number history-number--absent"><X :size="17" />{{ day.absent }}</span>
            <ChevronUp v-if="expanded === day.date" :size="20" />
            <ChevronDown v-else :size="20" />
          </div>
        </button>
        <div v-if="expanded === day.date" class="history-rows">
          <div v-for="row in day.rows" :key="`${day.date}-${row.matricula}`" class="history-row">
            <span class="history-row__icon" :class="`is-${row.status}`"><Check v-if="row.status === 'present'" :size="16" /><X v-else :size="16" /></span>
            <div><strong>{{ row.name }}</strong><span>{{ row.plantelLabel }}</span></div>
            <small>{{ row.actorName }}</small>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="empty-state"><img src="/icons/abejas.png" alt=""><strong>Sin registros</strong></div>
  </div>
</template>
