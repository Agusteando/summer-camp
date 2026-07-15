import { diagnosticFailure } from '../../utils/diagnostic-error'
import { loadSummerSource } from '../../utils/summer-source'
import { buildSnapshot } from '../../utils/summer-state'
import { isoDate } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const requestId = `snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  setResponseHeader(event, 'X-Summer-Request-Id', requestId)
  setResponseHeader(event, 'X-Summer-Snapshot-Version', '9')
  let stage = 'source_students'

  try {
    const source = await loadSummerSource()
    if (!source.students.length) {
      const error: any = new Error('La fuente de inscripción respondió sin alumnos para los conceptos y planteles configurados.')
      error.code = 'SUMMER_SOURCE_EMPTY'
      error.diagnostic = {
        source: source.source,
        reachable: source.reachable,
        partial: source.partial,
        failedPlanteles: source.failedPlanteles,
        failures: source.failures,
        students: 0
      }
      throw error
    }
    stage = 'snapshot_pipeline'
    const snapshot = await buildSnapshot(date, source.students, source)
    setResponseHeader(event, 'X-Summer-Source', source.source)
    setResponseHeader(event, 'X-Summer-Source-Students', String(source.students.length))
    setResponseHeader(event, 'X-Summer-Source-Partial', String(source.partial))
    if (!snapshot || !Array.isArray(snapshot.students) || !Array.isArray(snapshot.summaries)) {
      const error: any = new Error('La construcción de la lista terminó con una respuesta inválida.')
      error.code = 'SUMMER_SNAPSHOT_INVALID'
      error.diagnostic = {
        responseType: snapshot === null ? 'null' : Array.isArray(snapshot) ? 'array' : typeof snapshot,
        responseKeys: snapshot && typeof snapshot === 'object' ? Object.keys(snapshot) : []
      }
      throw error
    }
    return snapshot
  } catch (cause: any) {
    const diagnostic = diagnosticFailure(stage, cause, requestId)
    console.error('[summer snapshot]', diagnostic)
    throw createError({
      statusCode: Number(cause?.statusCode || cause?.status || 500),
      statusMessage: 'SUMMER_SNAPSHOT_FAILED',
      message: cause?.message || 'No se pudo construir la lista de Summer Camp.',
      data: { diagnostic }
    })
  }
})
