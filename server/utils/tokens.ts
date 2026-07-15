import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const b64 = (value: string) => Buffer.from(value).toString('base64url')
const unb64 = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

let localSecret = ''
const secret = () => {
  const configured = String(useRuntimeConfig().summerSigningSecret || '').trim()
  if (configured) return configured
  if (process.env.NODE_ENV !== 'production') {
    if (!localSecret) localSecret = randomBytes(32).toString('hex')
    return localSecret
  }
  throw createError({ statusCode: 503, message: 'SUMMER_SIGNING_SECRET no está configurado.' })
}

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

const cleanMatricula = (value: unknown) => String(value || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 64)
const cleanPlantel = (value: unknown) => String(value || '').trim().toUpperCase().slice(0, 40)

const createToken = (kind: 'photo' | 'attendance', matriculaValue: unknown, plantelValue: unknown, ttlMs: number) => {
  const payload = b64(JSON.stringify({
    matricula: cleanMatricula(matriculaValue),
    plantel: cleanPlantel(plantelValue),
    exp: Date.now() + ttlMs
  }))
  const signature = createHmac('sha256', secret()).update(`${kind}:${payload}`).digest('base64url')
  return `${payload}.${signature}`
}

const verifyToken = (kind: 'photo' | 'attendance', tokenValue: unknown, matriculaValue: unknown) => {
  const [payload, signature] = String(tokenValue || '').split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', secret()).update(`${kind}:${payload}`).digest('base64url')
  if (!safeEqual(expected, signature)) return null
  try {
    const data = JSON.parse(unb64(payload))
    if (data?.matricula !== cleanMatricula(matriculaValue) || Number(data?.exp || 0) < Date.now()) return null
    const plantel = cleanPlantel(data?.plantel)
    return plantel || null
  } catch {
    return null
  }
}

export const createStudentPhotoToken = (matricula: unknown, plantel: unknown) => createToken('photo', matricula, plantel, 24 * 60 * 60 * 1000)
export const verifyStudentPhotoToken = (token: unknown, matricula: unknown) => Boolean(verifyToken('photo', token, matricula))
export const createStudentAttendanceToken = (matricula: unknown, plantel: unknown) => createToken('attendance', matricula, plantel, 45 * 24 * 60 * 60 * 1000)
export const verifyStudentAttendanceToken = (token: unknown, matricula: unknown) => verifyToken('attendance', token, matricula)
