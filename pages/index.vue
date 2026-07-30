<script setup lang="ts">
import { CloudOff, Printer, Search, UsersRound, X } from '@lucide/vue'
import { AGE_GROUPS, SERVICE_FILTERS, ageGroupViewLabel, plantelSortIndex, programLabel, serviceDisplayLabel, serviceViewLabel } from '~/shared/catalog'
import type { AgeGroupView, CampusName, ProgramScope, ServiceView, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const connectivity = useConnectivity()
const scope = useSummerScope()
const ageView = useAgeGroupView()
const serviceView = useServiceView()
const excel = useExcelExport()
scope.initialize()

const search = ref('')
const printing = ref(false)
const printGeneratedAt = ref('')
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
  return `${student.name} ${student.folio} ${student.plantel} ${student.plantelLabel}`.toLocaleLowerCase('es-MX').includes(normalizedSearch.value)
}))
const activeAgeLabel = computed(() => ageGroupViewLabel(ageView.activeGroup.value))
const activeContextLabel = computed(() => serviceView.activeService.value === 'all'
  ? activeAgeLabel.value
  : `${activeAgeLabel.value} · ${serviceViewLabel(serviceView.activeService.value)}`)

const ageLabel = (student: SummerStudent) => {
  if (student.age !== null) return `${student.age} años`
  const group = AGE_GROUPS.find((item) => item.key === student.ageGroup)
  return group ? `${group.label} años` : 'Edad no registrada'
}

const serviceSummary = (student: SummerStudent) => {
  const labels = SERVICE_FILTERS
    .filter(({ key }) => student.services[key])
    .map(({ key }) => serviceDisplayLabel(key, student.serviceValues[key]))
  return labels.length ? labels.join(' · ') : 'Sin servicios adicionales'
}

const contactSummary = (student: SummerStudent) => {
  const contact = student.contacts.primary.name || student.contacts.primary.phone
    ? student.contacts.primary
    : student.contacts.alternate
  return {
    name: contact.name || 'Sin contacto registrado',
    detail: [contact.relation, contact.phone].filter(Boolean).join(' · ')
  }
}

type PrintStudentEntry = {
  number: number
  student: SummerStudent
  age: string
  services: string
  contact: ReturnType<typeof contactSummary>
}

const printGroups = computed(() => {
  let itemNumber = 0
  const groups = new Map<string, { plantel: string; label: string; students: PrintStudentEntry[] }>()

  visibleStudents.value.forEach((student) => {
    const current = groups.get(student.plantel) || {
      plantel: student.plantel,
      label: student.plantelLabel,
      students: []
    }

    current.students.push({
      number: ++itemNumber,
      student,
      age: ageLabel(student),
      services: serviceSummary(student),
      contact: contactSummary(student)
    })
    groups.set(student.plantel, current)
  })

  return Array.from(groups.values())
})

const restorePrintState = (previousTitle: string) => {
  document.title = previousTitle
  printing.value = false
}

