export type ProductStatus = 'normal' | 'watch' | 'risk'

/**
 * 수익성 표의 한 행.
 * 원가는 확정 스냅샷(product_cost_summaries)에서, 판매가는 products 의 현재 값.
 *
 * 원가 항목은 **1kg 기준**이다. 판매가는 포장 단위라 단위가 다르므로,
 * 둘을 잇는 unitCost(포장 1개당 경영 총원가)를 함께 보여준다.
 */
export type ProductProfitabilityItem = {
  id: string
  name: string
  variant?: string
  specification: string
  packageUnit: string
  productionQuantity: number
  /** 원/kg — (재료비 + 노무비) ÷ 생산량 */
  manufacturingCost: number
  /** 원/kg — (재료비 + 노무비 + 경비) ÷ 생산량 */
  totalCost: number
  /** 원/포장 — 경영 총원가/kg × 포장무게. 판매가와 같은 단위 */
  unitCost: number
  salePrice: number
  marginRate: number
  status: ProductStatus
}
