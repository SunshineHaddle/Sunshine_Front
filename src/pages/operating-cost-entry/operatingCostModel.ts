export type CostField = 'laborTotal'

export type CustomCostItem = {
  id: string
  name: string
  total: string
  allocation?: Record<string, number>
}

export function distributeByProduction(
  total: number,
  productions: Array<{ id: string; production: number }>,
): Record<string, number> {
  const result: Record<string, number> = {}
  if (productions.length === 0) return result

  // 1단계 엑셀에 있는 제품끼리 균등 분배 (생산량 무관). 나머지는 마지막 제품에 몰아 총액 보존
  let allocated = 0
  productions.forEach((item, index) => {
    const isLast = index === productions.length - 1
    const share = isLast
      ? Math.round(total - allocated)
      : Math.round(total / productions.length)
    result[item.id] = share
    allocated += share
  })

  return result
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
    (sum, item) => sum + toWonNumber(item.total),
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
