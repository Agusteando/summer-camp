import type { AgeGroupKey, AgeGroupView, AttendanceStatus, AttendanceType, CampusName, ProgramKind, ProgramScope, ServiceView, StudentServiceKey, SummerStudent } from '~/types/summer'

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

export const SERVICE_FILTERS: Array<{ key: StudentServiceKey; label: string; shortLabel: string }> = [
  { key: 'breakfast', label: 'Desayuno', shortLabel: 'Desayuno' },
  { key: 'lunch', label: 'Comida', shortLabel: 'Comida' },
  { key: 'dinner', label: 'Cena', shortLabel: 'Cena' },
  { key: 'extendedTime', label: 'Tiempo extendido', shortLabel: 'Extendido' },
  { key: 'transport', label: 'Transporte', shortLabel: 'Transporte' }
]

export const ATTENDANCE_TYPES: Array<{ key: AttendanceType; label: string; shortLabel: string }> = [
  { key: 'general', label: 'General', shortLabel: 'General' },
  ...SERVICE_FILTERS.map((service) => ({ key: service.key, label: service.label, shortLabel: service.shortLabel }))
]

export const serviceViewLabel = (service: ServiceView) => service === 'all'
  ? 'Todos los servicios'
  : SERVICE_FILTERS.find((item) => item.key === service)?.label || service

export const attendanceTypeLabel = (type: AttendanceType) => ATTENDANCE_TYPES.find((item) => item.key === type)?.label || type

export const attendanceTypeShortLabel = (type: AttendanceType) => ATTENDANCE_TYPES.find((item) => item.key === type)?.shortLabel || type

export const studentMatchesAttendanceType = (student: Pick<SummerStudent, 'services'>, type: AttendanceType) => type === 'general' || student.services[type]

export const attendanceStatusFor = (student: Pick<SummerStudent, 'attendance' | 'attendanceByType'>, type: AttendanceType): AttendanceStatus => {
  if (student.attendanceByType?.[type]) return student.attendanceByType[type]
  return type === 'general' ? student.attendance : 'unmarked'
}

const normalizeServiceValue = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()

const GENERIC_SERVICE_VALUES = new Set(['si', 'yes', 'true', '1', 'incluido', 'incluida'])

export const serviceDisplayLabel = (service: StudentServiceKey, rawValue = '') => {
  const definition = SERVICE_FILTERS.find((item) => item.key === service)
  const label = definition?.label || service
  const cleanValue = String(rawValue || '').trim()
  if (!cleanValue || GENERIC_SERVICE_VALUES.has(normalizeServiceValue(cleanValue))) return label
  return `${label} · ${cleanValue}`
}

export const serviceExportValue = (active: boolean, rawValue = '') => {
  if (!active) return 'No'
  const cleanValue = String(rawValue || '').trim()
  return cleanValue || 'Sí'
}

export const AGE_GROUPS: Array<{ key: AgeGroupKey; label: string; min: number; max: number; icon: string }> = [
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

export const ageGroupViewKeyFor = (ageGroup: string): AgeGroupView => {
  const group = AGE_GROUPS.find((item) => item.key === ageGroup)
  return group?.key || 'other'
}

export const ageGroupViewLabel = (group: AgeGroupView) => {
  if (group === 'all') return 'Todos los grupos'
  if (group === 'other') return 'Sin grupo de edad'
  return `${AGE_GROUPS.find((item) => item.key === group)?.label || group} años`
}
