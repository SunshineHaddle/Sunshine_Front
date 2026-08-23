import { useEffect, useMemo, useState } from 'react'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import { Icon } from '../common/Icon'
import {
  buildAxis,
  niceTicks,
  xForMonth,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  PLOT_BOTTOM,
} from './chartAxis'
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
   * PDF 내보내기 모드. 페이지네이션을 끄고 전 제품을 한 번에 펼친다.
   * 격자는 2열로 고정해 카드가 페이지 중간에서 잘리지 않게 한다.
   */
  expandAll?: boolean
  /**
   * 제품별 확정 단가 추이(§9-2). productId → 'YYYY-MM-01' 별 포장 단가.
   * 값이 없는 제품은 카드에 안내 문구가 대신 뜬다.
   */
  costTrends?: Record<string, { period: string; unitCost: number; materialCost: number }[]>
}

// 원 단위 금액이라 소수점을 쓰지 않는다. unit_cost 는 numeric(16,2) 라
// 그대로 두면 '6,761.71원' 처럼 나온다
const numberFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 'YYYY-MM' → '2026년 4월'. 값이 없으면 빈 문자열 */
const monthLabelOf = (month: string) =>
  month ? `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월` : ''

/**
 * 한 페이지에 깔 제품 카드 수. 2열 격자라 4개면 두 줄로 딱 떨어진다.
 * PDF(expandAll)에서는 페이지네이션을 쓸 수 없어 이 값을 무시하고 전부 그린다.
 */
const PRODUCTS_PER_PAGE = 4



/** 그래프에 찍히는 점 하나. monthIndex 는 가로축(12개월)에서의 자리 */
type TrendPoint = { monthIndex: number; value: number; x: number; y: number }


/**
 * 제품 원가 추이.
 *
 * 확정된 달의 실제 재료비 총액(product_cost_summaries.material_cost)만 그린다.
 * 포장 1개당 단가가 아니라 총액이다 — 제품 상세의 '재료비' 카드와 같은 값.
 * 값이 없으면 null 을 돌려주고, 호출부가 안내 문구로 대체한다.
 */
function getProductCostTrend(
  monthKeys: string[],
  realSeries?: { period: string; unitCost: number; materialCost: number }[],
) {
  // 'YYYY-MM-01' → 가로축 자리
  const byMonth = new Map<number, number>()
  for (const point of realSeries ?? []) {
    const index = monthKeys.indexOf(point.period.slice(0, 7))
    if (index >= 0) byMonth.set(index, point.materialCost)
  }

  // 확정된 달이 없으면 아무것도 그리지 않는다.
  // 예전에는 현재 배합 원가에 패턴을 곱한 곡선을 그렸는데, 지어낸 값이
  // 실제 원가처럼 보여서 갓 만든 제품에도 그럴듯한 추이가 떴다.
  if (byMonth.size === 0) return null

  const raw = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([monthIndex, value]) => ({ monthIndex, value }))

  const values = raw.map((point) => point.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const axisMin = ticks[0]
  const axisMax = ticks[ticks.length - 1]
  const axisRange = Math.max(axisMax - axisMin, 1)

  // 눈금 범위에 맞춰 세로 자리를 잡는다. 점과 격자선이 같은 자를 쓴다
  const yFor = (value: number) =>
    PLOT_BOTTOM - ((value - axisMin) / axisRange) * (PLOT_BOTTOM - PLOT_TOP)

  const series: TrendPoint[] = raw.map(({ monthIndex, value }) => ({
    monthIndex,
    value,
    x: xForMonth(monthIndex, monthKeys.length),
    y: yFor(value),
  }))

  const currentCost = values.at(-1) ?? 0
  const previousCost = values.at(-2) ?? currentCost
  /** 마지막 확정 달. '이 달' 이라고 뭉뚱그리면 4월 값이 이번 달 값처럼 보인다 */
  const latestMonth = monthKeys[raw.at(-1)?.monthIndex ?? 0] ?? ''
  const changeRate = ((currentCost - previousCost) / Math.max(previousCost, 1)) * 100

  const baseline = 290
  const areaPath = `M ${series[0].x},${baseline} `
    + series.map(({ x, y }) => `L ${x},${y}`).join(' ')
    + ` L ${series.at(-1)!.x},${baseline} Z`

  return {
    changeRate,
    currentCost,
    latestMonth,
    series,
    points: series.map(({ x, y }) => `${x},${y}`).join(' '),
    areaPath,
    // 값과 그려질 자리를 함께 넘긴다. 격자선도 이 자리에 그어야 눈금과 맞는다
    yTicks: ticks.map((value) => ({ value, y: yFor(value) })),
  }
}

