<script setup lang="ts">
import { Check, ChevronRight, CircleHelp, Clock3, Dumbbell, School2, Search, Utensils, Users, X } from '@lucide/vue'
import { mealLabel, plantelSortIndex, programLabel } from '~/shared/catalog'
import type { CampusName, MealPlan, PlantelSummary, ProgramKind, SummerStudent } from '~/types/summer'

const summer = useSummerData()
const device = useDeviceIdentity()
const scope = useSummerScope()
const tab = ref<'program' | 'meal' | 'age'>('program')
const search = ref('')
const selected = ref<string[]>([])
const saving = ref(false)
const notice = ref('')
const ageDrafts = reactive<Record<string, string>>({})

const candidateRows = computed(() => {
  const source = summer.snapshot.value?.students || []
  if (tab.value === 'program') return source.filter((student) => student.program === 'unassigned')
  if (tab.value === 'meal') return source.filter((student) => student.mealPlan === 'pending_one')
  return source.filter((student) => student.age === null)
})

const scopeSummaries = computed<PlantelSummary[]>(() => {
  const map = new Map<string, PlantelSummary>()
  candidateRows.value.forEach((student) => {
    const current = map.get(student.plantel) || {
      plantel: student.plantel,
      label: student.plantelLabel,
      campus: student.campus,
      total: 0,
      present: 0,
      absent: 0,
      unmarked: 0,
      food: 0,
      pendingProgram: 0
    }
    current.total += 1
    map.set(student.plantel, current)
  })
  return Array.from(map.values()).sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel) || a.plantel.localeCompare(b.plantel, 'es'))
})

const rows = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('es-MX')
  return candidateRows.value.filter((student) => {
    if (!scope.matches(student)) return false
    if (needle && !`${student.name} ${student.matricula} ${student.plantel}`.toLocaleLowerCase('es-MX').includes(needle)) return false
    return true
  })
})

const campusOrder: CampusName[] = ['Toluca', 'Metepec']
const groupedRows = computed(() => campusOrder.flatMap((campus) => {
  const students = rows.value.filter((student) => student.campus === campus)
  if (!students.length) return []
  const planteles = Array.from(new Set(students.map((student) => student.plantel)))
    .sort((a, b) => plantelSortIndex(a) - plantelSortIndex(b) || a.localeCompare(b, 'es'))
  return [{ campus, students, planteles }]
}))

const allSelected = computed(() => rows.value.length > 0 && rows.value.every((student) => selected.value.includes(student.matricula)))
const toggle = (matricula: string) => {
  selected.value = selected.value.includes(matricula) ? selected.value.filter((value) => value !== matricula) : [...selected.value, matricula]
}
const toggleAll = () => {
  selected.value = allSelected.value
    ? selected.value.filter((value) => !rows.value.some((student) => student.matricula === value))
    : Array.from(new Set([...selected.value, ...rows.value.map((student) => student.matricula)]))
}

const saveItems = async (items: any[]) => {
  if (!items.length || saving.value) return
  saving.value = true
  notice.value = ''
  try {
    await $fetch('/api/summer/overrides/batch', {
      method: 'PUT',
      headers: { 'x-summer-device-id': device.get() },
      body: { items, deviceId: device.get() }
    })
    selected.value = []
    await summer.refresh(false)
    notice.value = `${items.length} actualizados`
    setTimeout(() => { notice.value = '' }, 2200)
  } finally { saving.value = false }
}

const assignProgram = (program: ProgramKind) => saveItems(selected.value.map((matricula) => ({ matricula, program })))
const assignMeal = (mealPlan: MealPlan) => saveItems(selected.value.map((matricula) => ({ matricula, mealPlan })))
const saveAge = (student: SummerStudent) => {
  const age = Number(ageDrafts[student.matricula])
  if (!Number.isInteger(age) || age < 2 || age > 18) return
  return saveItems([{ matricula: student.matricula, ageOverride: age }])
}
const setCampus = (campus: 'all' | CampusName) => scope.setCampus(campus, scopeSummaries.value)
const setPlantel = (plantel: string) => scope.setPlantel(plantel, scopeSummaries.value)

watch(tab, () => {
  selected.value = []
  search.value = ''
  scope.reconcile(scopeSummaries.value)
})
watch(scopeSummaries, (value) => scope.reconcile(value), { deep: true })

onMounted(async () => {
  scope.initialize()
  await summer.load('page-setup-mounted')
  scope.reconcile(scopeSummaries.value)
})
</script>

