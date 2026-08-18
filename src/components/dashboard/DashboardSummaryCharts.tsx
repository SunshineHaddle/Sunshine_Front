import { useEffect, useRef, useState } from 'react'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import { Icon } from '../common/Icon'
import { FlagIcon } from '../common/FlagIcon'
import { fetchPillRates } from '../../lib/api/exchangeRates'

type ExchangeCurrencyCode = 'USD' | 'JPY' | 'EUR' | 'CNY' | 'SAR' | 'AED'

// 실시간 값이 오기 전까지 잠깐 쓰는 폴백 값.
// 통화 구성은 환율 산출 페이지의 defaultCurrencies 와 맞춘다.
const exchangeRates: Record<ExchangeCurrencyCode, {
  label: string
  value: string
}> = {
  USD: { label: 'USD/KRW', value: '1,386.40' },
  JPY: { label: 'JPY/KRW', value: '9.05' },
  EUR: { label: 'EUR/KRW', value: '1,455.00' },
  CNY: { label: 'CNY/KRW', value: '185.40' },
  SAR: { label: 'SAR/KRW', value: '357.80' },
  AED: { label: 'AED/KRW', value: '365.40' },
}

const exchangeCurrencyCodes = Object.keys(exchangeRates) as ExchangeCurrencyCode[]

type ProductCostTrendCarouselProps = {
  products: RecipeProduct[]
  onOpen: (productId: string) => void
  compact?: boolean
  /**
   * 캐러셀을 접고 모든 제품을 한 번에 세로로 펼친다.
   * PDF 는 화면에 보이는 것만 캡처하므로, 내보낼 때 이걸 켜야 전 제품이 담긴다.
   */
  expandAll?: boolean
  /**
   * 제품별 확정 단가 추이(§9-2). productId → 'YYYY-MM-01' 별 포장 단가.
   * 비어 있으면 예전처럼 현재 원가에 패턴을 곱한 참고용 곡선을 그린다.
   */
  costTrends?: Record<string, { period: string; unitCost: number }[]>
}

const trendPatterns = [
  [0.86, 0.88, 0.87, 0.90, 0.89, 0.92, 0.93, 0.95, 0.94, 0.97, 0.98, 1],
  [1.12, 1.10, 1.11, 1.08, 1.09, 1.06, 1.05, 1.04, 1.03, 1.02, 1.01, 1],
  [0.93, 0.95, 0.92, 0.96, 0.94, 0.97, 0.95, 0.98, 0.96, 0.99, 0.97, 1],
]
// 원 단위 금액이라 소수점을 쓰지 않는다. unit_cost 는 numeric(16,2) 라
// 그대로 두면 '6,761.71원' 처럼 나온다
const numberFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const compactWonFormatter = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** 'YYYY-MM' 한 달 뒤로 이동 */
function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const MAX_MONTHS = 12

/**
 * 가로축을 만든다.
 *
 * 확정 데이터가 있으면 **그 데이터가 걸친 범위**만 축으로 쓴다.
 * 항상 12칸으로 벌리면, 두 달치 데이터가 오른쪽 끝 9% 안에 뭉쳐
 * 선이 거의 보이지 않는다. 데이터가 쌓일수록 축이 자연히 넓어진다.
 *
 * 데이터가 없으면 이번 달로 끝나는 12개월을 그린다 (참고용 곡선을 위한 축).
 */
function buildAxis(costTrends?: Record<string, { period: string; unitCost: number }[]>) {
  const months = new Set<string>()
  for (const series of Object.values(costTrends ?? {})) {
    for (const point of series) months.add(point.period.slice(0, 7))
  }

  const today = new Date()
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  let last: string
  let count: number

  if (months.size === 0) {
    last = thisMonth
    count = MAX_MONTHS
  } else {
    const sorted = [...months].sort()
    const first = sorted[0]
    last = sorted[sorted.length - 1]

    // first..last 사이의 개월 수. 중간에 빈 달이 있어도 자리를 남겨 간격을 유지한다
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    count = Math.min((ly - fy) * 12 + (lm - fm) + 1, MAX_MONTHS)
  }

  const keys: string[] = []
  const labels: string[] = []
  for (let back = count - 1; back >= 0; back -= 1) {
    const month = shiftMonth(last, -back)
    keys.push(month)
    labels.push(`${Number(month.slice(5, 7))}월`)
  }
  return { keys, labels }
}

