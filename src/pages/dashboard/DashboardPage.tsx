import { useEffect, useRef, useState } from 'react'
import { DashboardHeader } from '../../components/dashboard/DashboardChrome'
import { ProductCostTrendCarousel } from '../../components/dashboard/DashboardSummaryCharts'
import { ProductProfitabilityTable } from '../../components/dashboard/ProductProfitabilityTable'
import { Sidebar } from '../../components/layout/Sidebar'
import type { ProductProfitabilityItem } from './dashboardData'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { fetchLatestConfirmedPeriod } from '../../lib/api/periods'
import {
  fetchCostSummaries,
  fetchCostTrend,
  type CostSummary,
  type CostTrendPoint,
} from '../../lib/api/results'
import { toMonth } from '../../lib/types'
import { CostTrendChart } from '../../components/dashboard/CostTrendChart'
import { exportElementToPdf } from '../../lib/pdf/exportElementToPdf'

type DashboardPageProps = {
  isWorker?: boolean
  onNavigate: (route: AppRoute) => void
  onAction: (message: string) => void
  recipeProducts: RecipeProduct[]
  onSelectRecipe: (productId: string) => void
}

/**
 * 확정 스냅샷 → 표 항목.
 * unit_cost 는 포장 1개당 총원가다. 제조원가도 같은 단위로 맞춰야
 * 판매가와 나란히 비교된다.
 */
function toTableItem(summary: CostSummary): ProductProfitabilityItem {
  const manufacturingShare =
    summary.totalCost > 0 ? summary.manufacturingCost / summary.totalCost : 0

  return {
    id: summary.productId,
    name: summary.name,
    variant: summary.variant,
    specification: summary.specification ?? '-',
    packageUnit: summary.packageUnit ?? 'PCK',
    productionQuantity: summary.productionQty,
    manufacturingCost: Math.round(summary.unitCost * manufacturingShare),
    totalCost: Math.round(summary.unitCost),
    salePrice: summary.salePrice,
    marginRate: summary.marginRate,
    status: summary.status,
  }
}

export function DashboardPage({
  isWorker = false,
  onNavigate,
  onAction,
  recipeProducts,
  onSelectRecipe,
}: DashboardPageProps) {
  const [items, setItems] = useState<ProductProfitabilityItem[]>([])
  const [periodLabel, setPeriodLabel] = useState('')
  const [trend, setTrend] = useState<CostTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // §9-1 : 최근 12개월 원가 추이
      const from = new Date()
      from.setMonth(from.getMonth() - 11)
      fetchCostTrend(`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`)
        .then((rows) => { if (!cancelled) setTrend(rows) })
        .catch(() => { if (!cancelled) setTrend([]) })

      try {
        // §8-2 : 최신 확정월의 수익성 스냅샷
        const period = await fetchLatestConfirmedPeriod()
        if (cancelled) return
        if (!period) {
          setItems([])
          setPeriodLabel('')
          return
        }
        const summaries = await fetchCostSummaries(period.id)
        if (cancelled) return
        setItems(summaries.map(toTableItem))
        setPeriodLabel(toMonth(period.period).replace('-', '년 ') + '월')
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // §대시보드 PDF 저장 : 현재 화면에 보이는 카드·표를 그대로 캡처해 A4 PDF로 내려받는다
  const handleExportPdf = async () => {
    if (!contentRef.current || isExportingPdf) return
    setIsExportingPdf(true)
    try {
      const today = new Date()
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      await exportElementToPdf(contentRef.current, {
        fileName: `경영진_대시보드_${stamp}.pdf`,
      })
      onAction('대시보드를 PDF로 저장했습니다.')
    } catch (error) {
      onAction(`PDF 저장 실패: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className={`dashboard-app${isWorker ? ' dashboard-app--worker' : ''}`}>
      <Sidebar activeRoute="dashboard" hidden={isWorker} onNavigate={onNavigate} />

      <div className="main-shell">
        <main className="dashboard-content" ref={contentRef}>
          <DashboardHeader onExportPdf={() => void handleExportPdf()} isExportingPdf={isExportingPdf} />

          <div className="summary-grid">
            <ProductCostTrendCarousel products={recipeProducts} onOpen={onSelectRecipe} />
          </div>

          <CostTrendChart points={trend} />

          {loading ? (
            <p className="dashboard-placeholder" role="status">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="dashboard-placeholder" role="status">
              아직 마감된 달이 없습니다. 데이터 입력 3단계에서 <strong>원가 계산</strong>을 실행하면 여기에 표시됩니다.
            </p>
          ) : (
            <ProductProfitabilityTable items={items} periodLabel={periodLabel} />
          )}
        </main>
      </div>
    </div>
  )
}
