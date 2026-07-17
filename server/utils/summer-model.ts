import { plantelSortIndex } from '../../shared/catalog'
import type { AttendanceStatus, PlantelSummary, SummerStudent } from '../../types/summer'
import type { SourceStudent } from './sheet-source'

type AttendanceRecord = {
  studentId: string
  status: Exclude<AttendanceStatus, 'unmarked'>
  updatedAt: string
}

export const mergeStudentsWithAttendance = (sourceStudents: SourceStudent[], attendance: AttendanceRecord[]): SummerStudent[] => {
  const byStudent = new Map(attendance.map((row) => [row.studentId, row]))
  return sourceStudents.map((student) => {
    const record = byStudent.get(student.id)
    return {
      ...student,
      attendance: record?.status || 'unmarked',
      attendanceUpdatedAt: record?.updatedAt || null
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
      huskyDreamers: 0,
      footballClinic: 0
    }
    current.total += 1
    current[student.attendance] += 1
    if (student.services.breakfast) current.breakfast += 1
    if (student.services.lunch) current.lunch += 1
    if (student.services.dinner) current.dinner += 1
    if (student.services.extendedTime) current.extendedTime += 1
    if (student.program === 'husky_dreamers') current.huskyDreamers += 1
    if (student.program === 'clinica_futbol') current.footballClinic += 1
    map.set(student.plantel, current)
  })
  return Array.from(map.values()).sort((a, b) => plantelSortIndex(a.plantel) - plantelSortIndex(b.plantel))
}
