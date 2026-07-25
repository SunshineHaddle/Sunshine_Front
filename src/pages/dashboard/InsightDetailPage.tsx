import { Icon } from '../../components/common/Icon'
import { Sidebar } from '../../components/layout/Sidebar'
import type { AppRoute } from '../../data/navigation'
import { dashboardInsightByRoute, type DashboardInsight } from './dashboardData'

type InsightRoute = DashboardInsight['route']

type InsightDetailPageProps = {
  route: InsightRoute
  onNavigate: (route: AppRoute) => void
}

export function InsightDetailPage({ route, onNavigate }: InsightDetailPageProps) {
  const insight = dashboardInsightByRoute[route]

  return (
    <div className="dashboard-app">
      <Sidebar activeRoute={route} onNavigate={onNavigate} />

      <div className="main-shell">
        <main className="dashboard-content insight-detail-page">
          <button
            className="insight-detail-page__back"
            type="button"
            onClick={() => onNavigate('dashboard')}
          >
            <Icon name="chevron-left" size={16} /> 대시보드로 돌아가기
          </button>

          <header className="insight-detail-page__header">
            <span className={`insight-card__icon insight-card__icon--${insight.tone}`}>
              <Icon name={insight.icon} size={22} />
            </span>
            <div>
              <p>핵심 지표 상세</p>
              <h1>{insight.title}</h1>
              <span>{insight.description}</span>
            </div>
          </header>

          <section className="card insight-detail-placeholder" aria-labelledby="detail-ready-title">
            <div className="insight-detail-placeholder__metric">
              <span>현재 지표</span>
              <strong>{insight.value} <small>{insight.unit}</small></strong>
            </div>
            <div>
              <h2 id="detail-ready-title">각 페이지로 이동.</h2>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
