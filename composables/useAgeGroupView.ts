import { AGE_GROUPS, ageGroupViewKeyFor } from '~/shared/catalog'
import type { AgeGroupView, SummerStudent } from '~/types/summer'

const VALID_GROUPS = new Set<AgeGroupView>(['all', 'other', ...AGE_GROUPS.map((group) => group.key)])

export const useAgeGroupView = () => {
  const activeGroup = useState<AgeGroupView>('summer-age-group-view-v1', () => 'all')

  const setGroup = (group: AgeGroupView) => {
    if (!VALID_GROUPS.has(group)) return
    activeGroup.value = group
  }

  const reset = () => {
    activeGroup.value = 'all'
  }

  const matches = (student: SummerStudent) => activeGroup.value === 'all'
    || ageGroupViewKeyFor(student.ageGroup) === activeGroup.value

  const reconcile = (students: SummerStudent[]) => {
    if (activeGroup.value === 'all') return
    if (!students.some((student) => ageGroupViewKeyFor(student.ageGroup) === activeGroup.value)) reset()
  }

  return { activeGroup, setGroup, reset, matches, reconcile }
}
