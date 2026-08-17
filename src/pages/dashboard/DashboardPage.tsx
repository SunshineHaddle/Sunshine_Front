import { useEffect, useRef, useState } from 'react'
import { DashboardHeader } from '../../components/dashboard/DashboardChrome'
import { ProductCostTrendCarousel } from '../../components/dashboard/DashboardSummaryCharts'
import { ProductProfitabilityTable } from '../../components/dashboard/ProductProfitabilityTable'
import { Sidebar } from '../../components/layout/Sidebar'
import type { ProductProfitabilityItem } from './dashboardData'
import type { AppRoute } from '../../data/navigation'
import type { RecipeProduct } from '../product-management/productManagementData'
import { fetchPeriodByMonth } from '../../lib/api/periods'
import {
  fetchCostSummaries,
  fetchCostTrend,
  type CostSummary,
  type CostTrendPoint,
} from '../../lib/api/results'
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
  // 수익성 현황은 "가장 최근 확정된 달"이 아니라 오늘 날짜가 속한 달을 본다.
  // 렌더마다 new Date() 를 부르면 이펙트가 매번 다시 돈다 — 마운트 시 한 번만 고정한다.
  const [today] = useState(() => new Date())
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const currentMonthLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월`

  const [items, setItems] = useState<ProductProfitabilityItem[]>([])
  const [trend, setTrend] = useState<CostTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // §9-1 : 최근 12개월 원가 추이
      const from = new Date(today)
      from.setMonth(from.getMonth() - 11)
      fetchCostTrend(`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`)
        .then((rows) => { if (!cancelled) setTrend(rows) })
        .catch(() => { if (!cancelled) setTrend([]) })

      try {
        // §8-2 : 이번 달 수익성 스냅샷
        const period = await fetchPeriodByMonth(currentMonth)
        if (cancelled) return
        if (!period) {
          setItems([])
          return
        }
        const summaries = await fetchCostSummaries(period.id)
        if (cancelled) return
        setItems(summaries.map(toTableItem))
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [currentMonth, today])

  /**
   * §대시보드 PDF 저장.
   * 캐러셀은 평소 제품 하나만 보여주므로, 내보내는 동안에는 전 제품을 펼친다.
   * html2canvas 는 그 시점의 DOM 만 그리기 때문에 레이아웃이 반영될 때까지 두 프레임 기다린다.
   */
  const handleExportPdf = async () => {
    if (!contentRef.current || isExportingPdf) return
    setIsExportingPdf(true)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      if (!contentRef.current) return

      const today = new Date()
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      await exportElementToPdf(contentRef.current, {
        fileName: `경영진_대시보드_${stamp}.pdf`,
      })
      onAction(`대시보드를 PDF로 저장했습니다. 제품 ${recipeProducts.length}개 그래프 포함.`)
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
            <ProductCostTrendCarousel
              products={recipeProducts}
              onOpen={onSelectRecipe}
              expandAll={isExportingPdf}
            />
          </div>

          <CostTrendChart points={trend} />

          {loading ? (
            <p className="dashboard-placeholder" role="status">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="dashboard-placeholder" role="status">
              {currentMonthLabel} 원가가 아직 계산되지 않았습니다.
              데이터 입력 3단계에서 <strong>원가 계산</strong>을 실행하면 여기에 표시됩니다.
            </p>
          ) : (
            <ProductProfitabilityTable items={items} periodLabel={currentMonthLabel} />
          )}
        </main>
      </div>
    </div>
  )
}