const printList = async () => {
  if (!import.meta.client || !visibleStudents.value.length || !scope.campus.value || !scope.program.value) return

  printing.value = true
  printGeneratedAt.value = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date())

  const previousTitle = document.title
  const fileContext = activeContextLabel.value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  document.title = `Lista-${scope.campus.value}-${programLabel(scope.program.value)}-${fileContext}`

  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  let restoreTimer = 0
  const restore = () => {
    window.removeEventListener('afterprint', restore)
    window.clearTimeout(restoreTimer)
    restorePrintState(previousTitle)
  }
  window.addEventListener('afterprint', restore, { once: true })
  restoreTimer = window.setTimeout(restore, 1800)
  window.print()
}

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
watch(scopedStudents, (value) => ageView.reconcile(value), { deep: true, immediate: true })
watch(ageStudents, (value) => serviceView.reconcile(value), { deep: true, immediate: true })

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
            @export="exportList"
          >
            <template #utility>
              <button
                class="secondary-button print-button"
                type="button"
                title="Imprimir o guardar como PDF"
                aria-label="Imprimir lista o guardar como PDF"
                :disabled="printing || !visibleStudents.length"
                @click="printList"
              >
                <Printer :size="17" />
                <span>{{ printing ? 'Abriendo…' : 'PDF' }}</span>
              </button>
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
          <span v-if="summer.pendingCount.value">{{ summer.pendingCount.value }} cambio{{ summer.pendingCount.value === 1 ? '' : 's' }} pendiente{{ summer.pendingCount.value === 1 ? '' : 's' }} de sincronizar</span>
          <span v-else>Sin conexión. Se muestra la última lista guardada.</span>
        </div>

        <section ref="workspaceAnchor" class="list-workspace workspace-anchor">
          <header class="list-workspace__header">
            <div>
              <small>{{ activeContextLabel }}</small>
              <h2 aria-live="polite">{{ visibleStudents.length }} alumno{{ visibleStudents.length === 1 ? '' : 's' }}</h2>
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
            <p>{{ search ? 'Prueba con otro nombre o folio.' : 'No hay alumnos con este filtro.' }}</p>
          </div>
        </section>

        <section class="print-roster" aria-label="Lista para imprimir">
          <header class="print-roster__header">
            <img src="/brand/iecs-iedis-logo.png" alt="IECS e IEDIS">
            <div class="print-roster__heading">
              <span>Summer Camp 2026</span>
              <h1>Lista de alumnos</h1>
              <p>{{ scope.campus.value }} · {{ programLabel(scope.program.value) }} · {{ activeContextLabel }}</p>
            </div>
            <div class="print-roster__summary">
              <strong>{{ visibleStudents.length }}</strong>
              <span>alumno{{ visibleStudents.length === 1 ? '' : 's' }}</span>
            </div>
          </header>

          <div class="print-roster__meta">
            <span>Generada: {{ printGeneratedAt }}</span>
            <span v-if="search">Búsqueda aplicada: “{{ search.trim() }}”</span>
            <span>Orden: plantel y nombre</span>
          </div>

          <section v-for="group in printGroups" :key="group.plantel" class="print-roster__group">
            <header class="print-roster__group-heading">
              <div>
                <strong>{{ group.label }}</strong>
                <span>{{ group.plantel }}</span>
              </div>
              <b>{{ group.students.length }} alumno{{ group.students.length === 1 ? '' : 's' }}</b>
            </header>

            <table>
              <colgroup>
                <col class="print-col-number">
                <col class="print-col-student">
                <col class="print-col-schedule">
                <col class="print-col-services">
                <col class="print-col-contact">
                <col class="print-col-notes">
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Alumno</th>
                  <th>Horario</th>
                  <th>Servicios</th>
                  <th>Contacto principal</th>
                  <th>Alertas y observaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in group.students" :key="entry.student.id">
                  <td class="print-roster__number">{{ entry.number }}</td>
                  <td>
                    <strong>{{ entry.student.name }}</strong>
                    <span>#{{ entry.student.folio }} · {{ entry.age }}</span>
                  </td>
                  <td>
                    <strong>{{ entry.student.schedule.entry || '—' }}–{{ entry.student.schedule.exit || '—' }}</strong>
                  </td>
                  <td>{{ entry.services }}</td>
                  <td>
                    <strong>{{ entry.contact.name }}</strong>
                    <span v-if="entry.contact.detail">{{ entry.contact.detail }}</span>
                  </td>
                  <td>
                    <span v-if="entry.student.allergies" class="print-roster__alert"><b>Alergias:</b> {{ entry.student.allergies }}</span>
                    <span v-if="entry.student.observations"><b>Obs.:</b> {{ entry.student.observations }}</span>
                    <span v-if="!entry.student.allergies && !entry.student.observations" class="print-roster__empty-note">Sin alertas</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer class="print-roster__footer">
            <span>Summer Camp 2026 · IECS / IEDIS</span>
            <span>Uso interno</span>
          </footer>
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