export function ProductCostTrendCarousel({
  products,
  onOpen,
  compact = false,
  expandAll = false,
  costTrends,
}: ProductCostTrendCarouselProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ productId: string; index: number } | null>(null)
  const [page, setPage] = useState(0)
  const { keys: monthKeys, labels: monthLabels } = buildAxis(costTrends)
  const cardClassName = `card product-cost-carousel${compact ? ' product-cost-carousel--compact' : ''}`
    + (expandAll ? ' product-cost-carousel--expanded' : '')

  const pageCount = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE))
  // 제품이 지워져 페이지 수가 줄면 지금 페이지가 범위를 벗어난다. 그릴 때 마지막
  // 장으로 당겨 빈 칸이 뜨지 않게 한다 (effect 로 되돌리면 렌더가 한 번 더 돈다)
  const currentPage = Math.min(page, pageCount - 1)

  // PDF 는 넘길 수 없으니 페이지네이션을 끄고 전 제품을 그린다
  const visibleProducts = useMemo(
    () => (expandAll
      ? products
      : products.slice(currentPage * PRODUCTS_PER_PAGE, (currentPage + 1) * PRODUCTS_PER_PAGE)),
    [products, currentPage, expandAll],
  )
  const showPagination = !expandAll && pageCount > 1

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

  return (
    <section className={cardClassName} aria-labelledby="product-cost-card-title">
      <div className="product-cost-carousel__heading">
        <h2 id="product-cost-card-title"><Icon name="trend" size={22} />제품별 원가 변동 추이</h2>
      </div>

      {/*
        예전에는 한 제품씩 넘겨 보는 캐러셀이었다. 제품이 늘수록 전부 보려면
        계속 넘겨야 해서, 작은 카드를 격자로 깔아 모든 제품을 한 번에 보여준다.
      */}
      <div className="product-cost-grid">
        {visibleProducts.map((product) => {
          const trend = getProductCostTrend(monthKeys, costTrends?.[product.id])
          const changeDirection = trend && trend.changeRate >= 0 ? '상승' : '하락'
          const activePointIndex = hoveredPoint?.productId === product.id ? hoveredPoint.index : null
          const activeCoordinate =
            trend && activePointIndex !== null ? trend.series[activePointIndex] : null
          const tooltipWidth = 260
          const tooltipX = activeCoordinate
            ? Math.min(Math.max(activeCoordinate.x - tooltipWidth / 2, 4), 900 - tooltipWidth - 4)
            : 0
          const tooltipY = activeCoordinate ? Math.max(activeCoordinate.y - 96, 8) : 0

          return (
            <article className="product-cost-slide" key={product.id}>
              <div className="product-cost-slide__product">
                <div>
                  <strong className="product-cost-slide__name" title={product.name}>{product.name}</strong>
                </div>
                <button type="button" onClick={() => onOpen(product.id)}>
                  상세 보기 <Icon name="chevron-right" size={18} />
                </button>
              </div>

              {trend ? (
                <>
                <div className="product-cost-slide__metric">
                  {/*
                    확정된 마지막 달을 그대로 적는다. 예전에는 '이 달 재료비' 라고 써서,
                    4월만 확정한 상태에서 8월 대시보드를 열면 4월 값이 이번 달 값처럼 보였다.
                  */}
                  <span>{monthLabelOf(trend.latestMonth)} 재료비</span>
                  <strong>{numberFormatter.format(trend.currentCost)}<small>원</small></strong>
                  <em className={trend.changeRate >= 0 ? 'is-up' : 'is-down'}>
                    전월 대비 {Math.abs(trend.changeRate).toFixed(1)}% {changeDirection}
                  </em>
                </div>

                <div className="product-cost-slide__chart">
                  <svg viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${product.name} 최근 12개월 재료비 추이`}>
                    {trend.yTicks.map((tick) => (
                      <g aria-hidden="true" key={tick.value}>
                        <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={tick.y} y2={tick.y} />
                        <text className="product-cost-slide__axis-label" x={PLOT_LEFT - 10} y={tick.y + 6}>
                          {numberFormatter.format(tick.value)}
                        </text>
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
                        tabIndex={0}
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
                        <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="86" rx="12" />
                        <text x={tooltipX + 18} y={tooltipY + 33}>{monthLabels[trend.series[activePointIndex].monthIndex]}</text>
                        <text className="product-cost-slide__tooltip-value" x={tooltipX + 18} y={tooltipY + 68}>
                          {numberFormatter.format(trend.series[activePointIndex].value)}원
                        </text>
                      </g>
                    )}
                  </svg>
                  {/*
                    라벨을 점과 같은 식으로 배치한다. 예전에는 12칸 그리드로
                    균등 분할했는데, 칸의 가운데와 점의 x 가 반 칸씩 어긋났다
                    (점은 58~880 사이에 놓이고 그리드는 패딩 안을 12등분했다).
                  */}
                  <div className="product-cost-slide__axis">
                    {monthLabels.map((month, monthIndex) => (
                      <span
                        key={month}
                        style={{
                          left: `${(xForMonth(monthIndex, monthLabels.length) / 900) * 100}%`,
                        }}
                      >
                        {month}
                      </span>
                    ))}
                  </div>
                </div>
                </>
              ) : (
                <p className="product-cost-slide__empty">
                  확정된 원가가 없습니다.
                  <br />
                  데이터 입력 3단계에서 <strong>원가 계산</strong>을 실행하면 표시됩니다.
                </p>
              )}
            </article>
          )
        })}
      </div>

      {showPagination && (
        <div className="product-cost-carousel__footer">
          <span>총 {products.length}개 제품</span>
          <nav className="table-pagination" aria-label="제품 원가 추이 페이지">
            <button
              type="button"
              aria-label="이전 페이지"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(value - 1, 0))}
            >
              <Icon name="chevron-left" size={14} />
            </button>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                type="button"
                key={index}
                className={index === currentPage ? 'is-current' : undefined}
                aria-current={index === currentPage ? 'page' : undefined}
                aria-label={`${index + 1}페이지`}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
            <button
              type="button"
              aria-label="다음 페이지"
              disabled={currentPage === pageCount - 1}
              onClick={() => setPage((value) => Math.min(value + 1, pageCount - 1))}
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </nav>
        </div>
      )}
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
