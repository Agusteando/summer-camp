export type CampusName = 'Toluca' | 'Metepec'
export type CampusFilter = CampusName | 'all'
export type ProgramKind = 'husky_dreamers' | 'clinica_futbol' | 'unassigned'
export type AttendanceStatus = 'present' | 'absent' | 'unmarked'

export type StudentContact = {
  name: string
  relation: string
  phone: string
}

export type StudentServices = {
  breakfast: boolean
  lunch: boolean
  dinner: boolean
  extendedTime: boolean
}

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
  schedule: StudentSchedule
  contacts: {
    primary: StudentContact
    alternate: StudentContact
  }
  allergies: string
  observations: string
  attendance: AttendanceStatus
  attendanceUpdatedAt: string | null
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
  status: AttendanceStatus
  clientTimestamp: string
}

export type AttendanceHistoryRow = {
  date: string
  studentId: string
  status: Exclude<AttendanceStatus, 'unmarked'>
  plantel: string
  actorName: string
  updatedAt: string
  name: string
  plantelLabel: string
  campus: CampusName
}

export type AttendanceHistoryDay = {
  date: string
  present: number
  absent: number
  total: number
  rows: AttendanceHistoryRow[]
}
