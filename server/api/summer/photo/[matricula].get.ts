import { verifyStudentPhotoToken } from '../../../utils/tokens'

const clean = (value: unknown) => String(value || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 64)

export default defineEventHandler(async (event) => {
  const matricula = clean(getRouterParam(event, 'matricula'))
  if (!matricula || !/^[A-Z0-9_-]+$/.test(matricula)) throw createError({ statusCode: 400, message: 'Matrícula inválida.' })
  if (!verifyStudentPhotoToken(getQuery(event).token, matricula)) throw createError({ statusCode: 403, message: 'Foto no autorizada.' })

  const config = useRuntimeConfig()
  const auroraBase = String(config.auroraBaseUrl || '').trim().replace(/\/+$/, '')
  const auroraToken = String(config.auroraApiToken || '').trim()

  if (auroraBase && auroraToken) {
    const response = await fetch(`${auroraBase}/api/external/v1/summer/students/${encodeURIComponent(matricula)}/photo`, {
      headers: { Authorization: `Bearer ${auroraToken}`, Accept: 'application/json' },
      cache: 'no-store'
    }).catch(() => null)
    if (response?.ok) {
      const payload: any = await response.json().catch(() => null)
      const url = String(payload?.photoUrl || payload?.data?.photoUrl || '').trim()
      if (url) {
        setResponseHeader(event, 'Cache-Control', 'private, max-age=900, stale-while-revalidate=3600')
        return sendRedirect(event, url, 302)
      }
    }
  }

  const base = String(config.studentPhotoBaseUrl || '').trim().replace(/\/+$/, '')
  const key = String(config.studentPhotoApiKey || '').trim()
  if (!base || !key) throw createError({ statusCode: 404, message: 'Foto no disponible.' })
  const url = new URL(`/api/students/${encodeURIComponent(matricula)}/photo`, base)
  url.searchParams.set('format', 'json')
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, 'x-api-key': key, Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw createError({ statusCode: 404, message: 'Foto no disponible.' })
  const payload: any = await response.json()
  const photoUrl = String(payload?.photoUrl || payload?.data?.photoUrl || payload?.url || '').trim()
  if (!photoUrl) throw createError({ statusCode: 404, message: 'Foto no disponible.' })
  setResponseHeader(event, 'Cache-Control', 'private, max-age=900, stale-while-revalidate=3600')
  return sendRedirect(event, photoUrl, 302)
})
