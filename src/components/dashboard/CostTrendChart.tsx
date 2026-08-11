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

const compact = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export function CostTrendChart({ points }: CostTrendChartProps) {
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
              <g key={i}>
                <line className="cost-trend__grid" x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} />
                <text className="cost-trend__y-label" x={PAD_L - 8} y={y + 3} textAnchor="end">
                  {compact.format(value)}
                </text>
              </g>
            )
          })}

          {points.map((point, index) => {
            const cx = PAD_L + step * index + step / 2
            return (
              <g key={point.period}>
                <rect
                  className="cost-trend__bar is-manufacturing"
                  x={cx - barW - 2}
                  y={yFor(point.manufacturingCost)}
                  width={barW}
                  height={PAD_T + plotH - yFor(point.manufacturingCost)}
                >
                  <title>{`${point.label} 제조원가 ${won(point.manufacturingCost)}`}</title>
                </rect>
                <rect
                  className="cost-trend__bar is-total"
                  x={cx + 2}
                  y={yFor(point.managementTotalCost)}
                  width={barW}
                  height={PAD_T + plotH - yFor(point.managementTotalCost)}
                >
                  <title>{`${point.label} 경영 총원가 ${won(point.managementTotalCost)}`}</title>
                </rect>
                <text className="cost-trend__x-label" x={cx} y={VIEW_H - 10} textAnchor="middle">
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
