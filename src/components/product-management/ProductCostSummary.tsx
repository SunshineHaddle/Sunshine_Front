import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import type { ProductCostAnalysisState } from './useProductCostAnalysis'
import { ProductCostTrendChart } from './ProductCostTrendChart'

type ProductCostSummaryProps = {
  product: RecipeProduct
  state: ProductCostAnalysisState
  onAction: (message: string) => void
}

const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

const qtyFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 분석 월 후보. 자료가 있는 달을 위로 올려 고르기 쉽게 한다 */
function buildMonthOptions(months: { period: string }[], selected: string) {
  const withData = new Set(months.map((m) => m.period.slice(0, 7)))
  const now = new Date()
  const options: { value: string; label: string; hasData: boolean }[] = []

  for (let i = 0; i < 24; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    options.push({
      value,
      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
      hasData: withData.has(value),
    })
  }
  for (const month of withData) {
    if (!options.some((o) => o.value === month)) {
      options.push({
        value: month,
        label: `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`,
        hasData: true,
      })
    }
  }
  if (selected && !options.some((o) => o.value === selected)) {
    options.unshift({
      value: selected,
      label: `${selected.slice(0, 4)}년 ${Number(selected.slice(5, 7))}월`,
      hasData: false,
    })
  }
  return options.sort((a, b) => b.value.localeCompare(a.value))
}

export function ProductCostSummary({ product, state, onAction }: ProductCostSummaryProps) {
  const {
    draftMonth, setDraftMonth, activeMonth, setActiveMonth, monthLabel,
    months, loading, current, hasData,
  } = state

  const applyFilters = () => {
    setActiveMonth(draftMonth)
    onAction(`${draftMonth.replace('-', '년 ')}월 원가 분석을 조회했습니다.`)
  }

  return (
    <div className="product-cost-summary">
      <div className="cost-analysis-filter cost-analysis-filter--product" aria-label="원가 분석 조회 조건">
        <label>
          <span>분석 월</span>
          <select value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)}>
            {buildMonthOptions(months, draftMonth).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}{option.hasData ? '' : ' (자료 없음)'}
              </option>
            ))}
          </select>
        </label>
        <button className="cost-analysis-filter__submit" type="button" onClick={applyFilters}>
          조회하기
        </button>
        <p>{monthLabel} · {product.name} 원가 기준</p>
      </div>

      {!loading && !hasData && (
        <p className="product-cost-summary__notice" role="status">
          {monthLabel}에는 확정된 원가가 없습니다. 데이터 입력 3단계에서 원가 계산을 실행했는지 확인해주세요.
        </p>
      )}

      <div className="product-cost-overview product-cost-overview--embedded">
        <section className="product-cost-overview__item is-material">
          <span>재료비</span>
          <strong>{currencyFormatter.format(current.materialCost)}</strong>
          <small>수불자료 투입 실적</small>
        </section>
        <section className="product-cost-overview__item is-sub">
          <span>부자재비</span>
          <strong>{currencyFormatter.format(current.subMaterialCost)}</strong>
          <small>노무비 {currencyFormatter.format(current.laborCost)} · 경비 {currencyFormatter.format(current.utilityCost)}</small>
        </section>
        <section className="product-cost-overview__total product-cost-overview__item is-total">
          <span className="product-cost-overview__total-label">총 금액</span>
          <strong>{currencyFormatter.format(current.totalCost)}</strong>
          <small className="product-cost-overview__unit-price">
            {current.productionQty > 0
              ? `생산량 ${qtyFormatter.format(current.productionQty)}kg · 포장당 ${currencyFormatter.format(current.unitCost)}`
              : '재료비 + 부자재비'}
          </small>
        </section>
      </div>

      <ProductCostTrendChart series={months} activeMonth={activeMonth} />
    </div>
  )
}
