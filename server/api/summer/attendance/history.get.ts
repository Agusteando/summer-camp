import { readSummerSourceCached } from '../../../utils/summer-cache'
import { readAttendanceHistory } from '../../../utils/summer-state'
import { isoDate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  const today = new Date()
  const defaultTo = today.toISOString().slice(0, 10)
  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - 14)
  const query = getQuery(event)
  const from = isoDate(query.from, fromDate.toISOString().slice(0, 10))!
  const to = isoDate(query.to, defaultTo)!
  const rangeDays = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
  if (rangeDays < 0) throw createError({ statusCode: 400, message: 'El rango de fechas no es válido.' })
  if (rangeDays > 120) throw createError({ statusCode: 400, message: 'El rango máximo es de 120 días.' })

  const sourceRead = await readSummerSourceCached()
  if (sourceRead.backgroundTask) {
    const waitUntil = (event as any).waitUntil
    if (typeof waitUntil === 'function') waitUntil.call(event, sourceRead.backgroundTask)
    else void sourceRead.backgroundTask
  }

  return {
    from,
    to,
    days: await readAttendanceHistory(from, to, sourceRead.source.students),
    generatedAt: new Date().toISOString(),
    sourceCacheState: sourceRead.state
  }
})
