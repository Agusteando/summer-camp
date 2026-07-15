import { assertSameOriginMutation, readDeviceId } from '../../../utils/request'
import { saveOverrides } from '../../../utils/summer-state'
import { invalidateAllSummerSnapshots } from '../../../utils/summer-cache'
import type { MealPlan, ProgramKind } from '~/types/summer'

const programs = new Set<ProgramKind>(['unassigned', 'husky_dreamers', 'clinica_futbol'])
const meals = new Set<MealPlan>(['none', 'comida', 'cena', 'comida_cena', 'pending_one'])

export default defineEventHandler(async (event) => {
  assertSameOriginMutation(event)
  const body = await readBody(event)
  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, 500).flatMap((raw: any) => {
    const matricula = String(raw?.matricula || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 64)
    if (!matricula) return []
    const item: any = { matricula }
    if (raw.program !== undefined && programs.has(raw.program)) item.program = raw.program
    if (raw.mealPlan !== undefined && meals.has(raw.mealPlan)) item.mealPlan = raw.mealPlan
    if (raw.ageOverride !== undefined) {
      const age = raw.ageOverride === null || raw.ageOverride === '' ? null : Number(raw.ageOverride)
      if (age === null || (Number.isInteger(age) && age >= 2 && age <= 18)) item.ageOverride = age
    }
    return [item]
  })
  if (!items.length) throw createError({ statusCode: 400, message: 'No hay cambios válidos.' })
  const deviceId = readDeviceId(event, body?.deviceId)
  await saveOverrides(items, deviceId)
  invalidateAllSummerSnapshots()
  return { ok: true, updated: items.length }
})
