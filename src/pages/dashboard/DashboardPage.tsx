import { useState } from 'react'
import { DashboardHeader } from '../../components/dashboard/DashboardChrome'
import { MonthlyCostChart } from '../../components/dashboard/CostTrendChart'
import { ExchangeRateCard } from '../../components/dashboard/DashboardSummaryCharts'
import { ProductProfitabilityTable } from '../../components/dashboard/ProductProfitabilityTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { products } from './dashboardData'
import type { AppRoute } from '../../data/navigation'
import { InsightSummaryCards } from '../../components/dashboard/InsightSummaryCards'

type DashboardPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

export function DashboardPage({ onNavigate, onAction }: DashboardPageProps) {
  const [attentionOnly, setAttentionOnly] = useState(false)

  const filteredProducts = products.filter((item) => !attentionOnly || item.status !== 'normal')

  const downloadReport = () => {
    const report = [
      'Cost Analysis System Report',
      '',
      '제품별 수익성 현황:',
      ...products.map(
        (item) =>
          `${item.id} | ${item.name} | ₩${item.salePrice.toLocaleString('ko-KR')} | ${item.marginRate.toFixed(1)}% | ${item.status}`,
      ),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cost-analysis-report.txt'
    link.click()
    URL.revokeObjectURL(url)
    onAction('보고서를 다운로드했습니다.')
  }

  const exportProfitabilityData = () => {
    const header = [
      '제품 ID',
      '제품명',
      '규격',
      '생산량',
      '제조원가',
      '경영 총원가',
      '판매가',
      '마진율',
      '수율',
      '불량률',
      '상태',
    ]
    const rows = filteredProducts.map((item) => [
      item.id,
      `${item.name}${item.variant ? ` (${item.variant})` : ''}`,
      `${item.specification}/${item.packageUnit}`,
      item.productionQuantity,
      item.manufacturingCost,
      item.totalCost,
      item.salePrice,
      item.marginRate,
      item.yieldRate,
      item.defectRate,
      item.status,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-profitability.csv'
    link.click()
    URL.revokeObjectURL(url)
    onAction('제품별 수익성 데이터를 내보냈습니다.')
  }

  return (
    <div className="dashboard-app">
      <Sidebar activeRoute="dashboard" onNavigate={onNavigate} />

      <div className="main-shell">
        <main className="dashboard-content">
          <DashboardHeader onDownload={downloadReport} />

          <div className="summary-grid">
            <MonthlyCostChart />
            <ExchangeRateCard />
          </div>

          <InsightSummaryCards onNavigate={onNavigate} />

          <ProductProfitabilityTable
            items={filteredProducts}
            attentionOnly={attentionOnly}
            onToggleFilter={() => setAttentionOnly((current) => !current)}
            onExport={exportProfitabilityData}
          />
        </main>
      </div>
    </div>
  )
}
