import type { CampusFilter, CampusName, PlantelSummary, SummerStudent } from '~/types/summer'

export const useSummerScope = () => {
  const campus = useState<CampusFilter>('summer-scope-campus-sheets-v2', () => null)
  const plantel = useState<string>('summer-scope-plantel-sheets-v2', () => 'all')

  const initialize = () => undefined

  const reconcile = (summaries: PlantelSummary[]) => {
    if (!campus.value) {
      plantel.value = 'all'
      return
    }

    const selected = summaries.find((summary) => summary.plantel === plantel.value)
    if (plantel.value !== 'all' && (!selected || selected.campus !== campus.value)) {
      plantel.value = 'all'
    }
  }

  const setCampus = (value: CampusName) => {
    campus.value = value
    plantel.value = 'all'
  }

  const setPlantel = (value: string, summaries: PlantelSummary[] = []) => {
    if (!campus.value) return
    if (value !== 'all') {
      const selected = summaries.find((summary) => summary.plantel === value)
      if (!selected || selected.campus !== campus.value) return
    }
    plantel.value = value
  }

  const clearCampus = () => {
    campus.value = null
    plantel.value = 'all'
  }

  const matches = (student: SummerStudent) => {
    if (!campus.value || student.campus !== campus.value) return false
    if (plantel.value !== 'all' && student.plantel !== plantel.value) return false
    return true
  }

  return { campus, plantel, initialize, reconcile, setCampus, setPlantel, clearCampus, matches }
}
