import { SUMMER_BUILD_ID, SUMMER_DX_VERSION, SUMMER_SNAPSHOT_VERSION } from '../../utils/build'
import { diagnosticFailure } from '../../utils/diagnostic-error'
import { readSummerSnapshot, summerCacheDurations } from '../../utils/summer-cache'
import { isoDate } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const durations = summerCacheDurations()
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')
  setResponseHeader(event, 'CDN-Cache-Control', `public, s-maxage=${durations.edgeFreshSeconds}, stale-while-revalidate=${durations.edgeStaleSeconds}`)
  setResponseHeader(event, 'Vercel-CDN-Cache-Control', `public, s-maxage=${durations.edgeFreshSeconds}, stale-while-revalidate=${durations.edgeStaleSeconds}`)

  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const requestId = `snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  setResponseHeader(event, 'X-Summer-Request-Id', requestId)
  setResponseHeader(event, 'X-Summer-Build-Id', SUMMER_BUILD_ID)
  setResponseHeader(event, 'X-Summer-DX-Version', String(SUMMER_DX_VERSION))
  setResponseHeader(event, 'X-Summer-Snapshot-Version', String(SUMMER_SNAPSHOT_VERSION))

  try {
    const result = await readSummerSnapshot(date, { awaitFreshWhenStale: Boolean(process.env.VERCEL) })
    const snapshot = result.snapshot
    setResponseHeader(event, 'X-Summer-Cache-State', result.state)
    setResponseHeader(event, 'X-Summer-Source', snapshot.meta.source)
    setResponseHeader(event, 'X-Summer-Source-Students', String(snapshot.students.length))
    setResponseHeader(event, 'X-Summer-Source-Partial', String(snapshot.meta.partial))

    if (result.backgroundTask) {
      const waitUntil = (event as any).waitUntil
      if (typeof waitUntil === 'function') waitUntil.call(event, result.backgroundTask)
      else void result.backgroundTask
    }

    if (!snapshot || !Array.isArray(snapshot.students) || !Array.isArray(snapshot.summaries) || !snapshot.meta || typeof snapshot.meta !== 'object') {
      const error: any = new Error('La construcción de la lista terminó con una respuesta inválida.')
      error.code = 'SUMMER_SNAPSHOT_INVALID'
      error.diagnostic = {
        responseType: snapshot === null ? 'null' : Array.isArray(snapshot) ? 'array' : typeof snapshot,
        responseKeys: snapshot && typeof snapshot === 'object' ? Object.keys(snapshot) : []
      }
      throw error
    }

    snapshot.meta.buildId = SUMMER_BUILD_ID
    snapshot.meta.snapshotVersion = SUMMER_SNAPSHOT_VERSION
    snapshot.meta.requestId = requestId
    return snapshot
  } catch (cause: any) {
    const diagnostic = diagnosticFailure('shared_snapshot_cache', cause, requestId)
    console.error('[summer snapshot]', diagnostic)
    throw createError({
      statusCode: Number(cause?.statusCode || cause?.status || 500),
      statusMessage: 'SUMMER_SNAPSHOT_FAILED',
      message: cause?.message || 'No se pudo construir la lista de Summer Camp.',
      data: { diagnostic }
    })
  }
})
