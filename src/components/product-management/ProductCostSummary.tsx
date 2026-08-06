import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import type { ProductCostAnalysisState } from './useProductCostAnalysis'

type ProductCostSummaryProps = {
  product: RecipeProduct
  state: ProductCostAnalysisState
  onAction: (message: string) => void
}

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 4,
})

export function ProductCostSummary({ product, state, onAction }: ProductCostSummaryProps) {
  const { draftMonth, setDraftMonth, setActiveMonth, monthLabel } = state

  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const subMaterialCost = product.laborCost + indirectCost
  const totalCost = product.materialCost + subMaterialCost

  const applyFilters = () => {
    setActiveMonth(draftMonth)
    onAction(`${draftMonth.replace('-', '년 ')}월 원가 분석을 조회했습니다.`)
  }

  return (
    <div className="product-cost-summary">
      <div className="cost-analysis-filter cost-analysis-filter--product" aria-label="원가 분석 조회 조건">
        <label>
          <span>분석 월</span>
          <input
            type="month"
            value={draftMonth}
            onChange={(event) => setDraftMonth(event.target.value)}
          />
        </label>
        <button className="cost-analysis-filter__submit" type="button" onClick={applyFilters}>
          조회하기
        </button>
        <p>{monthLabel} · {product.name} 원가 기준</p>
      </div>

      <div className="product-cost-overview product-cost-overview--embedded">
        <section><span>재료비</span><strong>{currencyFormatter.format(product.materialCost)}</strong><small>{product.ingredients.length}개 재료</small></section>
        <section><span>부자재비</span><strong>{currencyFormatter.format(subMaterialCost)}</strong><small>인건비·간접비 포함</small></section>
        <section className="product-cost-overview__total"><span>총 금액</span><strong>{currencyFormatter.format(totalCost)}</strong><small>재료비 + 부자재비</small></section>
      </div>
    </div>
  )
}
