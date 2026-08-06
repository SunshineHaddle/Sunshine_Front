import { PRODUCTION_ENTRY_STORAGE_KEY, type ProductionEntryRow } from '../raw-material-entry/productionEntryData'
import type { RecipeProduct } from '../product-management/productManagementData'
import {
  toWonNumber,
  type CustomCostItem,
  type OperatingCosts,
} from '../operating-cost-entry/operatingCostModel'

type StoredOperatingCosts = {
  month: string
  costs: OperatingCosts
}

export type ProductMaterialLine = {
  name: string
  usage: number
  unit: string
  unitPrice?: number
  cost: number
}

export type ProductSummaryItem = {
  id: string
  name: string
  production: string
  materials: ProductMaterialLine[]
  materialCost: number
  processingFee: number
}

export type OperatingLine = {
  label: string
  amount: number
}

export type ProductionCostSummary = {
  month: string
  products: ProductSummaryItem[]
  materialCost: number
  laborTotal: number
  utilityLines: OperatingLine[]
  operatingCost: number
  totalCost: number
  laborCost: number
  utilityCost: number
  indirectCost: number
  hasMaterialData: boolean
  hasOperatingData: boolean
}

function readStoredJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function loadProductionCostSummary(products: RecipeProduct[]): ProductionCostSummary {
  const entryRows = readStoredJson<ProductionEntryRow[]>(PRODUCTION_ENTRY_STORAGE_KEY) ?? []
  const storedOperating = readStoredJson<StoredOperatingCosts>('cost-analysis-operating-costs')
  const costs = storedOperating?.costs

  const productionById = new Map(entryRows.map((row) => [row.id, row.production]))
  const feeById = costs?.productFees ?? {}

  const summaryProducts: ProductSummaryItem[] = products.map((product) => {
    const materials = product.ingredients.map((ingredient) => ({
      name: ingredient.name,
      usage: ingredient.usage,
      unit: ingredient.unit,
      unitPrice: ingredient.unitPrice,
      cost: ingredient.cost,
    }))
    const materialCost = materials.reduce((total, item) => total + item.cost, 0)
    return {
      id: product.id,
      name: product.name,
      production: productionById.get(product.id) ?? '',
      materials,
      materialCost,
      processingFee: toWonNumber(feeById[product.id] ?? '0'),
    }
  })

  const materialCost = summaryProducts.reduce((total, item) => total + item.materialCost, 0)

  const laborTotal = toWonNumber(costs?.laborTotal ?? '0')
  const customItems: CustomCostItem[] = costs?.customItems ?? []
  const utilityLines: OperatingLine[] = [
    { label: '전기세', amount: toWonNumber(costs?.electricity ?? '0') },
    { label: '물세', amount: toWonNumber(costs?.water ?? '0') },
    ...customItems.map((item) => ({ label: item.name || '기타 항목', amount: toWonNumber(item.amount) })),
  ]
  const utilityTotal = utilityLines.reduce((total, line) => total + line.amount, 0)
  const operatingCost = laborTotal + utilityTotal

  return {
    month: storedOperating?.month ?? '',
    products: summaryProducts,
    materialCost,
    laborTotal,
    utilityLines,
    operatingCost,
    totalCost: materialCost + operatingCost,
    laborCost: laborTotal,
    utilityCost: utilityTotal,
    indirectCost: 0,
    hasMaterialData: entryRows.length > 0 || products.length > 0,
    hasOperatingData: Boolean(storedOperating),
  }
}

export const formatProductionWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
