import { useState } from 'react'
import { costChartBounds as chart, getCostTrend, type CostPeriod } from './costTrendData'

type CostKey = 'managementTotalCost' | 'manufacturingCost'

export function MonthlyCostChart() {
  const [period, setPeriod] = useState<CostPeriod>('monthly')
  const data = getCostTrend(period)
  const rawMaximum = Math.max(...data.flatMap((item) => [item.managementTotalCost, item.manufacturingCost]))
  const tickUnit = period === 'monthly' ? 20 : 200
  const maximumCost = Math.ceil(rawMaximum / tickUnit) * tickUnit
  const plotHeight = chart.bottom - chart.top
  const plotWidth = chart.right - chart.left
  const getX = (index: number) => chart.left + (index / (data.length - 1)) * plotWidth
  const getY = (value: number) => chart.top + ((maximumCost - value) / maximumCost) * plotHeight
  const getPoints = (key: CostKey) => data.map((item, index) => `${getX(index)},${getY(item[key])}`).join(' ')
  const yTicks = Array.from({ length: 5 }, (_, index) => maximumCost - (maximumCost / 4) * index)
  const lastPoint = data.at(-1)!

  return (
    <section className="card cost-chart-card" aria-labelledby="cost-chart-title">
      <div className="card-heading chart-heading">
        <div><h2 id="cost-chart-title">{period === 'monthly' ? '월별' : '연간'} 원가 추이</h2><p>단위: 백만원</p></div>
        <div className="chart-period-toggle" aria-label="조회 기간">
          <button className={period === 'monthly' ? 'is-active' : ''} type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>월별</button>
          <button className={period === 'annual' ? 'is-active' : ''} type="button" aria-pressed={period === 'annual'} onClick={() => setPeriod('annual')}>연간</button>
        </div>
      </div>

      <div className="cost-line-chart">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${period === 'monthly' ? '월별' : '연간'} 경영 총원가와 제조원가 꺾은선 차트`}>
          <desc>{data.map((item) => `${item.label}: 경영 총원가 ${item.managementTotalCost}백만원, 제조원가 ${item.manufacturingCost}백만원`).join('. ')}</desc>
          {yTicks.map((tick) => {
            const y = getY(tick)
            return <g key={tick}><line className="cost-line-chart__grid" x1={chart.left} x2={chart.right} y1={y} y2={y} /><text className="cost-line-chart__axis" x={chart.left - 10} y={y + 4} textAnchor="end">{tick.toLocaleString('ko-KR')}</text></g>
          })}
          {data.map((item, index) => <text className="cost-line-chart__axis" x={getX(index)} y={chart.bottom + 25} textAnchor="middle" key={item.label}>{item.label}</text>)}
          <polyline className="cost-line-chart__line cost-line-chart__line--management" points={getPoints('managementTotalCost')} />
          <polyline className="cost-line-chart__line cost-line-chart__line--manufacturing" points={getPoints('manufacturingCost')} />
          {data.map((item, index) => (
            <g key={`${item.label}-points`}>
              <circle className="cost-line-chart__point cost-line-chart__point--management" cx={getX(index)} cy={getY(item.managementTotalCost)} r="4"><title>{`${item.label} 경영 총원가 ${item.managementTotalCost.toLocaleString('ko-KR')}백만원`}</title></circle>
              <circle className="cost-line-chart__point cost-line-chart__point--manufacturing" cx={getX(index)} cy={getY(item.manufacturingCost)} r="4"><title>{`${item.label} 제조원가 ${item.manufacturingCost.toLocaleString('ko-KR')}백만원`}</title></circle>
            </g>
          ))}
          <text className="cost-line-chart__direct-label cost-line-chart__direct-label--management" x={chart.right + 13} y={getY(lastPoint.managementTotalCost) - 3}><tspan x={chart.right + 13}>경영 총원가</tspan><tspan className="cost-line-chart__direct-value" x={chart.right + 13} dy="15">{lastPoint.managementTotalCost.toLocaleString('ko-KR')}</tspan></text>
          <text className="cost-line-chart__direct-label cost-line-chart__direct-label--manufacturing" x={chart.right + 13} y={getY(lastPoint.manufacturingCost) - 3}><tspan x={chart.right + 13}>제조원가</tspan><tspan className="cost-line-chart__direct-value" x={chart.right + 13} dy="15">{lastPoint.manufacturingCost.toLocaleString('ko-KR')}</tspan></text>
        </svg>
      </div>
    </section>
  )
}
