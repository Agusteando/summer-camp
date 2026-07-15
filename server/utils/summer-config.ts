const cleanCode = (value: unknown) => String(value ?? '').trim().toUpperCase()

export const SUMMER_FINANCIAL_PLANTELES = ['CT', 'PT', 'ST', 'PREEM', 'GM', 'PM', 'SM'] as const
const SUPPORTED = new Set<string>(SUMMER_FINANCIAL_PLANTELES)

export type SummerPlantelCorrection = {
  input: string
  output: string | null
  reason: 'legacy_preet_to_ct' | 'unsupported_financial_agent' | 'duplicate'
}

export const resolveSummerPlantelConfiguration = () => {
  const config = useRuntimeConfig()
  const fallback = SUMMER_FINANCIAL_PLANTELES.join(',')
  const raw = String(config.summerPlanteles || fallback)
    .split(',')
    .map(cleanCode)
    .filter(Boolean)

  const rawHasCt = raw.includes('CT')
  const resolved: string[] = []
  const corrections: SummerPlantelCorrection[] = []

  for (const input of raw) {
    let output = input
    if (input === 'PREET') {
      if (!rawHasCt && !resolved.includes('CT')) {
        output = 'CT'
        corrections.push({ input, output, reason: 'legacy_preet_to_ct' })
      } else {
        corrections.push({ input, output: null, reason: 'unsupported_financial_agent' })
        continue
      }
    }

    if (!SUPPORTED.has(output)) {
      corrections.push({ input, output: null, reason: 'unsupported_financial_agent' })
      continue
    }
    if (resolved.includes(output)) {
      corrections.push({ input, output, reason: 'duplicate' })
      continue
    }
    resolved.push(output)
  }

  if (!resolved.length) resolved.push(...SUMMER_FINANCIAL_PLANTELES)

  return {
    raw,
    resolved,
    supported: [...SUMMER_FINANCIAL_PLANTELES],
    corrections,
    corrected: corrections.length > 0
  }
}
