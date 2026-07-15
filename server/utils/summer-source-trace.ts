export type SummerSourceTrace = {
  version: number
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  request: {
    method: 'GET'
    url: string
    timeoutMs: number
    planteles: string[]
    cycle: string
    concepts: number[]
  } | null
  response: {
    ok: boolean
    status: number | null
    statusText: string | null
    bodyCharacters: number
    topLevelKeys: string[]
    dataIsArray: boolean
    dataLength: number | null
    meta: Record<string, unknown> | null
  } | null
  normalization: {
    receivedRows: number
    acceptedRows: number
    rejectedMissingMatricula: number
    rejectedConcept: number
    distinctStudents: number
    byConcept: Record<string, number>
    byPlantel: Record<string, number>
  } | null
  error: {
    name: string
    message: string
    code: string | null
    statusCode: number | null
    responseBody: string | null
    stack: string | null
  } | null
}

let lastTrace: SummerSourceTrace | null = null

export const setLastSummerSourceTrace = (trace: SummerSourceTrace) => {
  lastTrace = trace
}

export const getLastSummerSourceTrace = () => lastTrace
