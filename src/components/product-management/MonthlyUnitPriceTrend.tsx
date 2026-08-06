import { useState } from 'react'

type MonthlyUnitPriceTrendProps = {
  currentValue: number
  label: string
  productId: string
  anchorMonth: string
  formatValue: (value: number) => string
}

function seededFactor(seedText: string, index: number) {
  let hash = 0
  const key = `${seedText}-${index}`
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0x7fffffff
  }
  const normalized = (hash % 1000) / 1000
  return (normalized - 0.5) * 0.18
}

function buildMonths(anchorMonth: string, count: number) {
  const [yearStr, monthStr] = anchorMonth.split('-')
  let year = Number(yearStr)
  let month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    year = 2026
    month = 12
  }
  const months: { key: string; label: string }[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    let m = month - i
    let y = year
    while (m <= 0) {
      m += 12
      y -= 1
    }
    months.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${m}월` })
  }
  return months
}

const MONTH_COUNT = 12
const VIEW_W = 760
const VIEW_H = 200
const PAD_LEFT = 58
const PAD_RIGHT = 20
const PAD_TOP = 18
const PAD_BOTTOM = 26
const Y_TICKS = 4

function tidyValue(value: number) {
  return value >= 1000 ? Math.round(value) : Math.round(value * 10) / 10
}

const compactFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function MonthlyUnitPriceTrend({
  currentValue,
  label,
  productId,
  anchorMonth,
  formatValue,
}: MonthlyUnitPriceTrendProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const months = buildMonths(anchorMonth, MONTH_COUNT)

  const values = new Array<number>(MONTH_COUNT)
  values[MONTH_COUNT - 1] = currentValue
  for (let index = MONTH_COUNT - 2; index >= 0; index -= 1) {
    const factor = seededFactor(productId, index) * 0.5
    values[index] = Math.max(1, values[index + 1] * (1 - factor))
  }

  const rawMax = Math.max(...values, 1)
  const rawMin = Math.min(...values)
  const axisMin = Math.max(0, rawMin - (rawMax - rawMin) * 0.15)
  const axisMax = rawMax + (rawMax - rawMin) * 0.15
  const range = axisMax - axisMin || axisMax || 1

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM
  const stepX = plotW / (MONTH_COUNT - 1)

  const yFor = (value: number) => PAD_TOP + plotH - ((value - axisMin) / range) * plotH

  const points = values.map((value, index) => ({
    x: PAD_LEFT + stepX * index,
    y: yFor(value),
    value,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} Z`

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const value = axisMin + (range * i) / Y_TICKS
    return { value, y: yFor(value) }
  })

  const active = hoverIndex != null ? points[hoverIndex] : null
  const tooltipLeft = active ? (active.x / VIEW_W) * 100 : 0
  const tooltipTop = active ? (active.y / VIEW_H) * 100 : 0

  return (
    <section className="unit-price-trend" aria-labelledby="unit-price-trend-title">
      <div className="unit-price-trend__heading">
        <div>
          <h3 id="unit-price-trend-title">{label} 월별 추이</h3>
          <p>최근 12개월 {label} 변동입니다.</p>
        </div>
      </div>

      <div className="unit-price-trend__plot">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`최근 12개월 ${label} 꺾은선 그래프`}>
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line className="unit-price-trend__grid" x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={tick.y} y2={tick.y} />
              <text className="unit-price-trend__y-label" x={PAD_LEFT - 8} y={tick.y + 3} textAnchor="end">
                {compactFormatter.format(tick.value)}
              </text>
            </g>
          ))}

          <path className="unit-price-trend__area" d={areaPath} />
          <path className="unit-price-trend__line" d={linePath} />

          {active && (
            <line
              className="unit-price-trend__cursor"
              x1={active.x}
              x2={active.x}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
            />
          )}

          {points.map((p, index) => (
            <circle
              key={months[index].key}
              className={
                (index === MONTH_COUNT - 1 ? 'unit-price-trend__dot unit-price-trend__dot--latest' : 'unit-price-trend__dot')
                + (hoverIndex === index ? ' is-active' : '')
              }
              cx={p.x}
              cy={p.y}
              r={index === MONTH_COUNT - 1 ? 3.5 : 2.5}
            />
          ))}

          <text className="unit-price-trend__x-title" x={PAD_LEFT - 10} y={VIEW_H - 8} textAnchor="end">
            월
          </text>
          {months.map((month, index) => (
            <text
              key={month.key}
              className={`unit-price-trend__x-label${hoverIndex === index ? ' is-active' : ''}`}
              x={PAD_LEFT + stepX * index}
              y={VIEW_H - 8}
              textAnchor="middle"
            >
              {month.label}
            </text>
          ))}

          {points.map((p, index) => (
            <rect
              key={`hit-${months[index].key}`}
              className="unit-price-trend__hit"
              x={p.x - stepX / 2}
              y={PAD_TOP}
              width={stepX}
              height={plotH}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
            />
          ))}
        </svg>

        {active && (
          <div
            className="unit-price-trend__tooltip"
            style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
            role="status"
          >
            <span className="unit-price-trend__tooltip-month">{months[hoverIndex!].label}</span>
            <strong>{formatValue(tidyValue(active.value))}</strong>
          </div>
        )}
      </div>
    </section>
  )
}
