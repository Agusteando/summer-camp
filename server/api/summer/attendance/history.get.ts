import { loadSummerSource } from '../../../utils/summer-source'
import { readAttendanceHistory } from '../../../utils/summer-state'
import { isoDate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
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
  const source = await loadSummerSource()
  return { from, to, days: await readAttendanceHistory(from, to, source.students), generatedAt: new Date().toISOString() }
})
