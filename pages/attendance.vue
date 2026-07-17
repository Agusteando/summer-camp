<script setup lang="ts">
import { CalendarRange, Check, ChevronDown, ChevronUp, School2, X } from '@lucide/vue'
import type { AttendanceHistoryDay, CampusName } from '~/types/summer'

const summer = useSummerData()
const scope = useSummerScope()
const today = new Date()
const to = ref(today.toISOString().slice(0, 10))
const start = new Date(today)
start.setDate(start.getDate() - 14)
const from = ref(start.toISOString().slice(0, 10))
const busy = ref(false)
const error = ref('')
const days = ref<AttendanceHistoryDay[]>([])
const expanded = ref<string | null>(null)

const load = async () => {
  busy.value = true
  error.value = ''
  try {
    const response = await $fetch<{ days: AttendanceHistoryDay[] }>('/api/summer/attendance/history', {
      query: { from: from.value, to: to.value },
      cache: 'no-store'
    })
    days.value = response.days || []
  } catch (cause: any) {
    error.value = cause?.data?.message || cause?.message || 'No se pudo cargar el historial.'
  } finally {
    busy.value = false
  }
}

const visibleDays = computed(() => {
  if (!scope.campus.value) return []
  return days.value.flatMap((day) => {
    const rows = day.rows.filter((row) => {
      if (row.campus !== scope.campus.value) return false
      if (scope.plantel.value !== 'all' && row.plantel !== scope.plantel.value) return false
      return true
    })
    if (!rows.length) return []
    return [{
      ...day,
      rows,
      total: rows.length,
      present: rows.filter((row) => row.status === 'present').length,
      absent: rows.filter((row) => row.status === 'absent').length
    }]
  })
})

const groupedRows = (rows: AttendanceHistoryDay['rows']) => {
  if (!scope.campus.value) return []
  const students = rows.filter((row) => row.campus === scope.campus.value)
  return students.length ? [{ campus: scope.campus.value, students }] : []
}

const summaries = computed(() => summer.snapshot.value?.summaries || [])
const setCampus = (campus: CampusName) => scope.setCampus(campus)
const setPlantel = (plantel: string) => scope.setPlantel(plantel, summaries.value)
const formatDate = (value: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`))

watch(summaries, (value) => scope.reconcile(value), { deep: true })

onMounted(async () => {
  scope.initialize()
  await summer.load()
  await load()
  scope.reconcile(summaries.value)
})
</script>

<template>
  <div class="page-container history-page">
    <section class="page-heading">
      <div><span>Summer Camp 26</span><h1>Historial</h1></div>
      <CalendarRange :size="32" />
    </section>

    <CampusScopeBar
      v-if="summaries.length"
      :summaries="summaries"
      :selected-campus="scope.campus.value"
      :selected-plantel="scope.plantel.value"
      @campus="setCampus"
      @plantel="setPlantel"
    />

    <template v-if="scope.campus.value">
      <section class="range-card">
        <label><span>Desde</span><input v-model="from" type="date"></label>
        <label><span>Hasta</span><input v-model="to" type="date"></label>
        <button class="primary-button" :disabled="busy" @click="load">Ver</button>
      </section>

      <div v-if="busy" class="skeleton-stack"><div v-for="item in 5" :key="item" class="history-skeleton" /></div>
      <div v-else-if="error" class="load-error-panel">
        <span><X :size="30" /></span>
        <div><strong>No se pudo cargar el historial</strong><p>{{ error }}</p></div>
        <button class="secondary-button" @click="load">Reintentar</button>
      </div>
      <div v-else-if="visibleDays.length" class="history-list">
        <article v-for="day in visibleDays" :key="day.date" class="history-day">
          <button class="history-day__summary" @click="expanded = expanded === day.date ? null : day.date">
            <div><span>{{ formatDate(day.date) }}</span><strong>{{ day.total }}</strong></div>
            <div class="history-day__numbers">
              <span class="history-number history-number--present"><Check :size="17" />{{ day.present }}</span>
              <span class="history-number history-number--absent"><X :size="17" />{{ day.absent }}</span>
              <ChevronUp v-if="expanded === day.date" :size="20" />
              <ChevronDown v-else :size="20" />
            </div>
          </button>
          <div v-if="expanded === day.date" class="history-rows">
            <section v-for="campusSection in groupedRows(day.rows)" :key="campusSection.campus" class="history-campus">
              <header><School2 :size="16" /><strong>{{ campusSection.campus }}</strong><span>{{ campusSection.students.length }}</span></header>
              <div v-for="row in campusSection.students" :key="`${day.date}-${row.studentId}`" class="history-row">
                <span class="history-row__icon" :class="`is-${row.status}`"><Check v-if="row.status === 'present'" :size="16" /><X v-else :size="16" /></span>
                <div><strong>{{ row.name }}</strong><span>{{ row.plantelLabel }}</span></div>
                <small>{{ row.actorName }}</small>
              </div>
            </section>
          </div>
        </article>
      </div>
      <div v-else class="empty-state"><img src="/icons/abejas.png" alt=""><strong>Sin registros</strong></div>
    </template>
  </div>
</template>
