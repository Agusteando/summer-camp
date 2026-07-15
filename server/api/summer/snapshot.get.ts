import { loadSummerSource } from '../../utils/summer-source'
import { buildSnapshot } from '../../utils/summer-state'
import { isoDate } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const today = new Date().toISOString().slice(0, 10)
  const date = isoDate(getQuery(event).date, today)!
  const source = await loadSummerSource()
  return await buildSnapshot(date, source.students, source)
})
