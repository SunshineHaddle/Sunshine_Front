import { Icon } from '../common/Icon'
import type { AppRoute } from '../../data/navigation'
import {
  dashboardInsights,
  type DashboardInsight,
} from '../../pages/dashboard/dashboardData'

type InsightSummaryCardsProps = {
  onNavigate: (route: AppRoute) => void
}

function Sparkline({ insight }: { insight: DashboardInsight }) {
  const points = insight.chartPoints
    .map((value, index) => `${(index / (insight.chartPoints.length - 1)) * 100},${value}`)
    .join(' ')

  return (
    <svg
      className="insight-card__sparkline"
      role="img"
      aria-label={insight.chartLabel}
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
    >
      <path className="insight-card__grid" d="M0 39H100" />
      <polyline className="insight-card__line" points={points} />
      <circle
        className="insight-card__point"
        cx="100"
        cy={insight.chartPoints.at(-1)}
        r="2.5"
      />
    </svg>
  )
}

export function InsightSummaryCards({ onNavigate }: InsightSummaryCardsProps) {
  return (
    <section className="insight-section" aria-labelledby="insight-section-title">
      <div className="insight-section__heading">
        <div>
          <h2 id="insight-section-title">핵심 지표</h2>
          <p>환율, 제조 원가, 품질 변화를 빠르게 확인하세요.</p>
        </div>
        <span>최근 업데이트 14:30</span>
      </div>

      <div className="insight-grid">
        {dashboardInsights.map((insight) => (
          <article
            className={`card insight-card insight-card--${insight.tone}`}
            key={insight.id}
          >
            <div className="insight-card__topline">
              <span className="insight-card__icon"><Icon name={insight.icon} size={19} /></span>
              <button type="button" onClick={() => onNavigate(insight.route)}>
                상세페이지 <Icon name="chevron-right" size={14} />
              </button>
            </div>

            <div className="insight-card__copy">
              <h3>{insight.title}</h3>
              <p>{insight.description}</p>
            </div>

            <div className="insight-card__metric">
              <strong>{insight.value}</strong>
              <span>{insight.unit}</span>
            </div>

            <Sparkline insight={insight} />

            <p className="insight-card__change">
              <strong>{insight.change}</strong>
              <span>{insight.changeLabel}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