/** 그래프에 찍히는 점 하나. monthIndex 는 가로축(12개월)에서의 자리 */
type TrendPoint = { monthIndex: number; value: number; x: number; y: number }

/** 축 칸 수에 맞춘 x 좌표. 칸이 하나뿐이면 가운데 */
const xForMonth = (monthIndex: number, count: number) =>
  count <= 1 ? 469 : 58 + (monthIndex / (count - 1)) * 822

/**
 * 제품 원가 추이.
 *
 * 확정된 달의 실제 단가(product_cost_summaries.unit_cost)가 있으면 그걸 그린다.
 * 아직 한 달도 마감하지 않았으면 예전처럼 현재 원가에 패턴을 곱한 참고용 곡선을 그린다 —
 * 화면이 비어 보이지 않게 하기 위한 폴백이고, 실제 값이 아니다.
 */
function getProductCostTrend(
  product: RecipeProduct,
  productIndex: number,
  monthKeys: string[],
  realSeries?: { period: string; unitCost: number }[],
) {
  const fallbackCost = product.materialCost
    + product.laborCost
    + product.indirectCosts.reduce((sum, cost) => sum + cost.amount, 0)

  // 'YYYY-MM-01' → 가로축 자리
  const byMonth = new Map<number, number>()
  for (const point of realSeries ?? []) {
    const index = monthKeys.indexOf(point.period.slice(0, 7))
    if (index >= 0) byMonth.set(index, point.unitCost)
  }

  const isReal = byMonth.size > 0
  const raw: { monthIndex: number; value: number }[] = isReal
    ? [...byMonth.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([monthIndex, value]) => ({ monthIndex, value }))
    : trendPatterns[productIndex % trendPatterns.length]
        .slice(-monthKeys.length)
        .map((ratio, monthIndex) => ({
          monthIndex,
          value: Math.round(fallbackCost * ratio),
        }))

  const values = raw.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = Math.max(maximum - minimum, 1)

  // 점이 하나뿐이면 세로로 흔들릴 곳이 없다. 가운데 높이에 놓는다
  const series: TrendPoint[] = raw.map(({ monthIndex, value }) => ({
    monthIndex,
    value,
    x: xForMonth(monthIndex, monthKeys.length),
    y: raw.length === 1 ? 160 : 250 - ((value - minimum) / range) * 180,
  }))

  const currentCost = values.at(-1) ?? 0
  const previousCost = values.at(-2) ?? currentCost
  const changeRate = ((currentCost - previousCost) / Math.max(previousCost, 1)) * 100

  const baseline = 290
  const areaPath = `M ${series[0].x},${baseline} `
    + series.map(({ x, y }) => `L ${x},${y}`).join(' ')
    + ` L ${series.at(-1)!.x},${baseline} Z`

  return {
    isReal,
    changeRate,
    currentCost,
    series,
    points: series.map(({ x, y }) => `${x},${y}`).join(' '),
    areaPath,
    yTicks: [maximum, Math.round((maximum + minimum) / 2), minimum],
  }
}

type ProductSelectorProps = {
  products: RecipeProduct[]
  activeIndex: number
  interactive: boolean
  onSelect: (index: number) => void
}

