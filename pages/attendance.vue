<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, Search, UsersRound, X } from '@lucide/vue'
import { ageGroupViewLabel, attendanceStatusFor, attendanceTypeLabel, attendanceTypeShortLabel, plantelSortIndex } from '~/shared/catalog'
import type { AgeGroupView, AttendanceType, CampusName, ProgramScope, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const ageView = useAgeGroupView()
const attendanceTypeView = useAttendanceTypeView()
const excel = useExcelExport()
scope.initialize()

const search = ref('')
const selectionAnchor = ref<HTMLElement | null>(null)
const contentAnchor = ref<HTMLElement | null>(null)
const workspaceAnchor = ref<HTMLElement | null>(null)

const students = computed(() => summer.snapshot.value?.students || [])
const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const scopedStudents = computed(() => students.value
  .filter(scope.matches)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.name.localeCompare(b.name, 'es-MX')))
const attendanceRoster = computed(() => scopedStudents.value.filter(attendanceTypeView.matches))
const ageStudents = computed(() => attendanceRoster.value.filter(ageView.matches))
const visibleStudents = computed(() => ageStudents.value.filter((student) => {
  if (!normalizedSearch.value) return true
  return `${student.name} ${student.folio} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)
}))
const statusFor = (student: SummerStudent) => attendanceStatusFor(student, attendanceTypeView.activeType.value)
const present = computed(() => ageStudents.value.filter((student) => statusFor(student) === 'present').length)
const absent = computed(() => ageStudents.value.filter((student) => statusFor(student) === 'absent').length)
const pending = computed(() => ageStudents.value.filter((student) => statusFor(student) === 'unmarked').length)
const completed = computed(() => ageStudents.value.length ? Math.round(((present.value + absent.value) / ageStudents.value.length) * 100) : 0)
const activeAttendanceLabel = computed(() => attendanceTypeLabel(attendanceTypeView.activeType.value))
const activeAttendanceShortLabel = computed(() => attendanceTypeShortLabel(attendanceTypeView.activeType.value))
const activeContextLabel = computed(() => `${activeAttendanceLabel.value} · ${ageGroupViewLabel(ageView.activeGroup.value)}`)

const scrollTo = async (element: HTMLElement | null) => {
  if (!import.meta.client || !element) return
  await nextTick()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

const focusWorkspace = async () => {
  if (!import.meta.client || !workspaceAnchor.value) return
  await nextTick()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const topbarHeight = document.querySelector<HTMLElement>('.topbar')?.offsetHeight || 0
  const toolbarHeight = contentAnchor.value?.offsetHeight || 0
  const top = workspaceAnchor.value.getBoundingClientRect().top + window.scrollY - topbarHeight - toolbarHeight - 10
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' })
}

const resetAttendanceContext = () => {
  ageView.reset()
  attendanceTypeView.reset()
}
const setCampus = (campus: CampusName) => {
  resetAttendanceContext()
  scope.setCampus(campus)
}
const setProgram = (program: ProgramScope) => {
  resetAttendanceContext()
  scope.setProgram(program)
  search.value = ''
}
const setAttendanceType = async (type: AttendanceType) => {
  if (attendanceTypeView.activeType.value === type) return
  attendanceTypeView.setType(type)
  await nextTick()
  ageView.reconcile(attendanceRoster.value)
  search.value = ''
  await focusWorkspace()
}
const setAgeGroup = async (group: AgeGroupView) => {
  if (ageView.activeGroup.value === group) return
  ageView.setGroup(group)
  search.value = ''
  await focusWorkspace()
}
const goBack = async () => {
  scope.back()
  resetAttendanceContext()
  search.value = ''
  await nextTick()
  await scrollTo(selectionAnchor.value)
}
const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status, attendanceTypeView.activeType.value)
const exportAttendance = () => {
  if (!scope.campus.value || !scope.program.value) return
  return excel.exportStudents({
    students: attendanceRoster.value,
    campus: scope.campus.value,
    program: scope.program.value,
    date: summer.selectedDate.value,
    includeAttendance: true,
    attendanceType: attendanceTypeView.activeType.value
  })
}

watch(() => scope.ready.value, async (ready, previous) => {
  if (ready && !previous) {
    await nextTick()
    await scrollTo(contentAnchor.value)
  }
})
watch(summaries, (value) => scope.reconcile(value), { deep: true })
watch(scopedStudents, (value) => attendanceTypeView.reconcile(value), { deep: true, immediate: true })
watch(attendanceRoster, (value) => ageView.reconcile(value), { deep: true, immediate: true })

onMounted(() => {
  summer.startPolling()
  scope.reconcile(summaries.value)
})
onBeforeUnmount(() => summer.stopPolling())
</script>

<template>
  <div class="page-container attendance-page" :class="{ 'page-container--focused': scope.ready.value }">
    <section v-if="!scope.ready.value" class="product-hero product-hero--selection">
      <div>
        <span>Summer Camp 26</span>
        <h1>Asistencia</h1>
      </div>
      <UsersRound :size="38" :stroke-width="1.5" />
    </section>

    <template v-if="summer.snapshot.value">
      <div v-if="!scope.ready.value" ref="selectionAnchor" class="journey-anchor">
        <SummerScopePicker
          :summaries="summaries"
          :selected-campus="scope.campus.value"
          :selected-program="scope.program.value"
          @campus="setCampus"
          @program="setProgram"
          @back="goBack"
        />
      </div>

      <template v-if="scope.ready.value && scope.campus.value && scope.program.value">
        <div ref="contentAnchor" class="content-anchor">
          <ScopeToolbar
            :campus="scope.campus.value"
            :program="scope.program.value"
            :total="scopedStudents.length"
            :exporting="excel.exporting.value"
            @back="goBack"
            @export="exportAttendance"
          >
            <template #utility>
              <label class="toolbar-date-control">
                <CalendarDays :size="16" />
                <input :value="summer.selectedDate.value" type="date" aria-label="Fecha de asistencia" @change="summer.setDate(($event.target as HTMLInputElement).value)">
              </label>
            </template>
            <template #context>
              <div class="scope-context-filters scope-context-filters--attendance">
                <AttendanceTypeSwitcher
                  :students="scopedStudents"
                  :model-value="attendanceTypeView.activeType.value"
                  @update:model-value="setAttendanceType"
                />
                <AgeGroupSwitcher
                  :students="attendanceRoster"
                  :model-value="ageView.activeGroup.value"
                  @update:model-value="setAgeGroup"
                />
              </div>
            </template>
          </ScopeToolbar>
        </div>

        <div v-if="excel.error.value" class="export-error">{{ excel.error.value }}</div>

        <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
          <CloudOff :size="18" />
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} marcación{{ summer.pendingCount.value === 1 ? '' : 'es' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }}</span>
          <span v-else>Sin conexión</span>
        </div>

        <section ref="workspaceAnchor" class="attendance-workspace workspace-anchor">
          <div class="attendance-progress">
            <div><UsersRound :size="17" /><strong>{{ ageStudents.length }}</strong><span>{{ activeAttendanceShortLabel }}</span></div>
            <div class="is-present"><CheckCircle2 :size="17" /><strong>{{ present }}</strong><span>Presentes</span></div>
            <div class="is-absent"><strong>{{ absent }}</strong><span>Ausentes</span></div>
            <div><strong>{{ pending }}</strong><span>Pendientes</span></div>
            <span class="attendance-progress__track"><i :style="{ width: `${completed}%` }" /></span>
          </div>

          <header class="attendance-list-header">
            <div><small>{{ activeContextLabel }}</small><h2 aria-live="polite">{{ completed }}% completado</h2></div>
            <label class="compact-search">
              <Search :size="18" />
              <input v-model="search" type="search" placeholder="Buscar alumno" aria-label="Buscar alumno">
              <button v-if="search" type="button" aria-label="Limpiar búsqueda" @click="search = ''"><X :size="16" /></button>
            </label>
          </header>

          <div v-if="visibleStudents.length" class="attendance-list">
            <AttendanceStudentRow
              v-for="(student, index) in visibleStudents"
              :key="student.id"
              :student="student"
              :index="index"
              :status="statusFor(student)"
              :attendance-type="attendanceTypeView.activeType.value"
              @mark="mark"
            />
          </div>
          <div v-else class="empty-state">
            <img src="/icons/abejas.png" alt="">
            <strong>Sin alumnos</strong>
          </div>
        </section>
      </template>
    </template>

    <div v-else-if="summer.loading.value" class="loading-panel">
      <div class="skeleton-stack"><div v-for="item in 7" :key="item" class="row-skeleton" /></div>
    </div>

    <div v-else class="load-error-panel">
      <span><CloudOff :size="34" /></span>
      <div><strong>No se pudo cargar la asistencia</strong><p>{{ summer.error.value || 'La solicitud terminó sin datos.' }}</p></div>
      <button class="secondary-button" type="button" @click="summer.refresh(false)">Reintentar</button>
    </div>
  </div>
</template>
