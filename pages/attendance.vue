<script setup lang="ts">
import { CalendarDays, CheckCircle2, CloudOff, Search, UsersRound, X } from '@lucide/vue'
import { plantelSortIndex } from '~/shared/catalog'
import type { CampusName, ProgramScope, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const excel = useExcelExport()
const search = ref('')
const editingScope = ref(false)

const students = computed(() => summer.snapshot.value?.students || [])
const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const scopedStudents = computed(() => students.value
  .filter(scope.matches)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.name.localeCompare(b.name, 'es-MX')))
const visibleStudents = computed(() => scopedStudents.value.filter((student) => {
  if (!normalizedSearch.value) return true
  return `${student.name} ${student.folio} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)
}))
const present = computed(() => scopedStudents.value.filter((student) => student.attendance === 'present').length)
const absent = computed(() => scopedStudents.value.filter((student) => student.attendance === 'absent').length)
const pending = computed(() => scopedStudents.value.filter((student) => student.attendance === 'unmarked').length)
const completed = computed(() => scopedStudents.value.length ? Math.round(((present.value + absent.value) / scopedStudents.value.length) * 100) : 0)

const setCampus = (campus: CampusName) => scope.setCampus(campus)
const setProgram = (program: ProgramScope) => {
  scope.setProgram(program)
  editingScope.value = false
  search.value = ''
}
const resetScope = () => {
  scope.clear()
  editingScope.value = false
  search.value = ''
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
    <section class="product-hero product-hero--attendance">
      <div>
        <span>Summer Camp 26</span>
        <h1>Asistencia</h1>
        <p>Marca presentes y ausentes únicamente dentro del grupo seleccionado.</p>
      </div>
      <label class="hero-date-control">
        <CalendarDays :size="20" />
        <span>Fecha</span>
        <input :value="summer.selectedDate.value" type="date" aria-label="Fecha de asistencia" @change="summer.setDate(($event.target as HTMLInputElement).value)">
      </label>
    </section>

    <template v-if="summer.snapshot.value">
      <SummerScopePicker
        v-if="!scope.ready.value || editingScope"
        :summaries="summaries"
        :selected-campus="scope.campus.value"
        :selected-program="scope.program.value"
        @campus="setCampus"
        @program="setProgram"
        @reset="resetScope"
      />

      <template v-if="scope.ready.value && !editingScope && scope.campus.value && scope.program.value">
        <ScopeToolbar
          :campus="scope.campus.value"
          :program="scope.program.value"
          :total="scopedStudents.length"
          :exporting="excel.exporting.value"
          @edit="editingScope = true"
          @reset="resetScope"
          @export="exportAttendance"
        />

        <div v-if="excel.error.value" class="export-error">{{ excel.error.value }}</div>

        <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
          <CloudOff :size="18" />
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} asistencia{{ summer.pendingCount.value === 1 ? '' : 's' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }} de sincronizar</span>
          <span v-else>Sin conexión. Puedes continuar; los cambios se enviarán después.</span>
        </div>

        <section class="attendance-workspace">
          <div class="attendance-progress">
            <div><UsersRound :size="17" /><strong>{{ scopedStudents.length }}</strong><span>Alumnos</span></div>
            <div class="is-present"><CheckCircle2 :size="17" /><strong>{{ present }}</strong><span>Presentes</span></div>
            <div class="is-absent"><strong>{{ absent }}</strong><span>Ausentes</span></div>
            <div><strong>{{ pending }}</strong><span>Pendientes</span></div>
            <span class="attendance-progress__track"><i :style="{ width: `${completed}%` }" /></span>
          </div>

          <header class="attendance-list-header">
            <div><small>Avance</small><h2>{{ completed }}% completado</h2></div>
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
            <strong>Sin alumnos en esta vista</strong>
            <p>{{ search ? 'Prueba con otro nombre.' : 'La modalidad seleccionada no tiene alumnos cargados.' }}</p>
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
