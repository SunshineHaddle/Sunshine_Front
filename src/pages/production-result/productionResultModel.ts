import {
  PARSED_MATERIALS_STORAGE_KEY,
  PRODUCTION_ENTRY_STORAGE_KEY,
  parseStoredMaterials,
  type ParsedProduct,
  type ProductionEntryRow,
} from '../raw-material-entry/productionEntryData'
import type { RecipeProduct } from '../product-management/productManagementData'
import {
  distributeByProduction,
  laborByProduct,
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
  totalCost: number
  unitCostPerKg: number | null
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

function buildSummaryItem(
  id: string,
  name: string,
  materials: ProductMaterialLine[],
  materialCost: number,
  production: string,
  processingFee: number,
): ProductSummaryItem {
  const totalCost = materialCost + processingFee
  const productionKg = toWonNumber(production)
  return {
    id,
    name,
    production,
    materials,
    materialCost,
    processingFee,
    totalCost,
    unitCostPerKg: productionKg > 0 ? totalCost / productionKg : null,
  }
}

function mapParsedProducts(
  parsed: ParsedProduct[],
  productionById: Map<string, string>,
  processingFeeById: Record<string, number>,
): ProductSummaryItem[] {
  return parsed.map((product) => {
    const materials: ProductMaterialLine[] = product.materials.map((material) => ({
      name: material.name,
      usage: material.quantityKg,
      unit: 'kg',
      unitPrice: material.unitPrice,
      cost: material.amount,
    }))
    return buildSummaryItem(
      product.productName,
      product.productName,
      materials,
      product.totalAmount,
      productionById.get(product.productName) ?? '',
      processingFeeById[product.productName] ?? 0,
    )
  })
}

function mapRecipeProducts(
  products: RecipeProduct[],
  productionById: Map<string, string>,
  processingFeeById: Record<string, number>,
): ProductSummaryItem[] {
  return products.map((product) => {
    const materials = product.ingredients.map((ingredient) => ({
      name: ingredient.name,
      usage: ingredient.usage,
      unit: ingredient.unit,
      unitPrice: ingredient.unitPrice,
      cost: ingredient.cost,
    }))
    const materialCost = materials.reduce((total, item) => total + item.cost, 0)
    return buildSummaryItem(
      product.id,
      product.name,
      materials,
      materialCost,
      productionById.get(product.id) ?? '',
      processingFeeById[product.id] ?? 0,
    )
  })
}

export function loadProductionCostSummary(products: RecipeProduct[]): ProductionCostSummary {
  const entryRows = readStoredJson<ProductionEntryRow[]>(PRODUCTION_ENTRY_STORAGE_KEY) ?? []
  const parsedMaterials = parseStoredMaterials(window.localStorage.getItem(PARSED_MATERIALS_STORAGE_KEY))
  const storedOperating = readStoredJson<StoredOperatingCosts>('cost-analysis-operating-costs')
  const costs = storedOperating?.costs

  const productionById = new Map(entryRows.map((row) => [row.id, row.production]))
  const feeById = costs?.productFees ?? {}

  const laborTotal = toWonNumber(costs?.laborTotal ?? '0')
  const customItems: CustomCostItem[] = costs?.customItems ?? []

  const productions = entryRows.map((row) => ({ id: row.id, production: toWonNumber(row.production) }))
  const laborByProductId = laborByProduct(costs?.laborTotal ?? '0', feeById)
  const processingFeeById: Record<string, number> = {}
  for (const id of Object.keys(feeById)) {
    processingFeeById[id] = laborByProductId[id] ?? 0
  }
  for (const item of customItems) {
    const allocation = distributeByProduction(toWonNumber(item.total), productions)
    for (const [id, amount] of Object.entries(allocation)) {
      processingFeeById[id] = (processingFeeById[id] ?? 0) + amount
    }
  }

  const summaryProducts: ProductSummaryItem[] = parsedMaterials
    ? mapParsedProducts(parsedMaterials, productionById, processingFeeById)
    : mapRecipeProducts(products, productionById, processingFeeById)

  const materialCost = summaryProducts.reduce((total, item) => total + item.materialCost, 0)

  const utilityLines: OperatingLine[] = customItems.map((item) => ({
    label: item.name || '기타 항목',
    amount: toWonNumber(item.total),
  }))
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
    hasMaterialData: Boolean(parsedMaterials) || entryRows.length > 0 || products.length > 0,
    hasOperatingData: Boolean(storedOperating),
  }
}

export const formatProductionWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
