import { useState } from 'react'
import { Icon } from '../common/Icon'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import type { ProductCostAnalysisState } from './useProductCostAnalysis'
import { MonthlyUnitPriceTrend } from './MonthlyUnitPriceTrend'

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

const unitPriceFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 1,
})

export function ProductCostSummary({ product, state, onAction }: ProductCostSummaryProps) {
  const { draftMonth, setDraftMonth, activeMonth, setActiveMonth, monthLabel } = state

  const indirectCost = product.indirectCosts.reduce((sum, item) => sum + item.amount, 0)
  const subMaterialCost = product.laborCost + indirectCost
  const totalCost = product.materialCost + subMaterialCost

  const [isEditingYield, setIsEditingYield] = useState(false)
  const [yieldInput, setYieldInput] = useState('')
  const [yieldKg, setYieldKg] = useState<number | null>(null)

  const [selectedMetric, setSelectedMetric] = useState<'material' | 'sub' | 'total'>('total')

  const unitPrice = yieldKg && yieldKg > 0 ? totalCost / yieldKg : null

  const trend = {
    material: { value: product.materialCost, label: '재료비', formatValue: (v: number) => currencyFormatter.format(v) },
    sub: { value: subMaterialCost, label: '부자재비', formatValue: (v: number) => currencyFormatter.format(v) },
    total: unitPrice != null
      ? { value: unitPrice, label: 'kg당 단가', formatValue: (v: number) => unitPriceFormatter.format(v) }
      : { value: totalCost, label: '총 금액', formatValue: (v: number) => currencyFormatter.format(v) },
  }[selectedMetric]

  const applyFilters = () => {
    setActiveMonth(draftMonth)
    onAction(`${draftMonth.replace('-', '년 ')}월 원가 분석을 조회했습니다.`)
  }

  const applyYield = () => {
    const parsed = Number(yieldInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onAction('생산량은 0보다 큰 숫자로 입력해 주세요.')
      return
    }
    setYieldKg(parsed)
    setIsEditingYield(false)
    onAction(`생산량 ${parsed.toLocaleString('ko-KR')}kg 기준 kg당 단가를 계산했습니다.`)
  }

  const openYieldEditor = () => {
    setYieldInput(yieldKg != null ? String(yieldKg) : '')
    setIsEditingYield(true)
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
        <section
          className={`product-cost-overview__item${selectedMetric === 'material' ? ' is-selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={selectedMetric === 'material'}
          onClick={() => setSelectedMetric('material')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSelectedMetric('material')
            }
          }}
        >
          <span>재료비</span><strong>{currencyFormatter.format(product.materialCost)}</strong><small>{product.ingredients.length}개 재료</small>
        </section>
        <section
          className={`product-cost-overview__item${selectedMetric === 'sub' ? ' is-selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={selectedMetric === 'sub'}
          onClick={() => setSelectedMetric('sub')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSelectedMetric('sub')
            }
          }}
        >
          <span>부자재비</span><strong>{currencyFormatter.format(subMaterialCost)}</strong><small>인건비·간접비 포함</small>
        </section>
        <section
          className={`product-cost-overview__total product-cost-overview__item${selectedMetric === 'total' ? ' is-selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={selectedMetric === 'total'}
          onClick={() => setSelectedMetric('total')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSelectedMetric('total')
            }
          }}
        >
          <span className="product-cost-overview__total-label">
            {unitPrice != null ? 'kg당 단가' : '총 금액'}
            <button
              type="button"
              className="product-cost-overview__yield-edit"
              aria-label="생산량 입력하여 kg당 단가 계산"
              aria-expanded={isEditingYield}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedMetric('total')
                if (isEditingYield) setIsEditingYield(false)
                else openYieldEditor()
              }}
            >
              <Icon name="edit" size={13} />
            </button>
          </span>
          <strong>
            {unitPrice != null
              ? unitPriceFormatter.format(unitPrice)
              : currencyFormatter.format(totalCost)}
          </strong>
          {isEditingYield ? (
            <div className="product-cost-overview__yield-editor" onClick={(event) => event.stopPropagation()}>
              <div className="product-cost-overview__yield-field">
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  autoFocus
                  value={yieldInput}
                  placeholder="생산량"
                  onChange={(event) => setYieldInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyYield()
                    if (event.key === 'Escape') setIsEditingYield(false)
                  }}
                />
                <span className="product-cost-overview__yield-unit">kg</span>
              </div>
              <button
                type="button"
                className="product-cost-overview__yield-apply"
                onClick={applyYield}
              >
                계산
              </button>
            </div>
          ) : unitPrice != null ? (
            <small className="product-cost-overview__unit-price">
              총 금액 {currencyFormatter.format(totalCost)} · 생산량 {yieldKg!.toLocaleString('ko-KR')}kg
            </small>
          ) : (
            <small>재료비 + 부자재비</small>
          )}
        </section>
      </div>

      <MonthlyUnitPriceTrend
        currentValue={trend.value}
        label={trend.label}
        productId={`${product.id}-${selectedMetric}`}
        anchorMonth={activeMonth}
        formatValue={trend.formatValue}
      />
    </div>
  )
}
