export type CampusName = 'Toluca' | 'Metepec'
export type CampusFilter = CampusName | null
export type ProgramKind = 'husky_dreamers' | 'clinica_futbol' | 'unassigned'
export type ProgramScope = Exclude<ProgramKind, 'unassigned'>
export type AttendanceStatus = 'present' | 'absent' | 'unmarked'
export type AgeGroupKey = 'group-1' | 'group-2' | 'group-3' | 'group-4' | 'group-5'
export type AgeGroupView = 'all' | AgeGroupKey | 'other'

export type StudentContact = {
  name: string
  relation: string
  phone: string
}

export type StudentServiceKey = 'breakfast' | 'lunch' | 'dinner' | 'extendedTime' | 'transport'
export type AttendanceType = 'general' | StudentServiceKey

export type StudentServices = Record<StudentServiceKey, boolean>
export type StudentServiceValues = Record<StudentServiceKey, string>
export type ServiceView = 'all' | StudentServiceKey
export type AttendanceByType = Record<AttendanceType, AttendanceStatus>
export type AttendanceUpdatedAtByType = Record<AttendanceType, string | null>

export type StudentSchedule = {
  entry: string
  exit: string
}

export type SummerStudent = {
  id: string
  folio: string
  name: string
  age: number | null
  ageGroup: string
  modality: string
  program: ProgramKind
  studentType: string
  plantel: string
  plantelLabel: string
  campus: CampusName
  services: StudentServices
  serviceValues: StudentServiceValues
  schedule: StudentSchedule
  contacts: {
    primary: StudentContact
    alternate: StudentContact
  }
  allergies: string
  observations: string
  attendance: AttendanceStatus
  attendanceUpdatedAt: string | null
  attendanceByType: AttendanceByType
  attendanceUpdatedAtByType: AttendanceUpdatedAtByType
  source: {
    sheet: string
    row: number
  }
}

export type PlantelSummary = {
  plantel: string
  label: string
  campus: CampusName
  total: number
  present: number
  absent: number
  unmarked: number
  breakfast: number
  lunch: number
  dinner: number
  extendedTime: number
  transport: number
  huskyDreamers: number
  footballClinic: number
}

export type SnapshotResponse = {
  date: string
  students: SummerStudent[]
  summaries: PlantelSummary[]
  meta: {
    generatedAt: string
    sourceGeneratedAt: string
    sourceRevision: string
    source: 'google-sheets'
    sourceReachable: boolean
    sourceCache: 'fresh' | 'stale' | 'miss' | 'refreshed'
    spreadsheetName: string
    warningCount: number
  }
}

export type AttendanceMutation = {
  queueKey: string
  idempotencyKey: string
  deviceId: string
  studentId: string
  date: string
  attendanceType: AttendanceType
  status: AttendanceStatus
  clientTimestamp: string
}

export type AttendanceHistoryRow = {
  date: string
  studentId: string
  attendanceType: AttendanceType
  status: Exclude<AttendanceStatus, 'unmarked'>
  plantel: string
  actorName: string
  updatedAt: string
  name: string
  plantelLabel: string
  campus: CampusName
  program: ProgramKind
}

export type AttendanceHistoryDay = {
  date: string
  present: number
  absent: number
  total: number
  rows: AttendanceHistoryRow[]
}
