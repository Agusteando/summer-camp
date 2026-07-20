<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, Search, UsersRound, X } from '@lucide/vue'
import { ageGroupViewLabel, plantelSortIndex, serviceViewLabel } from '~/shared/catalog'
import type { AgeGroupView, CampusName, ProgramScope, ServiceView, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const ageView = useAgeGroupView()
const serviceView = useServiceView()
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
const ageStudents = computed(() => scopedStudents.value.filter(ageView.matches))
const serviceStudents = computed(() => ageStudents.value.filter(serviceView.matches))
const visibleStudents = computed(() => serviceStudents.value.filter((student) => {
  if (!normalizedSearch.value) return true
  return `${student.name} ${student.folio} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)
}))
const present = computed(() => serviceStudents.value.filter((student) => student.attendance === 'present').length)
const absent = computed(() => serviceStudents.value.filter((student) => student.attendance === 'absent').length)
const pending = computed(() => serviceStudents.value.filter((student) => student.attendance === 'unmarked').length)
const completed = computed(() => serviceStudents.value.length ? Math.round(((present.value + absent.value) / serviceStudents.value.length) * 100) : 0)
const activeAgeLabel = computed(() => ageGroupViewLabel(ageView.activeGroup.value))
const activeContextLabel = computed(() => serviceView.activeService.value === 'all'
  ? activeAgeLabel.value
  : `${activeAgeLabel.value} · ${serviceViewLabel(serviceView.activeService.value)}`)

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

const resetContextFilters = () => {
  ageView.reset()
  serviceView.reset()
}
const setCampus = (campus: CampusName) => {
  resetContextFilters()
  scope.setCampus(campus)
}
const setProgram = (program: ProgramScope) => {
  resetContextFilters()
  scope.setProgram(program)
  search.value = ''
}
const setAgeGroup = async (group: AgeGroupView) => {
  if (ageView.activeGroup.value === group) return
  ageView.setGroup(group)
  serviceView.reconcile(ageStudents.value)
  search.value = ''
  await focusWorkspace()
}
const setService = async (service: ServiceView) => {
  if (serviceView.activeService.value === service) return
  serviceView.setService(service)
  search.value = ''
  await focusWorkspace()
}
const goBack = async () => {
  scope.back()
  resetContextFilters()
  search.value = ''
  await nextTick()
  await scrollTo(selectionAnchor.value)
}
const mark = (student: SummerStudent, status: 'present' | 'absent') => summer.markAttendance(student, status)
const exportAttendance = () => {
  if (!scope.campus.value || !scope.program.value) return
  return excel.exportStudents({
    students: scopedStudents.value,
    campus: scope.campus.value,
    program: scope.program.value,
    date: summer.selectedDate.value,
    includeAttendance: true
  })
}

watch(() => scope.ready.value, async (ready, previous) => {
  if (ready && !previous) {
    await nextTick()
    await scrollTo(contentAnchor.value)
  }
})
watch(summaries, (value) => scope.reconcile(value), { deep: true })
watch(scopedStudents, (value) => ageView.reconcile(value), { deep: true, immediate: true })
watch(ageStudents, (value) => serviceView.reconcile(value), { deep: true, immediate: true })

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
              <div class="scope-context-filters">
                <AgeGroupSwitcher
                  :students="scopedStudents"
                  :model-value="ageView.activeGroup.value"
                  @update:model-value="setAgeGroup"
                />
                <ServiceFilterSwitcher
                  :students="ageStudents"
                  :model-value="serviceView.activeService.value"
                  @update:model-value="setService"
                />
              </div>
            </template>
          </ScopeToolbar>
        </div>

        <div v-if="excel.error.value" class="export-error">{{ excel.error.value }}</div>

        <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
          <CloudOff :size="18" />
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} asistencia{{ summer.pendingCount.value === 1 ? '' : 's' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }} de sincronizar</span>
          <span v-else>Sin conexión. Los cambios se enviarán después.</span>
        </div>

        <section ref="workspaceAnchor" class="attendance-workspace workspace-anchor">
          <div class="attendance-progress">
            <div><UsersRound :size="17" /><strong>{{ serviceStudents.length }}</strong><span>Alumnos</span></div>
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
            <AttendanceStudentRow v-for="(student, index) in visibleStudents" :key="student.id" :student="student" :index="index" @mark="mark" />
          </div>
          <div v-else class="empty-state">
            <img src="/icons/abejas.png" alt="">
            <strong>Sin alumnos</strong>
            <p>{{ search ? 'Prueba con otro nombre.' : 'No hay alumnos con este filtro.' }}</p>
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
