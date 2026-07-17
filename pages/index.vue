<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, UsersRound } from '@lucide/vue'
import { AGE_GROUPS, plantelSortIndex } from '~/shared/catalog'
import type { ProgramKind, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const search = ref('')
const group = ref('all')
const program = ref<'all' | ProgramKind>('all')
const service = ref('all')

const students = computed(() => summer.snapshot.value?.students || [])
const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))

const plantelOptions = computed(() => summaries.value
  .filter((summary) => scope.campus.value === 'all' || summary.campus === scope.campus.value)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel)))

const filtered = computed(() => students.value.filter((student) => {
  if (!scope.matches(student)) return false
  if (group.value !== 'all' && student.ageGroup !== group.value) return false
  if (program.value !== 'all' && student.program !== program.value) return false
  if (service.value !== 'all' && !student.services[service.value as keyof typeof student.services]) return false
  if (normalizedSearch.value && !`${student.name} ${student.folio} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)) return false
  return true
}))

const groupOrder = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'missing-age', 'out-of-range']
const groupMeta = (key: string) => {
  const known = AGE_GROUPS.find((item) => item.key === key)
  if (known) return { label: `${known.label} años`, icon: known.icon }
  return key === 'missing-age'
    ? { label: 'Edad pendiente', icon: '/icons/dinos.png' }
    : { label: 'Fuera de rango', icon: '/icons/pandas.png' }
}

const groupedStudents = computed(() => groupOrder.flatMap((key) => {
  const rows = filtered.value.filter((student) => student.ageGroup === key)
  return rows.length ? [{ key, ...groupMeta(key), students: rows }] : []
}))

const present = computed(() => filtered.value.filter((student) => student.attendance === 'present').length)
const unmarked = computed(() => filtered.value.filter((student) => student.attendance === 'unmarked').length)
const percent = computed(() => filtered.value.length ? Math.round((present.value / filtered.value.length) * 100) : 0)

const setCampus = (campus: 'all' | 'Toluca' | 'Metepec') => scope.setCampus(campus, summaries.value)
const setPlantel = (plantel: string) => scope.setPlantel(plantel, summaries.value)
const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status)

watch(summaries, (value) => scope.reconcile(value), { deep: true })

onMounted(() => {
  scope.initialize()
  summer.startPolling()
  scope.reconcile(summaries.value)
})
</script>

<template>
  <div class="page-container attendance-page">
    <section class="hero-panel">
      <div>
        <span>Operación diaria</span>
        <h1>Summer Camp 2026</h1>
        <p>Inscritos y servicios sincronizados desde Google Sheets.</p>
      </div>
      <label class="date-control">
        <CalendarDays :size="19" />
        <span>Fecha</span>
        <input :value="summer.selectedDate.value" type="date" @change="summer.setDate(($event.target as HTMLInputElement).value)">
      </label>
    </section>

    <SummaryCards :students="students" :loading="summer.loading.value" />

    <CampusScopeBar
      v-if="summaries.length"
      :summaries="summaries"
      :selected-campus="scope.campus.value"
      :selected-plantel="scope.plantel.value"
      @campus="setCampus"
      @plantel="setPlantel"
    />

    <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
      <CloudOff :size="18" />
      <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} cambio{{ summer.pendingCount.value === 1 ? '' : 's' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }} de sincronizar</span>
      <span v-else>Modo sin conexión: la asistencia se guardará en este dispositivo.</span>
    </div>

    <section class="attendance-workspace">
      <template v-if="summer.snapshot.value">
        <FilterDock
          v-model:search="search"
          v-model:group="group"
          v-model:program="program"
          v-model:service="service"
          :plantel="scope.plantel.value"
          :planteles="plantelOptions"
          @update:plantel="setPlantel"
        />

        <section class="attendance-countbar">
          <div><UsersRound :size="18" /><strong>{{ filtered.length }}</strong><span>visibles</span></div>
          <div><CheckCircle2 :size="18" /><strong>{{ present }}/{{ filtered.length }}</strong><span>presentes</span></div>
          <div><strong>{{ unmarked }}</strong><span>por marcar</span></div>
          <span class="attendance-countbar__progress"><i :style="{ width: `${percent}%` }" /></span>
        </section>

        <div v-if="filtered.length" class="age-sections">
          <section v-for="section in groupedStudents" :key="section.key" class="age-section">
            <header class="age-section__header">
              <img :src="section.icon" alt="">
              <div><h2>{{ section.label }}</h2><span>{{ section.students.length }} menores</span></div>
            </header>
            <div class="student-grid">
              <StudentAttendanceCard v-for="student in section.students" :key="student.id" :student="student" @mark="mark" />
            </div>
          </section>
        </div>
        <div v-else class="empty-state"><img src="/icons/dinos.png" alt=""><strong>Sin resultados con estos filtros</strong></div>
      </template>

      <div v-else-if="summer.loading.value" class="loading-panel">
        <div class="skeleton-stack"><div v-for="item in 6" :key="item" class="student-skeleton" /></div>
      </div>

      <div v-else class="load-error-panel">
        <span><CloudOff :size="34" /></span>
        <div><strong>No se pudo cargar la lista</strong><p>{{ summer.error.value || 'La solicitud terminó sin datos.' }}</p></div>
        <button class="secondary-button" @click="summer.refresh(false)">Reintentar</button>
      </div>
    </section>
  </div>
</template>
