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
  fetchUnitCostTrendAll,
  type CostSummary,
  type CostTrendPoint,
  type UnitCostPoint,
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
 *
 * 원가는 1kg 기준으로 보여준다. 월 전체 금액(수억)은 제품끼리 규모만 다를 뿐
 * 어느 쪽이 비싼지 알 수 없고, 포장 단위로만 보면 5kg 과 1kg 제품이 섞여 비교가 안 된다.
 * 판매가와 잇는 값은 unitCost(포장 1개당)다.
 */
function toTableItem(summary: CostSummary): ProductProfitabilityItem {
  return {
    id: summary.productId,
    name: summary.name,
    variant: summary.variant,
    specification: summary.specification ?? '-',
    packageUnit: summary.packageUnit ?? 'PCK',
    productionQuantity: summary.productionQty,
    manufacturingCost: Math.round(summary.manufacturingCostPerKg),
    totalCost: Math.round(summary.totalCostPerKg),
    unitCost: Math.round(summary.unitCost),
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
  // 수익성 현황은 오늘이 속한 달을 기본으로 열고, 표에서 다른 월을 선택할 수 있다.
  const [today] = useState(() => new Date())
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [profitabilityMonth, setProfitabilityMonth] = useState(currentMonth)
  const [profitabilityYear, profitabilityMonthNumber] = profitabilityMonth.split('-')
  const profitabilityMonthLabel = `${profitabilityYear}년 ${Number(profitabilityMonthNumber)}월`

  const [items, setItems] = useState<ProductProfitabilityItem[]>([])
  const [trend, setTrend] = useState<CostTrendPoint[]>([])
  /** §9-2 : 제품별 확정 단가 추이. 캐러셀 그래프가 실제 값을 그리는 데 쓴다 */
  const [costTrends, setCostTrends] = useState<Record<string, UnitCostPoint[]>>({})
  const [loading, setLoading] = useState(true)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const contentRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setItems([])
      // §9-1 : 최근 12개월 원가 추이
      const from = new Date(today)
      from.setMonth(from.getMonth() - 11)
      const fromPeriod = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`
      fetchCostTrend(fromPeriod)
        .then((rows) => { if (!cancelled) setTrend(rows) })
        .catch(() => { if (!cancelled) setTrend([]) })

      // §9-2 : 제품별 단가 추이. 실패해도 캐러셀은 참고용 곡선으로 계속 그려진다
      fetchUnitCostTrendAll(fromPeriod)
        .then((rows) => { if (!cancelled) setCostTrends(rows) })
        .catch((error: unknown) => {
          // 조용히 삼키면 그래프가 폴백(0)으로 그려지는데 원인을 알 수 없다
          console.error('[대시보드] 제품 단가 추이 조회 실패', error)
          if (!cancelled) setCostTrends({})
        })

      try {
        // §8-2 : 선택한 달 수익성 스냅샷
        const period = await fetchPeriodByMonth(profitabilityMonth)
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
  }, [profitabilityMonth, today])

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
              costTrends={costTrends}
            />
          </div>

          <CostTrendChart points={trend} />

          <ProductProfitabilityTable
            items={items}
            periodLabel={profitabilityMonthLabel}
            month={profitabilityMonth}
            loading={loading}
            emptyMessage={`${profitabilityMonthLabel} 원가가 아직 계산되지 않았습니다. 데이터 입력 3단계에서 원가 계산을 실행해 주세요.`}
            onMonthChange={setProfitabilityMonth}
          />
        </main>
      </div>
    </div>
  )
}
