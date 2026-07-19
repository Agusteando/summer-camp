import type { CampusName, ProgramKind, ProgramScope } from '~/types/summer'

export const PLANTEL_ORDER = ['PREET', 'PT', 'ST', 'PREEM', 'PM', 'SM'] as const

export const PLANTEL_LABELS: Record<string, string> = {
  PREET: 'Preescolar Toluca',
  PT: 'Primaria Toluca',
  ST: 'Secundaria Toluca',
  PREEM: 'Preescolar Metepec',
  PM: 'Primaria Metepec',
  SM: 'Secundaria Metepec'
}

export const PROGRAM_ORDER: ProgramScope[] = ['husky_dreamers', 'clinica_futbol']

export const campusForPlantel = (plantel: string): CampusName => {
  const value = String(plantel || '').trim().toUpperCase()
  return ['PREET', 'PT', 'ST'].includes(value) ? 'Toluca' : 'Metepec'
}

export const plantelSortIndex = (plantel: string) => {
  const index = PLANTEL_ORDER.indexOf(String(plantel || '').toUpperCase() as typeof PLANTEL_ORDER[number])
  return index === -1 ? PLANTEL_ORDER.length : index
}

export const normalizeProgram = (modality: string): ProgramKind => {
  const value = String(modality || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (value.includes('husky') || value.includes('curso')) return 'husky_dreamers'
  if (value.includes('futbol') || value.includes('clinica')) return 'clinica_futbol'
  return 'unassigned'
}

export const programLabel = (program: ProgramKind) => ({
  husky_dreamers: 'Curso de verano',
  clinica_futbol: 'Clínica de fútbol',
  unassigned: 'Modalidad pendiente'
})[program]

export const programShortLabel = (program: ProgramScope) => ({
  husky_dreamers: 'Curso',
  clinica_futbol: 'Clínica'
})[program]

export const AGE_GROUPS = [
  { key: 'group-1', label: '3–5', min: 3, max: 5, icon: '/icons/abejas.png' },
  { key: 'group-2', label: '6–7', min: 6, max: 7, icon: '/icons/dinos.png' },
  { key: 'group-3', label: '8–10', min: 8, max: 10, icon: '/icons/leones.png' },
  { key: 'group-4', label: '11–12', min: 11, max: 12, icon: '/icons/tigres.png' },
  { key: 'group-5', label: '13–14', min: 13, max: 14, icon: '/icons/pandas.png' }
]

export const ageGroupFor = (age: number | null) => {
  if (age === null) return 'missing-age'
  return AGE_GROUPS.find((group) => age >= group.min && age <= group.max)?.key || 'out-of-range'
}
