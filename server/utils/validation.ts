export const isoDate = (value: unknown, fallback?: string) => {
  const raw = String(value || '')
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return fallback ?? null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return fallback ?? null
  return raw
}

export const safeClientTimestamp = (value: unknown) => {
  const parsed = Date.parse(String(value || ''))
  if (!Number.isFinite(parsed)) return new Date().toISOString()
  const date = new Date(parsed)
  if (date.getUTCFullYear() < 2025 || date.getUTCFullYear() > 2035) return new Date().toISOString()
  return date.toISOString()
}

export const cleanHeaderValue = (value: unknown, max = 120) => String(value || '').trim().slice(0, max)

export const dateInTimeZone = (date = new Date(), timeZone = 'America/Mexico_City') => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export const addCalendarDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return value.toISOString().slice(0, 10)
}
