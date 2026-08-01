import { useEffect, useRef, useState } from 'react'
import { Chart, type Plugin } from 'chart.js/auto'
import { getCostTrend, type CostPeriod } from './costTrendData'

const colors = ['#c7003d', '#625d5d'] as const

const directLabels: Plugin<'line'> = {
  id: 'cost-direct-labels',
  afterDatasetsDraw(chart) {
    chart.data.datasets.forEach((dataset, index) => {
      const point = chart.getDatasetMeta(index).data.at(-1)
      const value = dataset.data.at(-1)
      if (!point || value == null) return

      const { ctx } = chart
      ctx.save()
      ctx.fillStyle = colors[index] ?? colors[0]
      ctx.textBaseline = 'middle'
      ctx.font = '600 11px Pretendard, sans-serif'
      ctx.fillText(dataset.label ?? '', point.x + 14, point.y - 7)
      ctx.font = '700 12px Pretendard, sans-serif'
      ctx.fillText(Number(value).toLocaleString('ko-KR'), point.x + 14, point.y + 10)
      ctx.restore()
    })
  },
}

export function MonthlyCostChart() {
  const [period, setPeriod] = useState<CostPeriod>('monthly')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const data = getCostTrend(period)

  useEffect(() => {
    if (!canvasRef.current) return

    const rawMaximum = Math.max(...data.flatMap((item) => [item.managementTotalCost, item.manufacturingCost]))
    const tickUnit = period === 'monthly' ? 20 : 200
    const maximumCost = Math.ceil(rawMaximum / tickUnit) * tickUnit
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.map((item) => item.label),
        datasets: [
          {
            label: '경영 총원가',
            data: data.map((item) => item.managementTotalCost),
            borderColor: colors[0],
            backgroundColor: colors[0],
          },
          {
            label: '제조원가',
            data: data.map((item) => item.manufacturingCost),
            borderColor: colors[1],
            backgroundColor: colors[1],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 18, right: 78, bottom: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ({ dataset, raw }) => `${dataset.label}: ${Number(raw).toLocaleString('ko-KR')}백만원`,
            },
          },
        },
        scales: {
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: '#888181', padding: 10, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            max: maximumCost,
            border: { display: false },
            grid: { color: '#e8e5e5' },
            ticks: { color: '#888181', padding: 12, stepSize: maximumCost / 4, font: { size: 11 } },
          },
        },
        elements: {
          line: { borderWidth: 3, tension: 0 },
          point: { radius: 4, hoverRadius: 6, borderColor: '#fff', borderWidth: 2 },
        },
      },
      plugins: [directLabels],
    })

    return () => chart.destroy()
  }, [data, period])

  return (
    <section className="card cost-chart-section cost-chart-card" aria-labelledby="cost-chart-title">
      <div className="card-heading chart-heading cost-chart-section__heading">
        <h2 id="cost-chart-title">{period === 'monthly' ? '월별' : '연간'} 원가 추이</h2>
        <div className="chart-period-toggle" aria-label="조회 기간">
          <button className={period === 'monthly' ? 'is-active' : ''} type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>월별</button>
          <button className={period === 'annual' ? 'is-active' : ''} type="button" aria-pressed={period === 'annual'} onClick={() => setPeriod('annual')}>연간</button>
        </div>
      </div>

      <p className="cost-chart-card__unit">단위: 백만원</p>
      <div className="cost-line-chart">
        <canvas ref={canvasRef} role="img" aria-label={`${period === 'monthly' ? '월별' : '연간'} 경영 총원가와 제조원가 추이 차트`} />
      </div>
    </section>
  )
}
