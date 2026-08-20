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
        {/*
          화면의 단가는 모두 나눗셈 결과를 반올림한 값이다. 곱하거나 더해
          총계와 맞춰보면 조금씩 어긋난다 (0.09 원/kg × 9만 kg = 8,175 원).
          카드마다 붙이는 대신 맨 위에서 한 번만 알린다.
        */}
        <p className="cost-analysis-filter__rounding">
          표시 금액은 소수점 반올림 값입니다. 항목끼리 곱하거나 더하면 총계와 다를 수 있습니다.
        </p>
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
        <p className="cost-analysis-filter__basis">{monthLabel} · {product.name} 원가 기준</p>
      </div>

      {!loading && !hasData && (
        <p className="product-cost-summary__notice" role="status">
          {monthLabel}에는 확정된 원가가 없습니다. 데이터 입력 3단계에서 원가 계산을 실행했는지 확인해주세요.
        </p>
      )}

      <div className="product-cost-overview product-cost-overview--embedded">
        <section className="product-cost-overview__item is-material">
          <div className="product-cost-overview__head">
            <span className="product-cost-overview__label">재료비</span>
            <p className="product-cost-overview__hint">수불자료 투입 실적</p>
          </div>
          <strong>{currencyFormatter.format(current.materialCost)}</strong>
          {current.productionQty > 0 && (
            <dl className="product-cost-overview__rates">
              <div>
                <dt>생산량</dt>
                <dd>{qtyFormatter.format(current.productionQty)} kg</dd>
              </div>
              <div>
                <dt>kg 당</dt>
                <dd>{currencyFormatter.format(current.materialCost / current.productionQty)}</dd>
              </div>
            </dl>
          )}
        </section>
        <section className="product-cost-overview__item is-sub">
          <div className="product-cost-overview__head">
            <span className="product-cost-overview__label">부자재비</span>
            {/* 제품 단위 부자재 구분이 스키마에 없어 노무비+경비를 이렇게 부른다 */}
            <p className="product-cost-overview__hint">노무비 + 경비</p>
          </div>
          <strong>{currencyFormatter.format(current.subMaterialCost)}</strong>
          <dl className="product-cost-overview__rates">
            <div>
              <dt>노무비</dt>
              <dd>{currencyFormatter.format(current.laborCost)}</dd>
            </div>
            <div>
              <dt>경비</dt>
              <dd>{currencyFormatter.format(current.utilityCost)}</dd>
            </div>
            {current.productionQty > 0 && (
              <div>
                <dt>kg 당</dt>
                <dd>{currencyFormatter.format(current.subMaterialCost / current.productionQty)}</dd>
              </div>
            )}
          </dl>
        </section>
        <section className="product-cost-overview__total product-cost-overview__item is-total">
          {/*
            kg 당 단가는 나눗셈 결과를 반올림한 값이라, 생산량을 곱하면
            총 금액과 조금 어긋난다 (0.09 원/kg × 9만 kg = 8,175 원).
            총 금액이 원본이고 단가가 파생값이라는 것을 알린다.
          */}
          <div className="product-cost-overview__head">
            <span className="product-cost-overview__label product-cost-overview__total-label">
              총 금액
            </span>
            <p className="product-cost-overview__hint is-note">
              재료비 + 부자재비
              <br />kg 당 = 총 금액 ÷ 생산량
            </p>
          </div>
          <strong>{currencyFormatter.format(current.totalCost)}</strong>
          {/*
            생산량은 재료비 카드에서 한 번만 보여준다. 세 번 반복할 값이 아니다.
            포장당 금액만 두면 생산량과 곱해 검산하게 되는데 단위가 달라
            포장무게 배수만큼 어긋나므로, kg 당 금액을 함께 적는다.
            포장무게가 1kg 이면 두 값이 같아 포장당 줄은 생략한다.
          */}
          {current.productionQty > 0 ? (
            <dl className="product-cost-overview__rates">
              <div>
                <dt>kg 당</dt>
                <dd>{currencyFormatter.format(current.totalCost / current.productionQty)}</dd>
              </div>
              {product.unitWeightKg && product.unitWeightKg !== 1 && (
                <div>
                  <dt>포장({qtyFormatter.format(product.unitWeightKg)}kg) 당</dt>
                  <dd>{currencyFormatter.format(current.unitCost)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <small className="product-cost-overview__unit-price">재료비 + 부자재비</small>
          )}
        </section>
      </div>

      <ProductCostTrendChart series={months} activeMonth={activeMonth} />
    </div>
  )
}
