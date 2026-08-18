import { useState } from 'react'
import type { ProductMonthlyCost } from '../../lib/api/results'

/**
 * 제품 월별 원가 추이 — 재료비 · 부자재비 · 총 금액 세 계열을 한 그래프에 그린다.
 *
 * 값은 전부 확정 스냅샷(product_cost_summaries)에서 온다.
 * 즉 1단계 수불자료와 2단계 운영비가 마감을 거쳐 이 제품 몫으로 배분된 금액이다.
 */
type ProductCostTrendChartProps = {
  series: ProductMonthlyCost[]
  /** 강조할 월 'YYYY-MM'. 분석 월 선택과 맞춘다 */
  activeMonth?: string
}

const VIEW_W = 760
const VIEW_H = 260
const PAD_L = 66
const PAD_R = 18
const PAD_T = 22
const PAD_B = 34
const Y_TICKS = 4

const TIP_W = 150
const TIP_H = 38

const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/** 그릴 계열. id 는 CSS 클래스와 짝을 이룬다 */
const LINES = [
  { id: 'material', label: '재료비', pick: (m: ProductMonthlyCost) => m.materialCost },
  { id: 'sub', label: '부자재비', pick: (m: ProductMonthlyCost) => m.subMaterialCost },
  { id: 'total', label: '총 금액', pick: (m: ProductMonthlyCost) => m.totalCost },
] as const

type Hover = { lineId: string; index: number }

export function ProductCostTrendChart({ series, activeMonth }: ProductCostTrendChartProps) {
  const [hover, setHover] = useState<Hover | null>(null)

  if (series.length === 0) {
    return (
      <p className="product-cost-trend__empty">
        확정된 달이 없습니다. 데이터 입력 3단계에서 <strong>원가 계산</strong>을 실행하면 표시됩니다.
      </p>
    )
  }

  const plotW = VIEW_W - PAD_L - PAD_R
  const plotH = VIEW_H - PAD_T - PAD_B
  // 점이 하나뿐이면 가운데에 놓는다 (0 으로 나누지 않기 위해서이기도 하다)
  const xAt = (i: number) =>
    series.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (series.length - 1)) * plotW

  const max = Math.max(...series.map((m) => m.totalCost), 1)
  const yAt = (v: number) => PAD_T + plotH - (v / max) * plotH

  const hovered = hover ? series[hover.index] : null
  const hoveredLine = hover ? LINES.find((l) => l.id === hover.lineId) : null
  const hoverX = hover ? xAt(hover.index) : 0
  const hoverY = hovered && hoveredLine ? yAt(hoveredLine.pick(hovered)) : 0
  // 점 바로 위에 띄우되 그래프 밖으로 나가지 않게 가둔다
  const tipX = Math.min(Math.max(hoverX - TIP_W / 2, 2), VIEW_W - TIP_W - 2)
  const tipY = Math.max(hoverY - TIP_H - 10, 2)

  return (
    <div className="product-cost-trend">
      <ul className="product-cost-trend__legend">
        {LINES.map((line) => (
          <li key={line.id}><i className={`is-${line.id}`} /> {line.label}</li>
        ))}
      </ul>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="월별 재료비·부자재비·총 금액 추이">
        {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
          const value = (max * i) / Y_TICKS
          const y = yAt(value)
          return (
            <g key={i} aria-hidden="true">
              <line className="product-cost-trend__grid" x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} />
              <text className="product-cost-trend__y-label" x={PAD_L - 8} y={y + 3} textAnchor="end">
                {compact.format(value)}
              </text>
            </g>
          )
        })}

        {/* 선택한 분석 월을 세로선으로 표시한다 */}
        {activeMonth && series.some((m) => m.period.slice(0, 7) === activeMonth) && (
          <line
            className="product-cost-trend__active-month"
            x1={xAt(series.findIndex((m) => m.period.slice(0, 7) === activeMonth))}
            x2={xAt(series.findIndex((m) => m.period.slice(0, 7) === activeMonth))}
            y1={PAD_T}
            y2={PAD_T + plotH}
            aria-hidden="true"
          />
        )}

        {series.map((month, i) => (
          <text
            key={month.period}
            className="product-cost-trend__x-label"
            x={xAt(i)}
            y={VIEW_H - 12}
            textAnchor="middle"
            aria-hidden="true"
          >
            {month.label}
          </text>
        ))}

        {LINES.map((line) => (
          <polyline
            key={line.id}
            className={`product-cost-trend__line is-${line.id}`}
            points={series.map((m, i) => `${xAt(i)},${yAt(line.pick(m))}`).join(' ')}
            aria-hidden="true"
          />
        ))}

        {LINES.map((line) =>
          series.map((month, i) => {
            const isOn = hover?.lineId === line.id && hover.index === i
            return (
              <g
                key={`${line.id}-${month.period}`}
                className="product-cost-trend__point"
                role="img"
                aria-label={`${month.label} ${line.label} ${won(line.pick(month))}`}
                tabIndex={0}
                onMouseEnter={() => setHover({ lineId: line.id, index: i })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ lineId: line.id, index: i })}
                onBlur={() => setHover(null)}
              >
                {/* 점이 작아서 겨냥하기 어렵다. 투명한 넓은 원으로 잡는다 */}
                <circle className="product-cost-trend__hit" cx={xAt(i)} cy={yAt(line.pick(month))} r="14" />
                <circle
                  className={`product-cost-trend__dot is-${line.id}${isOn ? ' is-on' : ''}`}
                  cx={xAt(i)}
                  cy={yAt(line.pick(month))}
                  r={isOn ? 6 : 4}
                />
              </g>
            )
          }),
        )}

        {hovered && hoveredLine && (
          <g className="product-cost-trend__tooltip" aria-hidden="true">
            <rect x={tipX} y={tipY} width={TIP_W} height={TIP_H} rx="7" />
            <text x={tipX + 10} y={tipY + 15}>{hovered.label} · {hoveredLine.label}</text>
            <text className="product-cost-trend__tooltip-value" x={tipX + 10} y={tipY + 30}>
              {won(hoveredLine.pick(hovered))}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
