import {
  formatProductionWon,
  type ProductionCostSummary,
} from './productionResultModel'

type CostCompositionChartProps = {
  summary: ProductionCostSummary
}

const radius = 58
const circumference = 2 * Math.PI * radius

export function CostCompositionChart({ summary }: CostCompositionChartProps) {
  const segments = [
    { label: '원재료비', value: summary.materialCost, color: '#ba0036' },
    { label: '인건비', value: summary.laborCost, color: '#3e5c76' },
    { label: '공과금', value: summary.utilityCost, color: '#b7791f' },
    { label: '기타 간접비', value: summary.indirectCost, color: '#5b7566' },
  ]
  const total = summary.totalCost
  let accumulatedLength = 0

  return (
    <article className="cost-composition" aria-labelledby="cost-composition-title">
      <div className="cost-composition__heading">
        <span id="cost-composition-title">원가 구성</span>
        <strong>{formatProductionWon(total)}</strong>
      </div>

      <div className="cost-composition__body">
        <svg viewBox="0 0 160 160" role="img" aria-label="항목별 원가 구성 도넛 차트">
          <circle className="cost-donut__track" cx="80" cy="80" r={radius} />
          {total > 0 && segments.map((segment) => {
            const segmentLength = (segment.value / total) * circumference
            const offset = accumulatedLength
            accumulatedLength += segmentLength

            return segment.value > 0 ? (
              <circle
                className="cost-donut__segment"
                cx="80"
                cy="80"
                key={segment.label}
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
              >
                <title>{`${segment.label} ${formatProductionWon(segment.value)}`}</title>
              </circle>
            ) : null
          })}
        </svg>

        <ul className="cost-composition__legend">
          {segments.map((segment) => {
            const percentage = total > 0 ? (segment.value / total) * 100 : 0
            return (
              <li key={segment.label}>
                <i style={{ backgroundColor: segment.color }} />
                <span><strong>{segment.label}</strong><small>{formatProductionWon(segment.value)}</small></span>
                <b>{percentage.toFixed(1)}%</b>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}
