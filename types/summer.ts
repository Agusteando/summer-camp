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

export type ServerCacheMeta = {
  strategy: 'vercel-edge-plus-instance-singleflight'
  state: 'miss' | 'fresh' | 'stale-while-revalidate' | 'stale-if-error'
  refreshing: boolean
  snapshotAgeMs: number
  snapshotStoredAt: string | null
  snapshotLastError: { name: string; message: string; code: string | null; statusCode: number | null; at: string } | null
  sourceAgeMs: number | null
  sourceStoredAt: string | null
  sourceRefreshing: boolean
  sourceLastError: { name: string; message: string; code: string | null; statusCode: number | null; at: string } | null
  sourceFreshMs: number
  sourceStaleMs: number
  snapshotFreshMs: number
  snapshotStaleMs: number
  edgeFreshSeconds: number
  edgeStaleSeconds: number
  instanceId: string
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
    requestedPlanteles?: string[]
    successfulPlanteles?: string[]
    emptyPlanteles?: string[]
    configurationCorrections?: Array<{ input: string; output: string | null; reason: string }>
    sourcePlantelResults?: Array<{ plantel: string; ok: boolean; rowCount: number; latencyMs: number; meta: Record<string, unknown> | null; error: { plantel: string; name: string; message: string; code: string | null; statusCode: number | null; responseBody: string | null } | null }>
    sourceFailures?: Array<{ plantel: string; name: string; message: string; code: string | null; statusCode: number | null; responseBody: string | null }>
    cached?: boolean
    serverCache?: ServerCacheMeta
    buildId?: string
    snapshotVersion?: number
    requestId?: string
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
  buildId?: string
  snapshotVersion?: number
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
