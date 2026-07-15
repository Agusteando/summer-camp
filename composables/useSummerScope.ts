import type { CampusFilter, CampusName, PlantelSummary, SummerStudent } from '~/types/summer'

const CAMPUS_STORAGE_KEY = 'summer-scope:campus:v1'
const PLANTEL_STORAGE_KEY = 'summer-scope:plantel:v1'

export const useSummerScope = () => {
  const campus = useState<CampusFilter>('summer-scope-campus', () => 'all')
  const plantel = useState<string>('summer-scope-plantel', () => 'all')
  const initialized = useState('summer-scope-initialized', () => false)

  const persist = () => {
    if (!import.meta.client) return
    localStorage.setItem(CAMPUS_STORAGE_KEY, campus.value)
    localStorage.setItem(PLANTEL_STORAGE_KEY, plantel.value)
  }

  const initialize = () => {
    if (!import.meta.client || initialized.value) return
    const storedCampus = localStorage.getItem(CAMPUS_STORAGE_KEY)
    const storedPlantel = localStorage.getItem(PLANTEL_STORAGE_KEY)
    if (storedCampus === 'Toluca' || storedCampus === 'Metepec' || storedCampus === 'all') campus.value = storedCampus
    if (storedPlantel) plantel.value = storedPlantel
    initialized.value = true
  }

  const reconcile = (summaries: PlantelSummary[]) => {
    const selected = summaries.find((summary) => summary.plantel === plantel.value)
    if (plantel.value !== 'all' && !selected) plantel.value = 'all'
    if (selected && campus.value !== 'all' && selected.campus !== campus.value) plantel.value = 'all'
    persist()
  }

  const setCampus = (value: CampusFilter, summaries: PlantelSummary[] = []) => {
    campus.value = value
    if (plantel.value !== 'all') {
      const selected = summaries.find((summary) => summary.plantel === plantel.value)
      if (!selected || (value !== 'all' && selected.campus !== value)) plantel.value = 'all'
    }
    persist()
  }

  const setPlantel = (value: string, summaries: PlantelSummary[] = []) => {
    plantel.value = value
    if (value !== 'all') {
      const selected = summaries.find((summary) => summary.plantel === value)
      if (selected?.campus === 'Toluca' || selected?.campus === 'Metepec') campus.value = selected.campus as CampusName
    }
    persist()
  }

  const matches = (student: SummerStudent) => {
    if (campus.value !== 'all' && student.campus !== campus.value) return false
    if (plantel.value !== 'all' && student.plantel !== plantel.value) return false
    return true
  }

  return { campus, plantel, initialize, reconcile, setCampus, setPlantel, matches }
}
