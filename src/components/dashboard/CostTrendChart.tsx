import { useState } from 'react'
import type { CostTrendPoint } from '../../lib/api/results'

/**
 * §9-1 원가 변동 추이.
 * 예전 costTrendData.ts 상수를 대체한다. 확정된 달만 들어온다.
 */
type CostTrendChartProps = {
  points: CostTrendPoint[]
}

const VIEW_W = 760
const VIEW_H = 220
const PAD_L = 64
const PAD_R = 20
const PAD_T = 18
const PAD_B = 30
const Y_TICKS = 4

const TOOLTIP_W = 168
const TOOLTIP_H = 62

const compact = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export function CostTrendChart({ points }: CostTrendChartProps) {
  // 막대가 얇아서 막대 자체에 올리기 어렵다. 월 단위 열 전체를 감지 영역으로 쓴다
  const [hovered, setHovered] = useState<number | null>(null)

  if (points.length === 0) {
    return (
      <section className="card cost-trend-card" aria-labelledby="cost-trend-title">
        <h2 id="cost-trend-title">원가 변동 추이</h2>
        <p className="cost-trend-card__empty">
          확정된 달이 없습니다. 데이터 입력 3단계에서 <strong>원가 계산</strong>을 실행하면 표시됩니다.
        </p>
      </section>
    )
  }

  const max = Math.max(...points.map((p) => p.managementTotalCost), 1)
  const plotW = VIEW_W - PAD_L - PAD_R
  const plotH = VIEW_H - PAD_T - PAD_B
  const step = plotW / Math.max(points.length, 1)
  const barW = Math.min(step * 0.28, 26)

  const yFor = (v: number) => PAD_T + plotH - (v / max) * plotH
  const centerX = (index: number) => PAD_L + step * index + step / 2

  const active = hovered === null ? null : points[hovered]
  // 툴팁이 그래프 밖으로 나가지 않게 가둔다
  const tooltipX = active
    ? Math.min(Math.max(centerX(hovered!) - TOOLTIP_W / 2, 4), VIEW_W - TOOLTIP_W - 4)
    : 0
  const tooltipY = active
    ? Math.max(yFor(active.managementTotalCost) - TOOLTIP_H - 8, 4)
    : 0

  return (
    <section className="card cost-trend-card" aria-labelledby="cost-trend-title">
      <div className="cost-trend-card__head">
        <div>
          <h2 id="cost-trend-title">원가 변동 추이</h2>
          <p>확정된 달의 제조원가와 경영 총원가입니다.</p>
        </div>
        <ul className="cost-trend-card__legend">
          <li><i className="is-manufacturing" /> 제조원가</li>
          <li><i className="is-total" /> 경영 총원가</li>
        </ul>
      </div>

      <div className="cost-trend-card__plot">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="월별 원가 추이 막대 그래프">
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
            const value = (max * i) / Y_TICKS
            const y = yFor(value)
            return (
              <g key={i} aria-hidden="true">
                <line className="cost-trend__grid" x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} />
                <text className="cost-trend__y-label" x={PAD_L - 8} y={y + 3} textAnchor="end">
                  {compact.format(value)}
                </text>
              </g>
            )
          })}

          {points.map((point, index) => {
            const cx = centerX(index)
            const isActive = hovered === index
            return (
              <g key={point.period}>
                {/* 올라온 달을 옅게 강조한다 */}
                {isActive && (
                  <rect
                    className="cost-trend__column-highlight"
                    x={PAD_L + step * index}
                    y={PAD_T}
                    width={step}
                    height={plotH}
                    aria-hidden="true"
                  />
                )}
                <rect
                  className="cost-trend__bar is-manufacturing"
                  x={cx - barW - 2}
                  y={yFor(point.manufacturingCost)}
                  width={barW}
                  height={PAD_T + plotH - yFor(point.manufacturingCost)}
                  aria-hidden="true"
                />
                <rect
                  className="cost-trend__bar is-total"
                  x={cx + 2}
                  y={yFor(point.managementTotalCost)}
                  width={barW}
                  height={PAD_T + plotH - yFor(point.managementTotalCost)}
                  aria-hidden="true"
                />
                <text className="cost-trend__x-label" x={cx} y={VIEW_H - 10} textAnchor="middle" aria-hidden="true">
                  {point.label}
                </text>

                {/*
                  감지 영역. 막대 두 개를 따로 잡으면 사이 틈에서 툴팁이 깜빡인다.
                  키보드로도 값을 읽을 수 있게 tabIndex 와 aria-label 을 준다.
                */}
                <rect
                  className="cost-trend__hit"
                  x={PAD_L + step * index}
                  y={PAD_T}
                  width={step}
                  height={plotH}
                  tabIndex={0}
                  role="img"
                  aria-label={
                    `${point.label} 제조원가 ${won(point.manufacturingCost)}, `
                    + `경영 총원가 ${won(point.managementTotalCost)}`
                  }
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                />
              </g>
            )
          })}

          {active && (
            <g className="cost-trend__tooltip" aria-hidden="true">
              <rect x={tooltipX} y={tooltipY} width={TOOLTIP_W} height={TOOLTIP_H} rx="7" />
              <text x={tooltipX + 12} y={tooltipY + 17}>{active.label}</text>
              <text x={tooltipX + 12} y={tooltipY + 34}>
                제조원가
                <tspan className="cost-trend__tooltip-value" x={tooltipX + TOOLTIP_W - 12} textAnchor="end">
                  {won(active.manufacturingCost)}
                </tspan>
              </text>
              <text x={tooltipX + 12} y={tooltipY + 51}>
                경영 총원가
                <tspan className="cost-trend__tooltip-value" x={tooltipX + TOOLTIP_W - 12} textAnchor="end">
                  {won(active.managementTotalCost)}
                </tspan>
              </text>
            </g>
          )}
        </svg>
      </div>
    </section>
  )
}
