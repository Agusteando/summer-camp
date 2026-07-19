<script setup lang="ts">
import { CloudOff, Search, UsersRound, X } from '@lucide/vue'
import { plantelSortIndex, programLabel } from '~/shared/catalog'
import type { CampusName, ProgramScope } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const excel = useExcelExport()
scope.initialize()

const search = ref('')
const selectionAnchor = ref<HTMLElement | null>(null)
const contentAnchor = ref<HTMLElement | null>(null)

const students = computed(() => summer.snapshot.value?.students || [])
const summaries = computed(() => summer.snapshot.value?.summaries || [])
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase('es-MX'))
const scopedStudents = computed(() => students.value
  .filter(scope.matches)
  .sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.name.localeCompare(b.name, 'es-MX')))
const visibleStudents = computed(() => scopedStudents.value.filter((student) => {
  if (!normalizedSearch.value) return true
  return `${student.name} ${student.folio} ${student.plantel} ${student.plantelLabel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)
}))

const scrollTo = async (element: HTMLElement | null) => {
  if (!import.meta.client || !element) return
  await nextTick()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

const setCampus = (campus: CampusName) => scope.setCampus(campus)
const setProgram = (program: ProgramScope) => {
  scope.setProgram(program)
  search.value = ''
}
const resetScope = async () => {
  scope.clear()
  search.value = ''
  await nextTick()
  await scrollTo(selectionAnchor.value)
}
const exportList = () => {
  if (!scope.campus.value || !scope.program.value) return
  return excel.exportStudents({
    students: scopedStudents.value,
    campus: scope.campus.value,
    program: scope.program.value
  })
}

watch(() => scope.ready.value, async (ready, previous) => {
  if (ready && !previous) {
    await nextTick()
    await scrollTo(contentAnchor.value)
  }
})
watch(summaries, (value) => scope.reconcile(value), { deep: true })

onMounted(() => {
  summer.startPolling()
  scope.reconcile(summaries.value)
})
onBeforeUnmount(() => summer.stopPolling())
</script>

<template>
  <div class="page-container roster-page" :class="{ 'page-container--focused': scope.ready.value }">
    <section v-if="!scope.ready.value" class="product-hero product-hero--selection">
      <div>
        <span>Summer Camp 26</span>
        <h1>Lista de alumnos</h1>
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
          @reset="resetScope"
        />
      </div>

      <template v-if="scope.ready.value && scope.campus.value && scope.program.value">
        <div ref="contentAnchor" class="content-anchor">
          <ScopeToolbar
            :campus="scope.campus.value"
            :program="scope.program.value"
            :total="scopedStudents.length"
            :exporting="excel.exporting.value"
            @reset="resetScope"
            @export="exportList"
          />
        </div>

        <div v-if="excel.error.value" class="export-error">{{ excel.error.value }}</div>

        <div v-if="!connectivity.browserOnline.value || summer.pendingCount.value" class="offline-banner">
          <CloudOff :size="18" />
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} cambio{{ summer.pendingCount.value === 1 ? '' : 's' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }} de sincronizar</span>
          <span v-else>Sin conexión. Se muestra la última lista guardada.</span>
        </div>

        <section class="list-workspace">
          <header class="list-workspace__header">
            <div>
              <small>{{ programLabel(scope.program.value) }}</small>
              <h2>{{ visibleStudents.length }} alumno{{ visibleStudents.length === 1 ? '' : 's' }}</h2>
            </div>
            <label class="compact-search">
              <Search :size="18" />
              <input v-model="search" type="search" placeholder="Buscar alumno o folio" aria-label="Buscar alumno o folio">
              <button v-if="search" type="button" aria-label="Limpiar búsqueda" @click="search = ''"><X :size="16" /></button>
            </label>
          </header>

          <div v-if="visibleStudents.length" class="roster-list">
            <div class="roster-list__columns" aria-hidden="true">
              <span>#</span><span>Alumno</span><span>Horario</span><span>Servicios</span><span />
            </div>
            <StudentRosterRow v-for="(student, index) in visibleStudents" :key="student.id" :student="student" :index="index" />
          </div>
          <div v-else class="empty-state">
            <img src="/icons/dinos.png" alt="">
            <strong>Sin alumnos</strong>
            <p>{{ search ? 'Prueba con otro nombre o folio.' : 'No hay alumnos cargados en este grupo.' }}</p>
          </div>
        </section>
      </template>
    </template>

    <div v-else-if="summer.loading.value" class="loading-panel">
      <div class="skeleton-stack"><div v-for="item in 7" :key="item" class="row-skeleton" /></div>
    </div>

    <div v-else class="load-error-panel">
      <span><CloudOff :size="34" /></span>
      <div><strong>No se pudo cargar la lista</strong><p>{{ summer.error.value || 'La solicitud terminó sin datos.' }}</p></div>
      <button class="secondary-button" type="button" @click="summer.refresh(false)">Reintentar</button>
    </div>
  </div>
</template>
