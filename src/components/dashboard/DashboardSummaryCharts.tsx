import { useEffect, useState } from 'react'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import type { ProductionCostSummary } from '../../pages/production-result/productionResultModel'
import { CostCompositionChart } from '../../pages/production-result/CostCompositionChart'
import { Icon } from '../common/Icon'

type ExchangeCurrencyCode = 'USD' | 'JPY' | 'EUR' | 'CNY'

const exchangeRates: Record<ExchangeCurrencyCode, {
  flag: string
  label: string
  value: string
  change: string
  changeTone: 'up' | 'down'
}> = {
  USD: { flag: '🇺🇸', label: 'USD/KRW', value: '1,386.40', change: '+0.18%', changeTone: 'up' },
  JPY: { flag: '🇯🇵', label: 'JPY/KRW', value: '9.05', change: '-0.32%', changeTone: 'down' },
  EUR: { flag: '🇪🇺', label: 'EUR/KRW', value: '1,455.00', change: '+0.42%', changeTone: 'up' },
  CNY: { flag: '🇨🇳', label: 'CNY/KRW', value: '185.40', change: '-0.11%', changeTone: 'down' },
}

const exchangeCurrencyCodes = Object.keys(exchangeRates) as ExchangeCurrencyCode[]

type ProductCostTrendCarouselProps = {
  products: RecipeProduct[]
  onOpen: (productId: string) => void
  compact?: boolean
}

type FinalCostSummaryCardProps = {
  summary: ProductionCostSummary
  onOpen: () => void
}

const trendPatterns = [
  [0.86, 0.88, 0.87, 0.90, 0.89, 0.92, 0.93, 0.95, 0.94, 0.97, 0.98, 1],
  [1.12, 1.10, 1.11, 1.08, 1.09, 1.06, 1.05, 1.04, 1.03, 1.02, 1.01, 1],
  [0.93, 0.95, 0.92, 0.96, 0.94, 0.97, 0.95, 0.98, 0.96, 0.99, 0.97, 1],
]
const numberFormatter = new Intl.NumberFormat('ko-KR')

function getMonthLabels() {
  const today = new Date()
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 11 + index, 1)
    return `${date.getMonth() + 1}월`
  })
}

function getProductCostTrend(product: RecipeProduct, productIndex: number) {
  const currentCost = product.materialCost
    + product.laborCost
    + product.indirectCosts.reduce((sum, cost) => sum + cost.amount, 0)
  const pattern = trendPatterns[productIndex % trendPatterns.length]
  const values = pattern.map((ratio) => Math.round(currentCost * ratio))
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = Math.max(maximum - minimum, 1)
  const coordinates = values.map((value, index) => ({
    x: 20 + (index / (values.length - 1)) * 860,
    y: 250 - ((value - minimum) / range) * 180,
  }))
  const previousCost = values.at(-2) ?? currentCost
  const changeRate = ((currentCost - previousCost) / Math.max(previousCost, 1)) * 100

  const baseline = 290
  const firstX = coordinates[0].x
  const lastX = coordinates.at(-1)!.x
  const areaPath = `M ${firstX},${baseline} `
    + coordinates.map(({ x, y }) => `L ${x},${y}`).join(' ')
    + ` L ${lastX},${baseline} Z`

  return {
    changeRate,
    coordinates,
    currentCost,
    points: coordinates.map(({ x, y }) => `${x},${y}`).join(' '),
    areaPath,
    values,
  }
}

