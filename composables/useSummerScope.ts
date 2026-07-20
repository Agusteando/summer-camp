import type { CampusFilter, CampusName, PlantelSummary, ProgramScope, SummerStudent } from '~/types/summer'

const STORAGE_KEY = 'summer-camp:scope:v3'
const VALID_CAMPUSES: CampusName[] = ['Toluca', 'Metepec']
const VALID_PROGRAMS: ProgramScope[] = ['husky_dreamers', 'clinica_futbol']

export const useSummerScope = () => {
  const campus = useState<CampusFilter>('summer-scope-campus-v3', () => null)
  const program = useState<ProgramScope | null>('summer-scope-program-v3', () => null)
  const initialized = useState('summer-scope-initialized-v3', () => false)
  const ready = computed(() => Boolean(campus.value && program.value))

  const persist = () => {
    if (!import.meta.client) return
    if (!campus.value && !program.value) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ campus: campus.value, program: program.value }))
  }

  const initialize = () => {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { campus?: CampusName; program?: ProgramScope }
      campus.value = VALID_CAMPUSES.includes(saved.campus as CampusName) ? saved.campus! : null
      program.value = VALID_PROGRAMS.includes(saved.program as ProgramScope) ? saved.program! : null
      if (!campus.value) program.value = null
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      campus.value = null
      program.value = null
    }
  }

  const programCount = (summaries: PlantelSummary[], selectedCampus: CampusName, selectedProgram: ProgramScope) => summaries
    .filter((summary) => summary.campus === selectedCampus)
    .reduce((sum, summary) => sum + (selectedProgram === 'husky_dreamers' ? summary.huskyDreamers : summary.footballClinic), 0)

  const reconcile = (summaries: PlantelSummary[]) => {
    if (!summaries.length || !campus.value) return
    const campusExists = summaries.some((summary) => summary.campus === campus.value)
    if (!campusExists) {
      campus.value = null
      program.value = null
      persist()
      return
    }
    if (program.value && programCount(summaries, campus.value, program.value) === 0) {
      program.value = null
      persist()
    }
  }

  const setCampus = (value: CampusName) => {
    if (!VALID_CAMPUSES.includes(value)) return
    if (campus.value !== value) program.value = null
    campus.value = value
    persist()
  }

  const setProgram = (value: ProgramScope) => {
    if (!campus.value || !VALID_PROGRAMS.includes(value)) return
    program.value = value
    persist()
  }

  const back = () => {
    if (program.value) {
      program.value = null
      persist()
      return
    }
    if (campus.value) {
      campus.value = null
      persist()
    }
  }

  const clear = () => {
    campus.value = null
    program.value = null
    persist()
  }

  const matches = (student: SummerStudent) => Boolean(
    campus.value
    && program.value
    && student.campus === campus.value
    && student.program === program.value
  )

  return { campus, program, ready, initialize, reconcile, setCampus, setProgram, back, clear, matches }
}
