export type CostField = 'laborTotal'

export type CustomCostItem = {
  id: string
  name: string
  total: string
  /** productId → 배분 비율(%). 인건비의 productFees 와 같은 형식 */
  shares: Record<string, string>
}

/**
 * 대상 제품에 100% 를 고르게 나눈다 (인건비·추가 항목 공용).
 * 소수점 첫째 자리까지만 쓰고, 남는 끝수는 마지막 제품이 흡수해 합이 정확히 100% 가 된다.
 */
export function equalShares(productIds: string[]): Record<string, string> {
  const shares: Record<string, string> = {}
  if (productIds.length === 0) return shares

  const even = Math.floor((100 / productIds.length) * 10) / 10
  let remaining = 100
  productIds.forEach((productId, index) => {
    const share = index === productIds.length - 1 ? Math.round(remaining * 10) / 10 : even
    remaining -= share
    shares[productId] = String(share)
  })

  return shares
}

/**
 * 비율(%) 대로 총액을 나눈다. 반올림 끝수는 마지막 제품에 몰아 총액을 보존한다.
 * (예전 distributeByProduction 이 하던 균등 분배는 equalShares 로 만든 비율이 대신한다)
 */
export function distributeByShares(
  total: number,
  shares: Record<string, string>,
  productIds: string[],
): Record<string, number> {
  const result: Record<string, number> = {}
  if (productIds.length === 0) return result

  let allocated = 0
  productIds.forEach((productId, index) => {
    const isLast = index === productIds.length - 1
    const amount = isLast
      ? Math.round(total - allocated)
      : Math.round((total * toWonNumber(shares[productId] ?? '0')) / 100)
    result[productId] = amount
    allocated += amount
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
