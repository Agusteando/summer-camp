<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, UsersRound } from '@lucide/vue'
import { AGE_GROUPS, plantelSortIndex } from '~/shared/catalog'
import type { CampusName, ProgramKind, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const search = ref('')
const group = ref('all')
const program = ref<'all' | ProgramKind>('all')
const service = ref('all')
const selectedStudentId = ref<string | null>(null)

const students = computed(() => summer.snapshot.value?.students || [])
const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const hasCampus = computed(() => Boolean(scope.campus.value))

const selectedCampusTotal = computed(() => summaries.value
  .filter((summary) => summary.campus === scope.campus.value)
  .reduce((sum, summary) => sum + summary.total, 0))

const selectedCampusName = computed(() => scope.campus.value || '')

const plantelOptions = computed(() => {
  if (!scope.campus.value) return []
  return summaries.value
    .filter((summary) => summary.campus === scope.campus.value)
    .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel))
})

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
    ? { label: 'Sin edad', icon: '/icons/dinos.png' }
    : { label: 'Otros', icon: '/icons/pandas.png' }
}

const groupedStudents = computed(() => groupOrder.flatMap((key) => {
  const rows = filtered.value.filter((student) => student.ageGroup === key)
  return rows.length ? [{ key, ...groupMeta(key), students: rows }] : []
}))

const present = computed(() => filtered.value.filter((student) => student.attendance === 'present').length)
const unmarked = computed(() => filtered.value.filter((student) => student.attendance === 'unmarked').length)
const percent = computed(() => filtered.value.length ? Math.round((present.value / filtered.value.length) * 100) : 0)
const selectedStudent = computed(() => filtered.value.find((student) => student.id === selectedStudentId.value) || filtered.value[0] || null)

const setCampus = (campus: CampusName) => {
  scope.setCampus(campus)
  search.value = ''
  group.value = 'all'
  program.value = 'all'
  service.value = 'all'
}
const setPlantel = (plantel: string) => scope.setPlantel(plantel, summaries.value)
const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status)
const selectStudent = (student: SummerStudent) => { selectedStudentId.value = student.id }

watch(summaries, (value) => scope.reconcile(value), { deep: true })

onMounted(() => {
  scope.initialize()
  summer.startPolling()
  scope.reconcile(summaries.value)
})
onBeforeUnmount(() => summer.stopPolling())
</script>

<template>
  <div class="page-container attendance-page">
    <section class="summer-hero">
      <div class="summer-hero__orb summer-hero__orb--one" />
      <div class="summer-hero__orb summer-hero__orb--two" />
      <div class="summer-hero__copy">
        <h1>Asistencia</h1>
        <span>Summer Camp 26</span>
      </div>
      <label class="date-control">
        <CalendarDays :size="19" />
        <input :value="summer.selectedDate.value" type="date" aria-label="Fecha" @change="summer.setDate(($event.target as HTMLInputElement).value)">
      </label>
    </section>

    <template v-if="summer.snapshot.value">
      <SummaryCards :students="students" :loading="summer.loading.value" />

      <CampusScopeBar
        v-if="summaries.length"
        :summaries="summaries"
        :selected-campus="scope.campus.value"
        :selected-plantel="scope.plantel.value"
        @campus="setCampus"
        @plantel="setPlantel"
      />

      <template v-if="hasCampus">
        <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
          <CloudOff :size="18" />
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }}</span>
          <span v-else>Offline</span>
        </div>

        <section class="attendance-workspace">
          <header class="workspace-heading">
            <div>
              <span>{{ selectedCampusName }}</span>
              <strong>{{ selectedCampusTotal }}</strong>
            </div>
            <div class="workspace-heading__plantels">
              <span v-for="item in plantelOptions" :key="item.plantel">{{ item.plantel }}</span>
            </div>
          </header>

          <FilterDock
            v-model:search="search"
            v-model:group="group"
            v-model:program="program"
            v-model:service="service"
          />

          <section class="attendance-countbar">
            <div><UsersRound :size="17" /><strong>{{ filtered.length }}</strong><span>Lista</span></div>
            <div><CheckCircle2 :size="17" /><strong>{{ present }}</strong><span>Presentes</span></div>
            <div><strong>{{ unmarked }}</strong><span>Pendientes</span></div>
            <span class="attendance-countbar__progress"><i :style="{ width: `${percent}%` }" /></span>
          </section>

          <div class="workspace-grid">
            <div class="workspace-list">
              <div v-if="filtered.length" class="age-sections">
                <section v-for="section in groupedStudents" :key="section.key" class="age-section">
                  <header class="age-section__header">
                    <img :src="section.icon" alt="">
                    <div><h2>{{ section.label }}</h2><span>{{ section.students.length }} alumnos</span></div>
                  </header>
                  <div class="student-grid">
                    <StudentAttendanceCard v-for="student in section.students" :key="student.id" :student="student" @mark="mark" @select="selectStudent" />
                  </div>
                </section>
              </div>
              <div v-else class="empty-state"><img src="/icons/dinos.png" alt=""><strong>Sin resultados</strong></div>
            </div>

            <aside v-if="selectedStudent" class="student-inspector" aria-label="Ficha del alumno seleccionado">
              <StudentDetailPanel :student="selectedStudent" @mark="mark" />
            </aside>
          </div>
        </section>
      </template>
    </template>

    <div v-else-if="summer.loading.value" class="loading-panel">
      <div class="skeleton-stack"><div v-for="item in 6" :key="item" class="student-skeleton" /></div>
    </div>

    <div v-else class="load-error-panel">
      <span><CloudOff :size="34" /></span>
      <div><strong>No se pudo cargar la lista</strong><p>{{ summer.error.value || 'La solicitud terminó sin datos.' }}</p></div>
      <button class="secondary-button" @click="summer.refresh(false)">Reintentar</button>
    </div>
  </div>
</template>
