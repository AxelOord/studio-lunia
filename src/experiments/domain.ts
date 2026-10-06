export const originalLabel = 'Enquire about this service'
export type Variant = 'control' | 'treatment'
export type Assignment = {
  experiment: number
  variant: Variant
  label: string
  simulation: boolean
}
export const experimentCookie = 'lunia_experiments'
export const simulationCookie = 'lunia_experiment_simulation'
export const experimentDays = 30

// Descriptive Wilson score interval for a binomial proportion, never a winner test.
export function conversionInterval(converted: number, exposed: number) {
  if (!exposed) return null
  const z = 1.959963984540054
  const rate = converted / exposed
  const denominator = 1 + (z * z) / exposed
  const centre = (rate + (z * z) / (2 * exposed)) / denominator
  const radius =
    (z * Math.sqrt((rate * (1 - rate)) / exposed + (z * z) / (4 * exposed * exposed))) / denominator
  return { rate, lower: Math.max(0, centre - radius), upper: Math.min(1, centre + radius) }
}
