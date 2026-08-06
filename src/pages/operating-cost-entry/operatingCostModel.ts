export type CostField =
  | 'laborTotal'
  | 'electricity'
  | 'water'

export type CustomCostItem = {
  id: string
  name: string
  amount: string
}

export type OperatingCosts = {
  laborTotal: string
  electricity: string
  water: string
  productFees: Record<string, string>
  customItems: CustomCostItem[]
}

export const initialOperatingCosts: OperatingCosts = {
  laborTotal: '0',
  electricity: '0',
  water: '0',
  productFees: {},
  customItems: [],
}

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function toWonNumber(value: string) {
  return Math.max(0, Number(value) || 0)
}

export function calculateOperatingCosts(costs: OperatingCosts) {
  const laborCost = toWonNumber(costs.laborTotal)
  const customTotal = (costs.customItems ?? []).reduce((sum, item) => sum + toWonNumber(item.amount), 0)
  const utilityCost = toWonNumber(costs.electricity) + toWonNumber(costs.water) + customTotal

  return {
    laborCost,
    utilityCost,
    indirectCost: 0,
    totalCost: laborCost + utilityCost,
  }
}

export function formatWon(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}
