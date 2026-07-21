import { ATTENDANCE_TYPES, studentMatchesAttendanceType } from '~/shared/catalog'
import type { AttendanceType, SummerStudent } from '~/types/summer'

const VALID_TYPES = new Set<AttendanceType>(ATTENDANCE_TYPES.map((type) => type.key))

export const useAttendanceTypeView = () => {
  const activeType = useState<AttendanceType>('summer-attendance-type-v1', () => 'general')

  const setType = (type: AttendanceType) => {
    if (!VALID_TYPES.has(type)) return
    activeType.value = type
  }

  const reset = () => {
    activeType.value = 'general'
  }

  const matches = (student: SummerStudent) => studentMatchesAttendanceType(student, activeType.value)

  const reconcile = (students: SummerStudent[]) => {
    if (activeType.value === 'general') return
    if (!students.some((student) => studentMatchesAttendanceType(student, activeType.value))) reset()
  }

  return { activeType, setType, reset, matches, reconcile }
}
