export const normalizeCurp = (value: unknown) => String(value || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 18)

export const ageFromCurp = (value: unknown, now = new Date()): number | null => {
  const curp = normalizeCurp(value)
  const match = curp.match(/^[A-ZÑ]{4}(\d{2})(\d{2})(\d{2})[HM]/)
  if (!match) return null
  const yy = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const currentYY = now.getFullYear() % 100
  const year = yy <= currentYY ? 2000 + yy : 1900 + yy
  const birth = new Date(year, month - 1, day)
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null
  let age = now.getFullYear() - year
  const monthDelta = now.getMonth() - (month - 1)
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < day)) age -= 1
  return age >= 0 && age < 100 ? age : null
}
