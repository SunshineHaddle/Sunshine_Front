import { useEffect, useMemo, useState } from 'react'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'
import { fetchProductCostBreakdown, type ProductMonthlyCost } from '../../lib/api/results'

/**
 * 제품 원가 분석.
 *
 * 예전에는 product(레시피)에서 값을 계산했는데, 노무비·간접비가 월 단위로
 * 옮겨간 뒤로는 제품 단위 값이 늘 0 이었다. 이제 확정 스냅샷을 읽는다.
 *
 * 화면의 '부자재비' = 노무비 + 경비. 제품 단위 부자재 구분이 스키마에 없다.
 */
export function useProductCostAnalysis(product: RecipeProduct) {
  const thisMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [draftMonth, setDraftMonth] = useState(thisMonth)
  const [activeMonth, setActiveMonth] = useState(thisMonth)
  const [months, setMonths] = useState<ProductMonthlyCost[]>([])
  const [loading, setLoading] = useState(true)

  // §9-2 : 최근 12개월 확정 내역.
  // 린터가 함수 경계를 넘어 비동기성을 추적하지 못하므로 async IIFE 로 감싼다
  useEffect(() => {
    let cancelled = false
    const from = new Date()
    from.setMonth(from.getMonth() - 11)
    const fromPeriod = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`

    void (async () => {
      const rows = await fetchProductCostBreakdown(product.id, fromPeriod)
        .catch((error: unknown) => {
          console.error('[제품 원가 분석] 조회 실패', error)
          return [] as ProductMonthlyCost[]
        })
      if (cancelled) return

      setMonths(rows)
      setLoading(false)
      // 선택한 달에 자료가 없으면 자료가 있는 마지막 달로 옮겨준다.
      // 빈 화면을 보여주고 사용자가 직접 찾게 두지 않는다.
      const last = rows.at(-1)?.period.slice(0, 7)
      if (last && !rows.some((r) => r.period.slice(0, 7) === thisMonth)) {
        setDraftMonth(last)
        setActiveMonth(last)
      }
    })()

    return () => { cancelled = true }
  }, [product.id, thisMonth])

  /** 선택한 달의 내역. 없으면 0 으로 채운 빈 값 */
  const current = useMemo<ProductMonthlyCost>(() => {
    const found = months.find((m) => m.period.slice(0, 7) === activeMonth)
    return found ?? {
      period: `${activeMonth}-01`,
      label: `${Number(activeMonth.slice(5, 7))}월`,
      materialCost: 0,
      laborCost: 0,
      utilityCost: 0,
      subMaterialCost: 0,
      totalCost: 0,
      unitCost: 0,
      productionQty: 0,
    }
  }, [months, activeMonth])

  const hasData = months.some((m) => m.period.slice(0, 7) === activeMonth)

  const salePrice = product.salePrice ?? 0
  const costRate = salePrice > 0 ? (current.unitCost / salePrice) * 100 : 0
  const margin = salePrice > 0 ? salePrice - current.unitCost : 0

  const costComposition = useMemo(() => {
    const costs = [
      { id: 'material', label: '재료비', amount: current.materialCost },
      { id: 'labor', label: '노무비', amount: current.laborCost },
      { id: 'utility', label: '경비', amount: current.utilityCost },
    ]
    return costs.map((item) => ({
      ...item,
      value: current.totalCost > 0 ? (item.amount / current.totalCost) * 100 : 0,
    }))
  }, [current])

  const monthLabel = useMemo(() => {
    const [year, month] = activeMonth.split('-')
    return `${year}년 ${Number(month)}월`
  }, [activeMonth])

  return {
    draftMonth, setDraftMonth, activeMonth, setActiveMonth,
    months, loading, current, hasData,
    manufacturingCost: current.materialCost + current.laborCost,
    totalCost: current.totalCost,
    unitCost: current.unitCost,
    salePrice,
    costRate, margin, costComposition, monthLabel,
  }
}

export type ProductCostAnalysisState = ReturnType<typeof useProductCostAnalysis>
