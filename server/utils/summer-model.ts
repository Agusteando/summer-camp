import { ATTENDANCE_TYPES, attendanceStatusFor, plantelSortIndex } from '../../shared/catalog'
import type { AttendanceByType, AttendanceStatus, AttendanceType, AttendanceUpdatedAtByType, PlantelSummary, SummerStudent } from '../../types/summer'
import type { SourceStudent } from './sheet-source'

type AttendanceRecord = {
  studentId: string
  attendanceType: AttendanceType
  status: Exclude<AttendanceStatus, 'unmarked'>
  updatedAt: string
}

const blankAttendance = () => Object.fromEntries(ATTENDANCE_TYPES.map((type) => [type.key, 'unmarked'])) as AttendanceByType
const blankAttendanceTimes = () => Object.fromEntries(ATTENDANCE_TYPES.map((type) => [type.key, null])) as AttendanceUpdatedAtByType

export const mergeStudentsWithAttendance = (sourceStudents: SourceStudent[], attendance: AttendanceRecord[]): SummerStudent[] => {
  const byStudent = new Map<string, AttendanceRecord[]>()
  attendance.forEach((row) => {
    const current = byStudent.get(row.studentId) || []
    current.push(row)
    byStudent.set(row.studentId, current)
  })

  return sourceStudents.map((student) => {
    const attendanceByType = blankAttendance()
    const attendanceUpdatedAtByType = blankAttendanceTimes()
    ;(byStudent.get(student.id) || []).forEach((record) => {
      attendanceByType[record.attendanceType] = record.status
      attendanceUpdatedAtByType[record.attendanceType] = record.updatedAt
    })
    return {
      ...student,
      attendance: attendanceByType.general,
      attendanceUpdatedAt: attendanceUpdatedAtByType.general,
      attendanceByType,
      attendanceUpdatedAtByType
    }
  })
}

export const summarizeStudents = (students: SummerStudent[]): PlantelSummary[] => {
  const map = new Map<string, PlantelSummary>()
  students.forEach((student) => {
    const current = map.get(student.plantel) || {
      plantel: student.plantel,
      label: student.plantelLabel,
      campus: student.campus,
      total: 0,
      present: 0,
      absent: 0,
      unmarked: 0,
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      extendedTime: 0,
      transport: 0,
      huskyDreamers: 0,
      footballClinic: 0
    }
    current.total += 1
    current[attendanceStatusFor(student, 'general')] += 1
    if (student.services.breakfast) current.breakfast += 1
    if (student.services.lunch) current.lunch += 1
    if (student.services.dinner) current.dinner += 1
    if (student.services.extendedTime) current.extendedTime += 1
    if (student.services.transport) current.transport += 1
    if (student.program === 'husky_dreamers') current.huskyDreamers += 1
    if (student.program === 'clinica_futbol') current.footballClinic += 1
    map.set(student.plantel, current)
  })
  return Array.from(map.values()).sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel))
}
