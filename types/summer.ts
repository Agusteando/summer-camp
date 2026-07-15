export type ProgramKind = 'husky_dreamers' | 'clinica_futbol' | 'unassigned'
export type MealPlan = 'none' | 'comida' | 'cena' | 'comida_cena' | 'pending_one'
export type AttendanceStatus = 'present' | 'absent' | 'unmarked'
export type CampusName = 'Metepec' | 'Toluca'
export type CampusFilter = CampusName | 'all'

export type SummerStudent = {
  matricula: string
  name: string
  plantel: string
  plantelLabel: string
  campus: CampusName
  curp: string
  age: number | null
  ageSource: 'curp' | 'manual' | 'missing'
  ageGroup: string
  program: ProgramKind
  conceptId: number
  mealCount: number
  mealPlan: MealPlan
  photoAvailable: boolean
  photoToken: string | null
  attendanceToken: string
  attendance: AttendanceStatus
  attendanceUpdatedAt: string | null
  source: 'aurora' | 'mysql' | 'demo'
}

export type PlantelSummary = {
  plantel: string
  label: string
  campus: CampusName
  total: number
  present: number
  absent: number
  unmarked: number
  food: number
  pendingProgram: number
}

export type SnapshotResponse = {
  date: string
  students: SummerStudent[]
  summaries: PlantelSummary[]
  meta: {
    generatedAt: string
    source: string
    sourceReachable: boolean
    partial: boolean
    failedPlanteles: string[]
    cached?: boolean
  }
}

export type AttendanceMutation = {
  queueKey: string
  idempotencyKey: string
  deviceId: string
  studentToken: string
  matricula: string
  date: string
  status: Exclude<AttendanceStatus, 'unmarked'>
  clientTimestamp: string
}



export type SummerLoadLifecycle = {
  composableCreatedAt: string
  clientMountedAt: string | null
  clientMountedSources: string[]
  loadAttempted: boolean
  loadCallCount: number
  firstLoadRequestedAt: string | null
  lastLoadRequestedAt: string | null
  lastLoadFinishedAt: string | null
  lastLoadTrigger: string | null
  lastLoadOutcome: 'idle' | 'running' | 'success' | 'failure'
  lastLoadDurationMs: number | null
  lastLoadError: string | null
}

export type ClientTraceEvent = {
  at: string
  event: string
  details?: unknown
}

export type ClientRequestDiagnostic = {
  url: string
  startedAt: string
  finishedAt: string
  durationMs: number
  ok: boolean
  statusCode: number | null
  statusMessage: string | null
  message: string | null
  responseData: unknown
  stack: string | null
  lifecycle?: ClientTraceEvent[]
}

export type ServerDiagnosticCheck = {
  key: string
  label: string
  ok: boolean
  latencyMs: number
  details?: unknown
  error?: Record<string, unknown>
}

export type SummerDiagnosticsResponse = {
  diagnosticVersion?: number
  ok: boolean
  requestId: string
  checkedAt: string
  latencyMs: number
  date: string
  runtime?: Record<string, unknown>
  configuration?: Record<string, unknown>
  assumptions: Record<string, string>
  conclusion?: Record<string, any>
  auroraInspection?: Record<string, any> | null
  checks: ServerDiagnosticCheck[]
}
