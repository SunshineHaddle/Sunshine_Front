export type CostField = 'laborTotal'

export type CustomCostItem = {
  id: string
  name: string
  productFees: Record<string, string>
}

export type OperatingCosts = {
  laborTotal: string
  productFees: Record<string, string>
  customItems: CustomCostItem[]
}

export const initialOperatingCosts: OperatingCosts = {
  laborTotal: '0',
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

export function sumProductFees(productFees: Record<string, string>) {
  return Object.values(productFees ?? {}).reduce((sum, value) => sum + toWonNumber(value), 0)
}

export function calculateOperatingCosts(costs: OperatingCosts) {
  const laborCost = toWonNumber(costs.laborTotal)
  const customTotal = (costs.customItems ?? []).reduce(
    (sum, item) => sum + sumProductFees(item.productFees),
    0,
  )
  const utilityCost = customTotal

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
