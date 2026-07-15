import type { MealPlan, ProgramKind } from '~/types/summer'

export const PLANTEL_LABELS: Record<string, string> = {
  PREEM: 'Preescolar Metepec',
  GM: 'Guardería Metepec',
  PM: 'Primaria Metepec',
  SM: 'Secundaria Metepec',
  PREET: 'Preescolar Toluca',
  PT: 'Primaria Toluca',
  ST: 'Secundaria Toluca'
}

export const campusForPlantel = (plantel: string): 'Metepec' | 'Toluca' | 'Otro' => {
  const value = String(plantel || '').toUpperCase()
  if (['PREEM', 'GM', 'PM', 'SM'].includes(value) || value.endsWith('M')) return 'Metepec'
  if (['PREET', 'PT', 'ST'].includes(value) || value.endsWith('T')) return 'Toluca'
  return 'Otro'
}

export const programLabel = (program: ProgramKind) => ({
  husky_dreamers: 'Husky Dreamers',
  clinica_futbol: 'Clínica de fútbol',
  unassigned: 'Sin asignar'
})[program]

export const mealLabel = (mealPlan: MealPlan) => ({
  none: 'Sin alimentos',
  comida: 'Comida',
  cena: 'Cena',
  comida_cena: 'Comida + cena',
  pending_one: '1 alimento por definir'
})[mealPlan]

export const mealPlanFromConcept = (conceptId: number): MealPlan => {
  if (conceptId === 988) return 'comida_cena'
  if (conceptId === 987) return 'pending_one'
  return 'none'
}

export const mealCountFromConcept = (conceptId: number) => conceptId === 988 ? 2 : conceptId === 987 ? 1 : 0

export const AGE_GROUPS = [
  { key: 'group-1', label: '4–5', min: 4, max: 5, icon: '/icons/abejas.png' },
  { key: 'group-2', label: '6–7', min: 6, max: 7, icon: '/icons/dinos.png' },
  { key: 'group-3', label: '8–10', min: 8, max: 10, icon: '/icons/leones.png' },
  { key: 'group-4', label: '11–12', min: 11, max: 12, icon: '/icons/tigres.png' },
  { key: 'group-5', label: '13–14', min: 13, max: 14, icon: '/icons/pandas.png' }
]

export const ageGroupFor = (age: number | null) => {
  if (age === null) return 'missing-age'
  return AGE_GROUPS.find((group) => age >= group.min && age <= group.max)?.key || 'out-of-range'
}
