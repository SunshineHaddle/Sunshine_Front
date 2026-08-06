import { useMemo, useState } from 'react'
import type { RecipeProduct } from '../../pages/product-management/productManagementData'

export function useProductCostAnalysis(product: RecipeProduct) {
  const [draftMonth, setDraftMonth] = useState('2026-06')
  const [activeMonth, setActiveMonth] = useState(draftMonth)

  const financeCost = product.indirectCosts
    .filter((cost) => cost.name.includes('이자') || cost.name.includes('금융'))
    .reduce((sum, cost) => sum + cost.amount, 0)
  const otherCost = product.indirectCosts
    .filter((cost) => cost.name.includes('식대') || cost.name.includes('기타'))
    .reduce((sum, cost) => sum + cost.amount, 0)
  const indirectCost = product.indirectCosts.reduce((sum, cost) => sum + cost.amount, 0)
    - financeCost
    - otherCost
  const manufacturingCost = product.materialCost + product.laborCost
  const totalCost = manufacturingCost + indirectCost + financeCost + otherCost
  const suggestedSalePrice = Math.max(100, Math.round((totalCost / 0.788) / 100) * 100)
  const [activeSalePrice, setActiveSalePrice] = useState(suggestedSalePrice)
  const costRate = (totalCost / Math.max(activeSalePrice, 1)) * 100
  const margin = activeSalePrice - totalCost

  const costComposition = useMemo(() => {
    const costs = [
      { id: 'material', label: '원재료', amount: product.materialCost },
      { id: 'labor', label: '노무', amount: product.laborCost },
      { id: 'indirect', label: '간접', amount: indirectCost },
      { id: 'finance', label: '금융', amount: financeCost },
      { id: 'other', label: '기타', amount: otherCost },
    ]

    return costs.map((item) => ({
      ...item,
      value: totalCost > 0 ? (item.amount / totalCost) * 100 : 0,
    }))
  }, [financeCost, indirectCost, otherCost, product.laborCost, product.materialCost, totalCost])

  const monthLabel = useMemo(() => {
    const [year, month] = activeMonth.split('-')
    return `${year}년 ${Number(month)}월`
  }, [activeMonth])

  return {
    draftMonth, setDraftMonth, activeMonth, setActiveMonth,
    manufacturingCost, totalCost, activeSalePrice, setActiveSalePrice,
    costRate, margin, costComposition, monthLabel,
  }
}

export type ProductCostAnalysisState = ReturnType<typeof useProductCostAnalysis>
