import { readAttendanceHistory } from '../../../utils/attendance-store'
import { readSheetSource } from '../../../utils/sheet-source'
import { addCalendarDays, dateInTimeZone, isoDate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  const query = getQuery(event)
  const today = dateInTimeZone(new Date(), String(useRuntimeConfig().summerTimeZone || 'America/Mexico_City'))
  const defaultFrom = addCalendarDays(today, -14)
  const from = isoDate(query.from, defaultFrom)!
  const to = isoDate(query.to, today)!
  if (from > to) throw createError({ statusCode: 400, message: 'El rango de fechas es inválido.' })

  const source = await readSheetSource()
  const days = await readAttendanceHistory(from, to, source.source.students)
  return { from, to, days }
})
