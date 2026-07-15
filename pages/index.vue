<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, UsersRound } from '@lucide/vue'
import { AGE_GROUPS } from '~/shared/catalog'
import type { SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const selectedPlantel = ref('all')
const search = ref('')
const group = ref('all')
const program = ref('all')

const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const filtered = computed(() => {
  const rows = summer.snapshot.value?.students || []
  return rows.filter((student) => {
    if (selectedPlantel.value !== 'all' && student.plantel !== selectedPlantel.value) return false
    if (group.value !== 'all' && student.ageGroup !== group.value) return false
    if (program.value !== 'all' && student.program !== program.value) return false
    if (normalizedSearch.value && !`${student.name} ${student.matricula}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)) return false
    return true
  })
})

const groupOrder = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'missing-age', 'out-of-range']
const groupMeta = (key: string) => {
  const known = AGE_GROUPS.find((item) => item.key === key)
  if (known) return { label: `${known.label} años`, icon: known.icon }
  return key === 'missing-age' ? { label: 'Edad pendiente', icon: '/icons/dinos.png' } : { label: 'Fuera de rango', icon: '/icons/pandas.png' }
}
const grouped = computed(() => groupOrder.flatMap((key) => {
  const students = filtered.value.filter((student) => student.ageGroup === key)
  return students.length ? [{ key, ...groupMeta(key), students }] : []
}))
const present = computed(() => filtered.value.filter((student) => student.attendance === 'present').length)
const marked = computed(() => filtered.value.filter((student) => student.attendance !== 'unmarked').length)
const percent = computed(() => filtered.value.length ? Math.round((marked.value / filtered.value.length) * 100) : 0)

const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status)

onMounted(async () => {
  await summer.load()
  summer.startPolling()
})
</script>

<template>
  <div class="page-container attendance-page">
    <section class="day-hero">
      <div>
        <span class="day-hero__kicker">Asistencia</span>
        <h1>Hoy</h1>
        <p>{{ present }} presentes · {{ filtered.length - marked }} por marcar</p>
      </div>
      <label class="date-control">
        <CalendarDays :size="19" />
        <input :value="summer.selectedDate.value" type="date" @change="summer.setDate(($event.target as HTMLInputElement).value)">
      </label>
      <div class="attendance-progress" aria-hidden="true">
        <span :style="{ width: `${percent}%` }" />
      </div>
    </section>

    <div v-if="!connectivity.browserOnline.value" class="offline-banner">
      <CloudOff :size="19" />
      <span>{{ summer.pendingCount.value ? `${summer.pendingCount.value} cambios guardados` : 'Modo sin conexión' }}</span>
    </div>

    <template v-if="summer.snapshot.value">
      <SummaryCards :summaries="summer.snapshot.value.summaries" :selected="selectedPlantel" @select="selectedPlantel = $event" />
      <FilterDock v-model:search="search" v-model:group="group" v-model:program="program" />

      <section class="attendance-countbar">
        <div><UsersRound :size="18" /><strong>{{ filtered.length }}</strong><span>alumnos</span></div>
        <div><CheckCircle2 :size="18" /><strong>{{ present }}</strong><span>presentes</span></div>
      </section>

      <div v-if="filtered.length" class="age-sections">
        <section v-for="section in grouped" :key="section.key" class="age-section">
          <header class="age-section__header">
            <img :src="section.icon" alt="">
            <div><h2>{{ section.label }}</h2><span>{{ section.students.length }}</span></div>
          </header>
          <div class="student-grid">
            <StudentAttendanceCard v-for="student in section.students" :key="student.matricula" :student="student" @mark="mark" />
          </div>
        </section>
      </div>
      <div v-else class="empty-state">
        <img src="/icons/dinos.png" alt="">
        <strong>Sin resultados</strong>
      </div>
    </template>

    <div v-else-if="summer.loading.value" class="skeleton-stack">
      <div v-for="item in 6" :key="item" class="student-skeleton" />
    </div>
    <div v-else class="empty-state empty-state--error">
      <CloudOff :size="38" />
      <strong>{{ summer.error.value || 'No se pudo cargar la lista' }}</strong>
      <button class="secondary-button" @click="summer.refresh(false)">Reintentar</button>
    </div>
  </div>
</template>
