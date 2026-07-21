import type { CSSProperties } from 'react'

type MonthlyCost = {
  month: string
  target: number
  actual: number
}

const monthlyCosts: MonthlyCost[] = []

export function MonthlyCostChart() {
  return (
    <section className="card cost-chart-card" aria-labelledby="cost-chart-title">
      <div className="card-heading chart-heading">
        <div>
          <h2 id="cost-chart-title">월별 제조 원가 추이</h2>
          <p>단위: 백만원</p>
        </div>
        <div className="chart-legend" aria-label="차트 범례">
          <span><i className="legend-dot legend-dot--target" />목표</span>
          <span><i className="legend-dot legend-dot--actual" />실적</span>
        </div>
      </div>

      {monthlyCosts.length === 0 ? (
        <p className="empty-chart">표시할 원가 데이터가 없습니다.</p>
      ) : (
        <div className="bar-chart" role="img" aria-label="월별 목표와 실적 제조 원가 막대 차트">
          {monthlyCosts.map((item) => (
            <div className="bar-group" key={item.month}>
              <div className="bar-group__bars">
                <span
                  className="bar bar--target"
                  style={{ '--bar-height': `${item.target}%` } as CSSProperties}
                  title={`${item.month} 목표 ${item.target}`}
                />
                <span
                  className="bar bar--actual"
                  style={{ '--bar-height': `${item.actual}%` } as CSSProperties}
                  title={`${item.month} 실적 ${item.actual}`}
                />
              </div>
              <span>{item.month}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
