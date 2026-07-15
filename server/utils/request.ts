import type { H3Event } from 'h3'

const cleanDeviceId = (value: unknown) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 80)

export const assertSameOriginMutation = (event: H3Event) => {
  const fetchSite = String(getHeader(event, 'sec-fetch-site') || '').toLowerCase()
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    throw createError({ statusCode: 403, message: 'Solicitud no permitida.' })
  }

  const origin = String(getHeader(event, 'origin') || '').trim()
  if (!origin) return
  try {
    if (new URL(origin).host !== getRequestURL(event).host) {
      throw createError({ statusCode: 403, message: 'Solicitud no permitida.' })
    }
  } catch (error: any) {
    if (error?.statusCode === 403) throw error
    throw createError({ statusCode: 400, message: 'Origen inválido.' })
  }
}

export const readDeviceId = (event: H3Event, fallback?: unknown) => {
  const fromHeader = cleanDeviceId(getHeader(event, 'x-summer-device-id'))
  const fromBody = cleanDeviceId(fallback)
  return fromHeader || fromBody || 'anonymous'
}

export const deviceLabel = (deviceId: string) => {
  if (!deviceId || deviceId === 'anonymous') return 'Dispositivo'
  return `Dispositivo ${deviceId.slice(-4).toUpperCase()}`
}
