import { ATTENDANCE_TYPES } from '../../../../shared/catalog'
import type { AttendanceMutation, AttendanceType } from '../../../../types/summer'
import { saveAttendanceBatch } from '../../../utils/attendance-store'
import { readSheetSource } from '../../../utils/sheet-source'
import { cleanHeaderValue, isoDate, safeClientTimestamp } from '../../../utils/validation'

const VALID_ATTENDANCE_TYPES = new Set<AttendanceType>(ATTENDANCE_TYPES.map((type) => type.key))

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ mutations?: unknown[] }>(event)
  const incoming = Array.isArray(body?.mutations) ? body.mutations.slice(0, 250) : []
  if (!incoming.length) throw createError({ statusCode: 400, message: 'No se recibieron cambios de asistencia.' })

  const deviceHeader = cleanHeaderValue(getHeader(event, 'x-summer-device-id') || 'anonymous', 120)
  const actorName = cleanHeaderValue(getHeader(event, 'x-summer-actor-name') || 'Operación Summer Camp', 160)
  const mutations: AttendanceMutation[] = incoming.map((value: any) => {
    const date = isoDate(value?.date)
    const status = value?.status === 'present' || value?.status === 'absent' || value?.status === 'unmarked' ? value.status : null
    const studentId = cleanHeaderValue(value?.studentId, 120)
    const idempotencyKey = cleanHeaderValue(value?.idempotencyKey, 160)
    const rawAttendanceType = cleanHeaderValue(value?.attendanceType || 'general', 40) as AttendanceType
    const attendanceType = VALID_ATTENDANCE_TYPES.has(rawAttendanceType) ? rawAttendanceType : null
    if (!date || !status || !studentId || !idempotencyKey || !attendanceType) {
      throw createError({ statusCode: 400, message: 'Una marcación contiene fecha, tipo, estado, alumno o idempotencia inválidos.' })
    }
    return {
      queueKey: cleanHeaderValue(value?.queueKey || `${date}:${attendanceType}:${studentId}`, 220),
      idempotencyKey,
      deviceId: cleanHeaderValue(value?.deviceId || deviceHeader, 120),
      studentId,
      date,
      attendanceType,
      status,
      clientTimestamp: safeClientTimestamp(value?.clientTimestamp)
    }
  })

  const source = await readSheetSource()
  const students = new Map(source.source.students.map((student) => [student.id, student]))
  const accepted = await saveAttendanceBatch(mutations, students, actorName)
  return { accepted }
})
