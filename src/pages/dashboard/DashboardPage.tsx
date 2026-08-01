import { useState } from 'react'
import { DashboardHeader } from '../../components/dashboard/DashboardChrome'
import { MonthlyCostChart } from '../../components/dashboard/CostTrendChart'
import { FinalCostSummaryCard } from '../../components/dashboard/DashboardSummaryCharts'
import { ProductProfitabilityTable } from '../../components/dashboard/ProductProfitabilityTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { dashboardInsights, products } from './dashboardData'
import type { AppRoute } from '../../data/navigation'
import { InsightSummaryCards } from '../../components/dashboard/InsightSummaryCards'
import { Icon } from '../../components/common/Icon'
import { getCostTrend } from '../../components/dashboard/costTrendData'
import type { RecipeProduct } from '../product-management/productManagementData'
import { loadProductionCostSummary } from '../production-result/productionResultModel'

type DashboardPageProps = {
  isWorker?: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  recipeProducts: RecipeProduct[]
  onSelectRecipe: (productId: string) => void
}

export function DashboardPage({ isWorker = false, onNavigate, onAction, recipeProducts, onSelectRecipe }: DashboardPageProps) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [costSummary] = useState(loadProductionCostSummary)
  const [reportStartMonth, setReportStartMonth] = useState('2026-01')
  const [reportEndMonth, setReportEndMonth] = useState('2026-06')
  const [includeTrend, setIncludeTrend] = useState(true)
  const [includeKeyMetrics, setIncludeKeyMetrics] = useState(true)
  const [includeProfitability, setIncludeProfitability] = useState(false)

  const filteredProducts = products.filter((item) => !attentionOnly || item.status !== 'normal')
  const attentionProducts = products.filter((item) => item.status !== 'normal')
  const lossProducts = products.filter((item) => item.totalCost > item.salePrice)
  const highestDefectProduct = products.reduce((highest, item) => item.defectRate > highest.defectRate ? item : highest)
  const canGenerateReport = reportStartMonth <= reportEndMonth
    && (includeTrend || includeKeyMetrics || includeProfitability)

  const printReport = () => {
    window.print()
    onAction('인쇄 창에서 PDF로 저장할 수 있습니다.')
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
    <div className={`dashboard-app${isWorker ? ' dashboard-app--worker' : ''}`}>
      <Sidebar activeRoute="dashboard" hidden={isWorker} onNavigate={onNavigate} />

      <div className="main-shell">
        <main className="dashboard-content">
          <DashboardHeader />

          <div className="summary-grid">
            <MonthlyCostChart />
            <FinalCostSummaryCard summary={costSummary} onOpen={() => onNavigate('data-entry-3')} />
          </div>

          <InsightSummaryCards
            products={recipeProducts}
            onNavigate={onNavigate}
            onSelectProduct={onSelectRecipe}
          />

          <ProductProfitabilityTable
            items={filteredProducts}
            attentionOnly={attentionOnly}
            onToggleFilter={() => setAttentionOnly((current) => !current)}
            onExport={exportProfitabilityData}
          />

          <section className="card dashboard-ai-summary" aria-labelledby="dashboard-ai-summary-title">
            <header>
              <div className="dashboard-ai-summary__title">
                <div>
                  <small>AI 종합 요약</small>
                  <h2 id="dashboard-ai-summary-title">현재 운영 상황</h2>
                </div>
              </div>
            </header>

            <div className="dashboard-ai-summary__topics">
              <article><span>01</span><div><h3>전체 현황</h3><p>전체 {products.length}개 품목 중 {attentionProducts.length}개가 관리 대상이고, {lossProducts.length}개 품목에서 손실이 발생하고 있습니다.</p></div></article>
              <article><span>02</span><div><h3>손실 품목</h3><p>{lossProducts.map((item) => `${item.name}(${item.marginRate.toFixed(1)}%)`).join(', ')}는 경영 총원가가 판매가를 초과합니다.</p></div></article>
              <article><span>03</span><div><h3>품질 위험</h3><p>{highestDefectProduct.name}의 불량률이 {highestDefectProduct.defectRate.toFixed(1)}%로 가장 높아 생산 공정 점검이 필요합니다.</p></div></article>
              <article><span>04</span><div><h3>개선 우선순위</h3><p>{lossProducts.map((item) => item.name).join(', ')}는 손실이 발생하고 있습니다. 해당 품목의 원가 구조와 판매가를 먼저 조정하고, {highestDefectProduct.name}의 생산 공정을 함께 점검하세요.</p></div></article>
            </div>
          </section>

          <section className="dashboard-report" aria-labelledby="dashboard-report-title" hidden={isWorker}>
            <div className="dashboard-report__controls">
              <h2 id="dashboard-report-title">보고서 추출</h2>

              <div className="dashboard-report__settings">
                <div className="dashboard-report__period">
                  <h3>기간 선택</h3>
                  <div>
                    <label>
                      <span>시작 월</span>
                      <input
                        max={reportEndMonth}
                        type="month"
                        value={reportStartMonth}
                        onChange={(event) => setReportStartMonth(event.target.value)}
                      />
                    </label>
                    <span aria-hidden="true">–</span>
                    <label>
                      <span>종료 월</span>
                      <input
                        min={reportStartMonth}
                        type="month"
                        value={reportEndMonth}
                        onChange={(event) => setReportEndMonth(event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <fieldset>
                  <legend>추가 포함 항목</legend>
                  <div className="dashboard-report__options">
                    <label><input type="checkbox" checked={includeTrend} onChange={(event) => setIncludeTrend(event.target.checked)} />월별 추이 그래프</label>
                    <label><input type="checkbox" checked={includeKeyMetrics} onChange={(event) => setIncludeKeyMetrics(event.target.checked)} />핵심 지표</label>
                    <label><input type="checkbox" checked={includeProfitability} onChange={(event) => setIncludeProfitability(event.target.checked)} />제품별 수익성 현황</label>
                  </div>
                </fieldset>
              </div>

              <div className="dashboard-report__actions">
                <button
                  className="dashboard-report__preview-button"
                  type="button"
                  disabled={!canGenerateReport}
                  onClick={() => onAction('선택한 항목으로 보고서 미리보기를 준비했습니다.')}
                >
                  미리보기
                </button>
                <button
                  className="dashboard-report__download-button"
                  type="button"
                  disabled={!canGenerateReport}
                  onClick={printReport}
                >
                  <Icon name="download" size={18} /> PDF 다운로드하기
                </button>
              </div>
            </div>

            <div className="dashboard-report__print-content">
              <header><h1>원가 분석 보고서</h1><p>{reportStartMonth} – {reportEndMonth}</p></header>
              {includeTrend && (
                <section>
                  <h2>월별 원가 추이</h2>
                  <table><thead><tr><th>기간</th><th>경영 총원가</th><th>제조원가</th></tr></thead><tbody>
                    {getCostTrend('monthly').map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.managementTotalCost}백만원</td><td>{item.manufacturingCost}백만원</td></tr>)}
                  </tbody></table>
                </section>
              )}
              {includeKeyMetrics && (
                <section>
                  <h2>핵심 지표</h2>
                  <table><thead><tr><th>지표</th><th>현재 값</th><th>변화</th></tr></thead><tbody>
                    {dashboardInsights.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.value}{item.unit}</td><td>{item.change}</td></tr>)}
                  </tbody></table>
                </section>
              )}
              {includeProfitability && (
                <section>
                  <h2>제품별 수익성 현황</h2>
                  <table><thead><tr><th>제품</th><th>제조원가</th><th>경영 총원가</th><th>판매가</th><th>마진율</th></tr></thead><tbody>
                    {products.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.manufacturingCost.toLocaleString('ko-KR')}원</td><td>{item.totalCost.toLocaleString('ko-KR')}원</td><td>{item.salePrice.toLocaleString('ko-KR')}원</td><td>{item.marginRate}%</td></tr>)}
                  </tbody></table>
                </section>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