function ProductSelector({ products, activeIndex, interactive, onSelect }: ProductSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeName = products[activeIndex]?.name ?? ''

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!interactive) {
    return <strong className="product-cost-slide__name">{activeName}</strong>
  }

  return (
    <div className="product-cost-slide__selector" ref={containerRef} onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="product-cost-slide__selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{activeName}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open && (
        <ul className="product-cost-slide__selector-menu" role="listbox">
          {products.map((product, index) => (
            <li key={product.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={index === activeIndex ? 'is-active' : undefined}
                onClick={() => {
                  onSelect(index)
                  setOpen(false)
                }}
              >
                {product.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProductCostTrendCarousel({
  products,
  onOpen,
  compact = false,
  expandAll = false,
  costTrends,
}: ProductCostTrendCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [hoveredPoint, setHoveredPoint] = useState<{ productId: string; index: number } | null>(null)
  // 드래그 중에는 트랙이 손가락을 그대로 따라가야 해서 transition 을 끈다.
  // dragState 는 ref 라 렌더 중 읽으면 안 되므로 같은 사실을 state 로도 들고 있는다.
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef<{ startX: number; width: number } | null>(null)
  const { keys: monthKeys, labels: monthLabels } = buildAxis(costTrends)
  /** 축 안에 실제 확정 단가가 하나라도 놓이는가 */
  const hasRealData = Object.values(costTrends ?? {}).some((series) =>
    series.some((point) => monthKeys.includes(point.period.slice(0, 7))),
  )
  const cardClassName = `card product-cost-carousel${compact ? ' product-cost-carousel--compact' : ''}`
    + (expandAll ? ' product-cost-carousel--expanded' : '')

  useEffect(() => {
    if (expandAll || products.length < 2 || isPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % products.length), 4000)
    return () => window.clearInterval(timer)
  }, [isPaused, products.length, expandAll])

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

  const handleDragStart = (clientX: number, width: number) => {
    if (products.length < 2) return
    dragState.current = { startX: clientX, width }
    setIsDragging(true)
    setIsPaused(true)
  }

  const handleDragMove = (clientX: number) => {
    if (!dragState.current) return
    setDragOffset(clientX - dragState.current.startX)
  }

  const handleDragEnd = () => {
    if (!dragState.current) return
    const { width } = dragState.current
    const threshold = Math.max(width * 0.2, 40)
    if (dragOffset <= -threshold) goToNext()
    else if (dragOffset >= threshold) goToPrevious()
    dragState.current = null
    setIsDragging(false)
    setDragOffset(0)
    setIsPaused(false)
  }

  const trackTransform = `translateX(calc(-${visibleIndex * 100}% + ${dragOffset}px))`

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
        {/* 확정 데이터로 그리는지, 참고용 곡선인지 한눈에 구분되게 한다 */}
        {!hasRealData && (
          <span className="product-cost-carousel__estimate" title="마감된 달의 단가가 없어 현재 배합 기준으로 그린 참고용 곡선입니다">
            참고용 · 확정 데이터 없음
          </span>
        )}
        {!expandAll && products.length > 1 && (
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

      <div
        className={`product-cost-carousel__viewport${!expandAll && products.length > 1 ? ' is-draggable' : ''}`}
        onPointerDown={expandAll ? undefined : (event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          handleDragStart(event.clientX, event.currentTarget.offsetWidth)
        }}
        onPointerMove={expandAll ? undefined : (event) => handleDragMove(event.clientX)}
        onPointerUp={expandAll ? undefined : handleDragEnd}
        onPointerCancel={expandAll ? undefined : handleDragEnd}
        onPointerLeave={expandAll ? undefined : () => { if (dragState.current) handleDragEnd() }}
      >
        <div
          className="product-cost-carousel__track"
          style={expandAll
            ? undefined
            : { transform: trackTransform, transition: isDragging ? 'none' : undefined }}
        >
          {products.map((product, index) => {
            const trend = getProductCostTrend(product, index, monthKeys, costTrends?.[product.id])
            const changeDirection = trend.changeRate >= 0 ? '상승' : '하락'
            const activePointIndex = hoveredPoint?.productId === product.id ? hoveredPoint.index : null
            const activeCoordinate = activePointIndex === null ? null : trend.series[activePointIndex]
            const tooltipWidth = 150
            const tooltipX = activeCoordinate
              ? Math.min(Math.max(activeCoordinate.x - tooltipWidth / 2, 4), 900 - tooltipWidth - 4)
              : 0
            const tooltipY = activeCoordinate ? Math.max(activeCoordinate.y - 50, 8) : 0

            return (
              <article
                className="product-cost-slide"
                aria-hidden={expandAll ? undefined : index !== visibleIndex}
                key={product.id}
              >
                <div className="product-cost-slide__product">
                  <div>
                    {/* 펼친 상태에서는 각 슬라이드가 자기 제품명을 그대로 보여준다 */}
                    <ProductSelector
                      products={products}
                      activeIndex={expandAll ? index : visibleIndex}
                      interactive={!expandAll && index === visibleIndex}
                      onSelect={setActiveIndex}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(product.id)}
                    tabIndex={expandAll || index === visibleIndex ? 0 : -1}
                  >
                    상세 보기 <Icon name="chevron-right" size={18} />
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
                  <svg viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${product.name} 최근 12개월 총원가 추이`}>
                    {[70, 160, 250].map((y, tickIndex) => (
                      <g aria-hidden="true" key={y}>
                        <line x1="58" x2="880" y1={y} y2={y} />
                        {trend.yTicks.lastIndexOf(trend.yTicks[tickIndex]) === tickIndex && (
                          <text className="product-cost-slide__axis-label" x="4" y={y + 4}>
                            {compactWonFormatter.format(trend.yTicks[tickIndex])}원
                          </text>
                        )}
                      </g>
                    ))}
                    <path className="product-cost-slide__area" d={trend.areaPath} />
                    <polyline points={trend.points} />
                    {trend.series.map((point, pointIndex) => (
                      <g
                        className="product-cost-slide__point"
                        key={`${product.id}-${point.monthIndex}`}
                        role="img"
                        aria-label={`${monthLabels[point.monthIndex]} ${numberFormatter.format(point.value)}원`}
                        tabIndex={expandAll || index === visibleIndex ? 0 : -1}
                        onMouseEnter={() => setHoveredPoint({ productId: product.id, index: pointIndex })}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={() => setHoveredPoint({ productId: product.id, index: pointIndex })}
                        onBlur={() => setHoveredPoint(null)}
                      >
                        <circle
                          className="product-cost-slide__point-hit"
                          cx={point.x}
                          cy={point.y}
                          r="18"
                        />
                        <circle
                          className="product-cost-slide__point-dot"
                          cx={point.x}
                          cy={point.y}
                          r="5"
                        />
                      </g>
                    ))}
                    {activeCoordinate && activePointIndex !== null && (
                      <g className="product-cost-slide__tooltip" aria-hidden="true">
                        <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="40" rx="7" />
                        <text x={tooltipX + 10} y={tooltipY + 15}>{monthLabels[trend.series[activePointIndex].monthIndex]}</text>
                        <text className="product-cost-slide__tooltip-value" x={tooltipX + 10} y={tooltipY + 31}>
                          {numberFormatter.format(trend.series[activePointIndex].value)}원
                        </text>
                      </g>
                    )}
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
  // 하드코딩 값을 기본으로 두고, 실시간 값이 오면 통화별로 덮어쓴다 (값만, 변동% 없음)
  const [live, setLive] = useState<Partial<Record<ExchangeCurrencyCode, string>>>({})
  const [updatedAt, setUpdatedAt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { rates, updatedAt: at } = await fetchPillRates()
      if (cancelled || rates.length === 0) return
      const next: typeof live = {}
      for (const { code, krw } of rates) {
        if (!exchangeCurrencyCodes.includes(code as ExchangeCurrencyCode)) continue
        next[code as ExchangeCurrencyCode] = krw.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      setLive(next)
      setUpdatedAt(at)
    })()
    return () => { cancelled = true }
  }, [])

  const liveValue = live[currency]
  const value = liveValue ?? exchangeRates[currency].value
  // 실시간 값을 못 받았으면 화면의 숫자는 코드에 박힌 옛 값이다. 실시간인 척하면 안 된다.
  const caption = liveValue
    ? (updatedAt
        ? `${new Date(updatedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 기준`
        : '실시간')
    : '기준값 (실시간 조회 실패)'

  return (
    <div className="exchange-rate-card">
      {/* 국기 · 통화명 · 화살표 전체가 하나의 클릭 영역이다.
          네이티브 select 를 투명하게 덮어씌워 어디를 눌러도 목록이 열린다 */}
      <div className="exchange-rate-card__select">
        <FlagIcon code={currency} size={20} />
        <span className="exchange-rate-card__label">{exchangeRates[currency].label}</span>
        <Icon name="chevron-down" size={14} />
        <select
          className="exchange-rate-card__native"
          aria-label="환율 통화 선택"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as ExchangeCurrencyCode)}
        >
          {exchangeCurrencyCodes.map((code) => (
            <option key={code} value={code}>{exchangeRates[code].label}</option>
          ))}
        </select>
      </div>
      <div className="exchange-rate-card__value">
        <strong>{value}<small>원</small></strong>
        <span className={`exchange-rate-card__caption${liveValue ? '' : ' is-stale'}`}>{caption}</span>
      </div>
    </div>
  )
}
