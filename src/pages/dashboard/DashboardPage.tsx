import { useState } from 'react'
import { DashboardHeader } from './DashboardHeader'
import { ExchangeRateCard } from './ExchangeRateCard'
import { MonthlyCostChart } from './MonthlyCostChart'
import { ProcessVarianceTable } from './ProcessVarianceTable'
import { DashboardTopBar } from './DashboardTopBar'
import { Sidebar } from '../../components/layout/Sidebar'
import { processes } from './dashboardData'
import type { AppRoute } from '../../data/navigation'

type DashboardPageProps = {
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
}

const periods = ['이번 분기', '지난 분기', '연간']

export function DashboardPage({ onNavigate, onAction }: DashboardPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [periodIndex, setPeriodIndex] = useState(0)

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredProcesses = processes.filter((item) => {
    const matchesStatus = !attentionOnly || item.status === '주의'
    const matchesSearch =
      !normalizedQuery ||
      [item.id, item.process, item.owner].some((value) =>
        value.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
      )

    return matchesStatus && matchesSearch
  })

  const downloadReport = () => {
    const report = [
      'Cost Analysis System Report',
      '',
      '공정별 변동률:',
      ...processes.map(
        (item) =>
          `${item.id} | ${item.process} | ${item.actualCost} | ${item.variance} | ${item.status}`,
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

  return (
    <div className="dashboard-app">
      <Sidebar activeRoute="dashboard" onNavigate={onNavigate} />

      <div className="main-shell">
        <DashboardTopBar searchQuery={searchQuery} onSearch={setSearchQuery} />

        <main className="dashboard-content">
          <DashboardHeader
            period={periods[periodIndex]}
            onChangePeriod={() =>
              setPeriodIndex((current) => (current + 1) % periods.length)
            }
            onDownload={downloadReport}
          />

          <div className="summary-grid">
            <MonthlyCostChart />
            <ExchangeRateCard />
          </div>

          <ProcessVarianceTable
            items={filteredProcesses}
            attentionOnly={attentionOnly}
            onToggleFilter={() => setAttentionOnly((current) => !current)}
            onViewAll={() => {
              setAttentionOnly(false)
              setSearchQuery('')
              onAction('전체 공정 목록을 표시합니다.')
            }}
          />
        </main>
      </div>
    </div>
  )
}
