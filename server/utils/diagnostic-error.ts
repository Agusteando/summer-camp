export type DiagnosticError = {
  name: string
  message: string
  code: string | null
  errno: number | null
  sqlState: string | null
  sqlMessage: string | null
  statusCode: number | null
  statusMessage: string | null
  stack: string | null
}

const text = (value: unknown, max = 4000) => {
  const result = String(value ?? '').trim()
  return result ? result.slice(0, max) : null
}

export const serializeDiagnosticError = (cause: any): DiagnosticError => ({
  name: text(cause?.name, 120) || 'Error',
  message: text(cause?.message, 4000) || 'Error desconocido',
  code: text(cause?.code, 120),
  errno: Number.isFinite(Number(cause?.errno)) ? Number(cause.errno) : null,
  sqlState: text(cause?.sqlState, 120),
  sqlMessage: text(cause?.sqlMessage, 4000),
  statusCode: Number.isFinite(Number(cause?.statusCode || cause?.status)) ? Number(cause?.statusCode || cause?.status) : null,
  statusMessage: text(cause?.statusMessage, 500),
  stack: text(cause?.stack, 12000)
})

export const diagnosticFailure = (stage: string, cause: any, requestId: string) => ({
  requestId,
  stage,
  error: serializeDiagnosticError(cause),
  details: cause?.diagnostic || cause?.failures || cause?.data || null,
  at: new Date().toISOString()
})