export function ProductCostTrendCarousel({ products, onOpen, compact = false }: ProductCostTrendCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const monthLabels = getMonthLabels()
  const cardClassName = `card product-cost-carousel${compact ? ' product-cost-carousel--compact' : ''}`

  useEffect(() => {
    if (products.length < 2 || isPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % products.length), 4000)
    return () => window.clearInterval(timer)
  }, [isPaused, products.length])

  if (products.length === 0) {
    return (
      <section className={cardClassName} aria-labelledby="product-cost-card-title">
        <div className="product-cost-carousel__heading">
          <h2 id="product-cost-card-title"><Icon name="trend" size={22} />제품별 원가 변동 추이</h2>
        </div>
        <p className="product-cost-carousel__empty">표시할 레시피가 없습니다.</p>
      </section>
    )
  }

  const visibleIndex = activeIndex % products.length

  const goToPrevious = () =>
    setActiveIndex((current) => (current - 1 + products.length) % products.length)
  const goToNext = () =>
    setActiveIndex((current) => (current + 1) % products.length)

  return (
    <section
      className={cardClassName}
      aria-labelledby="product-cost-card-title"
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="product-cost-carousel__heading">
        <h2 id="product-cost-card-title"><Icon name="trend" size={22} />제품별 원가 변동 추이</h2>
        {products.length > 1 && (
          <div className="product-cost-carousel__nav">
            <button type="button" aria-label="이전 제품" onClick={goToPrevious}>
              <Icon name="chevron-left" size={18} />
            </button>
            <span className="product-cost-carousel__counter">{visibleIndex + 1} / {products.length}</span>
            <button type="button" aria-label="다음 제품" onClick={goToNext}>
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="product-cost-carousel__viewport">
        <div className="product-cost-carousel__track" style={{ transform: `translateX(-${visibleIndex * 100}%)` }}>
          {products.map((product, index) => {
            const trend = getProductCostTrend(product, index)
            const changeDirection = trend.changeRate >= 0 ? '상승' : '하락'

            return (
              <article className="product-cost-slide" aria-hidden={index !== visibleIndex} key={product.id}>
                <div className="product-cost-slide__product">
                  <div><strong>{product.name}</strong></div>
                  <button type="button" onClick={() => onOpen(product.id)} tabIndex={index === visibleIndex ? 0 : -1}>
                    상세 보기 <Icon name="chevron-right" size={14} />
                  </button>
                </div>

                <div className="product-cost-slide__metric">
                  <span>현재 총원가</span>
                  <strong>{numberFormatter.format(trend.currentCost)}<small>원</small></strong>
                  <em className={trend.changeRate >= 0 ? 'is-up' : 'is-down'}>
                    전월 대비 {Math.abs(trend.changeRate).toFixed(1)}% {changeDirection}
                  </em>
                </div>

                <div className="product-cost-slide__chart">
                  <svg viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${product.name} 최근 6개월 총원가 추이`}>
                    {[70, 160, 250].map((y) => <line key={y} x1="20" x2="880" y1={y} y2={y} />)}
                    <path className="product-cost-slide__area" d={trend.areaPath} />
                    <polyline points={trend.points} />
                    {trend.values.map((value, pointIndex) => (
                      <circle key={`${product.id}-${pointIndex}`} cx={trend.coordinates[pointIndex].x} cy={trend.coordinates[pointIndex].y} r="6">
                        <title>{`${monthLabels[pointIndex]} ${numberFormatter.format(value)}원`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div>{monthLabels.map((month) => <span key={month}>{month}</span>)}</div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

    </section>
  )
}

export function ExchangeRatePill() {
  const [currency, setCurrency] = useState<ExchangeCurrencyCode>('USD')
  const rate = exchangeRates[currency]

  return (
    <div className="exchange-rate-card">
      <div className="exchange-rate-card__select">
        <span className="exchange-rate-card__flag" aria-hidden="true">{rate.flag}</span>
        <select
          aria-label="환율 통화 선택"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as ExchangeCurrencyCode)}
        >
          {exchangeCurrencyCodes.map((code) => (
            <option key={code} value={code}>{exchangeRates[code].label}</option>
          ))}
        </select>
        <Icon name="chevron-down" size={14} />
      </div>
      <div className="exchange-rate-card__value">
        <strong>{rate.value}<small>원</small></strong>
        <em className={`exchange-rate-card__change is-${rate.changeTone}`}>{rate.change}</em>
      </div>
    </div>
  )
}

export function FinalCostSummaryCard({ summary, onOpen }: FinalCostSummaryCardProps) {
  const hasData = summary.hasMaterialData || summary.hasOperatingData
  const monthLabel = summary.month ? `${summary.month.replace('-', '년 ')}월 기준` : '최신 기준'

  return (
    <section className="card final-cost-summary-card" aria-labelledby="final-cost-summary-title">
      <div className="final-cost-summary-card__heading">
        <h2 id="final-cost-summary-title"><Icon name="calculator" size={22} />최종 원가 요약</h2>
        <span className={hasData ? 'is-ready' : ''}>{hasData ? monthLabel : '입력 대기'}</span>
      </div>

      <div className="final-cost-summary-card__metric">
        <span>예상 총원가</span>
        <strong>{numberFormatter.format(summary.totalCost)}<small>원</small></strong>
      </div>

      <div className="final-cost-summary-card__visual">
        <CostCompositionChart compact summary={summary} />
        <div>
          <dl className="final-cost-summary-card__costs">
            <div><dt>원재료비</dt><dd>{numberFormatter.format(summary.materialCost)}원</dd></div>
            <div><dt>운영비</dt><dd>{numberFormatter.format(summary.operatingCost)}원</dd></div>
          </dl>

          <div className="final-cost-summary-card__breakdown" aria-label="운영비 구성">
            <span>인건비<strong>{numberFormatter.format(summary.laborCost)}원</strong></span>
            <span>공과금<strong>{numberFormatter.format(summary.utilityCost)}원</strong></span>
            <span>기타 간접비<strong>{numberFormatter.format(summary.indirectCost)}원</strong></span>
          </div>
        </div>
      </div>

      <button className="final-cost-summary-card__open" type="button" onClick={onOpen}>
        3단계 결과 보기 <Icon name="chevron-right" size={14} />
      </button>
    </section>
  )
}
