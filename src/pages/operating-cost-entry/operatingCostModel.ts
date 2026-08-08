export type CostField = 'laborTotal'

export type CustomCostItem = {
  id: string
  name: string
  total: string
  /** 저장 시 생산량 비율로 계산된 제품별 배분액 (제품 id → 원) */
  allocation?: Record<string, number>
}

/**
 * 항목 총액을 제품별 생산량 비율로 배분합니다.
 * 생산량 정보가 없으면 제품 수로 균등(1/n) 배분합니다.
 */
export function distributeByProduction(
  total: number,
  productions: Array<{ id: string; production: number }>,
): Record<string, number> {
  const result: Record<string, number> = {}
  if (productions.length === 0) return result

  const totalProduction = productions.reduce((sum, item) => sum + Math.max(0, item.production), 0)
  const useEven = totalProduction <= 0

  let allocated = 0
  productions.forEach((item, index) => {
    const isLast = index === productions.length - 1
    if (isLast) {
      result[item.id] = Math.round(total - allocated)
      return
    }
    const ratio = useEven
      ? 1 / productions.length
      : Math.max(0, item.production) / totalProduction
    const share = Math.round(total * ratio)
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
