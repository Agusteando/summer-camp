import { diagnosticFailure } from '../../utils/diagnostic-error'
import { loadSummerSource } from '../../utils/summer-source'
import { buildSnapshot } from '../../utils/summer-state'
import { isoDate } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const requestId = `snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  let stage = 'source_students'

  try {
    const source = await loadSummerSource()
    stage = 'snapshot_pipeline'
    return await buildSnapshot(date, source.students, source)
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
