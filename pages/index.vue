<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, MapPin, School2, UsersRound } from '@lucide/vue'
import { AGE_GROUPS, plantelSortIndex } from '~/shared/catalog'
import type { CampusName, PlantelSummary, ProgramKind, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const search = ref('')
const group = ref('all')
const program = ref<'all' | ProgramKind>('all')

const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))

const plantelOptions = computed(() => summaries.value
  .filter((summary) => scope.campus.value === 'all' || summary.campus === scope.campus.value)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es')))

const filtered = computed(() => {
  const rows = summer.snapshot.value?.students || []
  return rows.filter((student) => {
    if (!scope.matches(student)) return false
    if (group.value !== 'all' && student.ageGroup !== group.value) return false
    if (program.value !== 'all' && student.program !== program.value) return false
    if (normalizedSearch.value && !`${student.name} ${student.matricula} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)) return false
    return true
  })
})

const groupOrder = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'missing-age', 'out-of-range']
const campusOrder: CampusName[] = ['Toluca', 'Metepec']

const groupMeta = (key: string) => {
  const known = AGE_GROUPS.find((item) => item.key === key)
  if (known) return { label: `${known.label} años`, icon: known.icon }
  return key === 'missing-age'
    ? { label: 'Edad pendiente', icon: '/icons/dinos.png' }
    : { label: 'Fuera de rango', icon: '/icons/pandas.png' }
}

const groupsFor = (rows: SummerStudent[]) => groupOrder.flatMap((key) => {
  const students = rows.filter((student) => student.ageGroup === key)
  return students.length ? [{ key, ...groupMeta(key), students }] : []
})

const campusSections = computed(() => campusOrder.flatMap((campus) => {
  const rows = filtered.value.filter((student) => student.campus === campus)
  if (!rows.length) return []
  const plantelMap = new Map<string, number>()
  rows.forEach((student) => plantelMap.set(student.plantel, (plantelMap.get(student.plantel) || 0) + 1))
  const planteles = Array.from(plantelMap.entries())
    .map(([plantel, total]) => ({ plantel, total }))
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es'))
  return [{
    campus,
    rows,
    groups: groupsFor(rows),
    planteles,
    present: rows.filter((student) => student.attendance === 'present').length,
    unmarked: rows.filter((student) => student.attendance === 'unmarked').length
  }]
}))

const present = computed(() => filtered.value.filter((student) => student.attendance === 'present').length)
const marked = computed(() => filtered.value.filter((student) => student.attendance !== 'unmarked').length)
const percent = computed(() => filtered.value.length ? Math.round((marked.value / filtered.value.length) * 100) : 0)
const scopeLabel = computed(() => {
  if (scope.plantel.value !== 'all') return `Plantel ${scope.plantel.value}`
  if (scope.campus.value !== 'all') return `Campus ${scope.campus.value}`
  return 'Toluca + Metepec'
})

const setCampus = (campus: 'all' | CampusName) => scope.setCampus(campus, summaries.value)
const setPlantel = (plantel: string) => scope.setPlantel(plantel, summaries.value)
const setProgram = (value: 'all' | ProgramKind) => { program.value = value }
const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status)

watch(summaries, (value) => scope.reconcile(value), { deep: true })

onMounted(async () => {
  scope.initialize()
  await summer.load()
  scope.reconcile(summaries.value)
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
        <span class="day-hero__scope"><School2 :size="15" />{{ scopeLabel }}</span>
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
      <SummaryCards
        :students="summer.snapshot.value.students"
        :summaries="summaries"
        :selected-campus="scope.campus.value"
        :selected-plantel="scope.plantel.value"
        :selected-program="program"
        @campus="setCampus"
        @plantel="setPlantel"
        @program="setProgram"
      />
      <FilterDock
        v-model:search="search"
        v-model:group="group"
        v-model:program="program"
        :plantel="scope.plantel.value"
        :planteles="plantelOptions"
        @update:plantel="setPlantel"
      />

      <section class="attendance-countbar">
        <div><UsersRound :size="18" /><strong>{{ filtered.length }}</strong><span>alumnos</span></div>
        <div><CheckCircle2 :size="18" /><strong>{{ present }}</strong><span>presentes</span></div>
        <span class="attendance-countbar__scope">{{ scopeLabel }}</span>
      </section>

      <div v-if="filtered.length" class="campus-lists">
        <section v-for="campusSection in campusSections" :key="campusSection.campus" class="campus-list">
          <header class="campus-list__header">
            <span class="campus-list__icon"><School2 :size="23" /></span>
            <div class="campus-list__identity">
              <span>Campus</span>
              <h2>{{ campusSection.campus }}</h2>
              <div class="campus-list__planteles">
                <span v-for="plantel in campusSection.planteles" :key="plantel.plantel"><MapPin :size="12" />{{ plantel.plantel }} · {{ plantel.total }}</span>
              </div>
            </div>
            <div class="campus-list__numbers">
              <strong>{{ campusSection.present }}/{{ campusSection.rows.length }}</strong>
              <span>{{ campusSection.unmarked }} por marcar</span>
            </div>
          </header>

          <div class="age-sections">
            <section v-for="section in campusSection.groups" :key="`${campusSection.campus}-${section.key}`" class="age-section">
              <header class="age-section__header">
                <img :src="section.icon" alt="">
                <div><h3>{{ section.label }}</h3><span>{{ section.students.length }}</span></div>
              </header>
              <div class="student-grid">
                <StudentAttendanceCard v-for="student in section.students" :key="student.matricula" :student="student" @mark="mark" />
              </div>
            </section>
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
