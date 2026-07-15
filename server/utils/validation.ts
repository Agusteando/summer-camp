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