<template>
  <div class="page-container setup-page">
    <section class="page-heading page-heading--setup">
      <div><span>Configuración operativa</span><h1>Organizar alumnos</h1></div>
      <Users :size="34" />
    </section>

    <div class="setup-tabs">
      <button :class="{ 'is-active': tab === 'program' }" @click="tab = 'program'">
        <Dumbbell :size="19" /><span>Programa</span><b>{{ summer.snapshot.value?.students.filter((s) => s.program === 'unassigned').length || 0 }}</b>
      </button>
      <button :class="{ 'is-active': tab === 'meal' }" @click="tab = 'meal'">
        <Utensils :size="19" /><span>Alimento</span><b>{{ summer.snapshot.value?.students.filter((s) => s.mealPlan === 'pending_one').length || 0 }}</b>
      </button>
      <button :class="{ 'is-active': tab === 'age' }" @click="tab = 'age'">
        <Clock3 :size="19" /><span>Edad</span><b>{{ summer.snapshot.value?.students.filter((s) => s.age === null).length || 0 }}</b>
      </button>
    </div>

    <CampusScopeBar
      v-if="scopeSummaries.length"
      :summaries="scopeSummaries"
      :selected-campus="scope.campus.value"
      :selected-plantel="scope.plantel.value"
      @campus="setCampus"
      @plantel="setPlantel"
    />

    <section class="setup-toolbar">
      <label class="search-box"><Search :size="18" /><input v-model="search" type="search" placeholder="Buscar alumno"></label>
      <button class="select-all" :class="{ 'is-active': allSelected }" @click="toggleAll"><Check :size="17" />{{ allSelected ? 'Quitar todos' : 'Seleccionar todos' }}</button>
    </section>

    <div v-if="notice" class="notice-toast"><Check :size="18" />{{ notice }}</div>

    <div v-if="rows.length" class="setup-campuses">
      <section v-for="campusSection in groupedRows" :key="campusSection.campus" class="setup-campus">
        <header class="setup-campus__header">
          <span><School2 :size="19" /></span>
          <div><small>Campus</small><strong>{{ campusSection.campus }}</strong></div>
          <p>{{ campusSection.planteles.join(' · ') }}</p>
          <b>{{ campusSection.students.length }}</b>
        </header>
        <div class="setup-list">
          <article v-for="student in campusSection.students" :key="student.matricula" class="setup-student" :class="{ 'is-selected': selected.includes(student.matricula) }">
            <button v-if="tab !== 'age'" class="setup-check" :aria-label="student.name" @click="toggle(student.matricula)">
              <Check v-if="selected.includes(student.matricula)" :size="18" />
            </button>
            <StudentPhoto :matricula="student.matricula" :name="student.name" :available="student.photoAvailable" :token="student.photoToken" />
            <div class="setup-student__name">
              <strong>{{ student.name }}</strong>
              <span>{{ student.plantel }} · {{ student.matricula }}</span>
            </div>
            <div v-if="tab === 'program'" class="setup-current"><CircleHelp :size="15" />{{ programLabel(student.program) }}</div>
            <div v-else-if="tab === 'meal'" class="setup-current"><Utensils :size="15" />{{ mealLabel(student.mealPlan) }}</div>
            <form v-else class="age-entry" @submit.prevent="saveAge(student)">
              <input v-model="ageDrafts[student.matricula]" type="number" min="2" max="18" inputmode="numeric" placeholder="Edad">
              <button :disabled="saving"><ChevronRight :size="21" /></button>
            </form>
          </article>
        </div>
      </section>
    </div>
    <div v-else-if="summer.snapshot.value" class="empty-state"><img src="/icons/pandas.png" alt=""><strong>Todo listo</strong></div>
    <div v-else-if="summer.loading.value" class="skeleton-stack"><div v-for="item in 6" :key="item" class="student-skeleton" /></div>
    <div v-else class="load-error-panel">
      <span><X :size="30" /></span>
      <div><strong>No se pudo cargar la lista</strong><p>{{ summer.error.value || 'La solicitud terminó sin datos.' }}</p></div>
      <button class="secondary-button" @click="summer.refresh(false)">Reintentar</button>
    </div>

    <div v-if="selected.length && tab !== 'age'" class="bulk-dock">
      <span>{{ selected.length }}</span>
      <template v-if="tab === 'program'">
        <button class="bulk-choice bulk-choice--husky" :disabled="saving" @click="assignProgram('husky_dreamers')"><Users :size="19" />Husky Dreamers</button>
        <button class="bulk-choice bulk-choice--football" :disabled="saving" @click="assignProgram('clinica_futbol')"><Dumbbell :size="19" />Clínica</button>
      </template>
      <template v-else>
        <button class="bulk-choice bulk-choice--food" :disabled="saving" @click="assignMeal('comida')"><Utensils :size="19" />Comida</button>
        <button class="bulk-choice bulk-choice--dinner" :disabled="saving" @click="assignMeal('cena')"><Clock3 :size="19" />Cena</button>
      </template>
      <button class="bulk-close" aria-label="Cerrar" @click="selected = []"><X :size="20" /></button>
    </div>
  </div>
</template>
