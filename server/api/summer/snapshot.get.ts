import { readAttendanceForDate } from '../../utils/attendance-store'
import { readSheetSource } from '../../utils/sheet-source'
import { mergeStudentsWithAttendance, summarizeStudents } from '../../utils/summer-model'
import { dateInTimeZone, isoDate } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')

  const today = dateInTimeZone(new Date(), String(useRuntimeConfig().summerTimeZone || 'America/Mexico_City'))
  const date = isoDate(getQuery(event).date, today)!
  const sourceResult = await readSheetSource()
  const attendance = await readAttendanceForDate(date)
  const students = mergeStudentsWithAttendance(sourceResult.source.students, attendance)

  return {
    date,
    students,
    summaries: summarizeStudents(students),
    meta: {
      generatedAt: new Date().toISOString(),
      sourceGeneratedAt: sourceResult.source.generatedAt,
      sourceRevision: sourceResult.source.revision,
      source: 'google-sheets',
      sourceReachable: true,
      sourceCache: sourceResult.cacheState,
      spreadsheetName: sourceResult.source.spreadsheetName,
      warningCount: sourceResult.source.warningCount
    }
  }
})
