export type ProductStatus = 'normal' | 'watch' | 'risk'

/**
 * 수익성 표의 한 행.
 * 값은 전부 확정 스냅샷(product_cost_summaries)에서 온다 — §8-2.
 * 금액은 포장 1개 기준이다.
 */
export type ProductProfitabilityItem = {
  id: string
  name: string
  variant?: string
  specification: string
  packageUnit: string
  productionQuantity: number
  manufacturingCost: number
  totalCost: number
  salePrice: number
  marginRate: number
  status: ProductStatus
}
