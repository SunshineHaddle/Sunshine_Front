export type CostField =
  | 'productionHours'
  | 'hourlyWage'
  | 'electricity'
  | 'water'
  | 'fixedCosts'
  | 'wasteTransport'

export type OperatingCosts = Record<CostField, string>

export const initialOperatingCosts: OperatingCosts = {
  productionHours: '0',
  hourlyWage: '22500',
  electricity: '0',
  water: '0',
  fixedCosts: '4500000',
  wasteTransport: '0',
}

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function calculateOperatingCosts(costs: OperatingCosts) {
  const toNumber = (value: string) => Math.max(0, Number(value) || 0)
  const laborCost = toNumber(costs.productionHours) * toNumber(costs.hourlyWage)
  const utilityCost = toNumber(costs.electricity) + toNumber(costs.water)
  const indirectCost = toNumber(costs.fixedCosts) + toNumber(costs.wasteTransport)

  return {
    laborCost,
    utilityCost,
    indirectCost,
    totalCost: laborCost + utilityCost + indirectCost,
  }
}

export function formatWon(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}
