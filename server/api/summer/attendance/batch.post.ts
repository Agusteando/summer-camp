import { verifyStudentAttendanceToken } from '../../../utils/tokens'
import { assertSameOriginMutation, deviceLabel, readDeviceId } from '../../../utils/request'
import { saveAttendanceBatch } from '../../../utils/summer-state'
import { isoDate, safeClientTimestamp } from '../../../utils/validation'
import type { AttendanceMutation } from '~/types/summer'

const cleanMutation = (value: any): AttendanceMutation | null => {
  const matricula = String(value?.matricula || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 64)
  const date = isoDate(value?.date)
  const status = value?.status === 'present' ? 'present' : value?.status === 'absent' ? 'absent' : null
  const idempotencyKey = String(value?.idempotencyKey || '').trim().slice(0, 120)
  const studentToken = String(value?.studentToken || '').trim().slice(0, 600)
  const deviceId = String(value?.deviceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
  if (!matricula || !date || !status || !idempotencyKey || !studentToken) return null
  return {
    queueKey: String(value?.queueKey || idempotencyKey).slice(0, 500),
    deviceId: deviceId || 'anonymous',
    studentToken,
    matricula,
    date,
    status,
    idempotencyKey,
    clientTimestamp: safeClientTimestamp(value?.clientTimestamp)
  }
}

export default defineEventHandler(async (event) => {
  assertSameOriginMutation(event)
  const body = await readBody(event)
  const raw = (Array.isArray(body?.mutations) ? body.mutations : []).map(cleanMutation).filter(Boolean) as AttendanceMutation[]
  if (!raw.length) throw createError({ statusCode: 400, message: 'No hay registros válidos.' })

  const latest = new Map<string, AttendanceMutation>()
  raw.forEach((mutation) => {
    const key = `${mutation.date}:${mutation.matricula}`
    const current = latest.get(key)
    if (!current || Date.parse(mutation.clientTimestamp) >= Date.parse(current.clientTimestamp)) latest.set(key, mutation)
  })
  const requested = Array.from(latest.values())
  if (requested.length > 250) throw createError({ statusCode: 413, message: 'El lote es demasiado grande.' })

  const plantelByMatricula = new Map<string, string>()
  const mutations = requested.filter((mutation) => {
    const plantel = verifyStudentAttendanceToken(mutation.studentToken, mutation.matricula)
    if (!plantel) return false
    plantelByMatricula.set(mutation.matricula, plantel)
    return true
  })

  const deviceId = readDeviceId(event, mutations[0]?.deviceId)
  const accepted = await saveAttendanceBatch(mutations, plantelByMatricula, deviceId, deviceLabel(deviceId))
  const acceptedSet = new Set(accepted)
  return {
    accepted,
    rejected: requested.filter((mutation) => !acceptedSet.has(mutation.idempotencyKey)).map((mutation) => mutation.idempotencyKey),
    syncedAt: new Date().toISOString()
  }
})
