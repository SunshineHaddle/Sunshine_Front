import type { MaterialPreviewRow } from '../../utils/materialFileParser'
import {
  calculateOperatingCosts,
  type OperatingCosts,
} from '../operating-cost-entry/operatingCostModel'

type StoredOperatingCosts = {
  month: string
  fileName: string
  costs: OperatingCosts
}

export type MaterialCostItem = {
  id: string
  name: string
  quantity: number
  unitCost: number
  amount: number
}

export type ProductionCostSummary = {
  month: string
  materialFileName: string
  operatingFileName: string
  materials: MaterialCostItem[]
  materialCost: number
  laborCost: number
  utilityCost: number
  indirectCost: number
  operatingCost: number
  totalCost: number
  hasMaterialData: boolean
  hasOperatingData: boolean
}

const emptyOperatingTotals = {
  laborCost: 0,
  utilityCost: 0,
  indirectCost: 0,
  totalCost: 0,
}

function readStoredJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

function toNumber(value: string | number) {
  const normalized = String(value).replaceAll(',', '').replace(/[^d.-]/g, '')
  return Math.max(0, Number(normalized) || 0)
}

export function loadProductionCostSummary(): ProductionCostSummary {
  const storedMaterials = readStoredJson<MaterialPreviewRow[]>('cost-analysis-material-preview') ?? []
  const storedOperating = readStoredJson<StoredOperatingCosts>('cost-analysis-operating-costs')
  const materials = storedMaterials.map((material) => {
    const quantity = toNumber(material.quantity)
    const unitCost = toNumber(material.unitCost)
    return { id: material.id, name: material.name, quantity, unitCost, amount: quantity * unitCost }
  })
  const materialCost = materials.reduce((total, material) => total + material.amount, 0)
  const operatingTotals = storedOperating?.costs
    ? calculateOperatingCosts(storedOperating.costs)
    : emptyOperatingTotals

  return {
    month: storedOperating?.month ?? '',
    materialFileName: window.localStorage.getItem('cost-analysis-material-file') ?? '',
    operatingFileName: storedOperating?.fileName ?? '',
    materials,
    materialCost,
    laborCost: operatingTotals.laborCost,
    utilityCost: operatingTotals.utilityCost,
    indirectCost: operatingTotals.indirectCost,
    operatingCost: operatingTotals.totalCost,
    totalCost: materialCost + operatingTotals.totalCost,
    hasMaterialData: materials.length > 0,
    hasOperatingData: Boolean(storedOperating),
  }
}

export function calculateYieldRate(production: string, waste: string) {
  const totalProduction = Number(production)
  const wasteQuantity = Number(waste)

  if (!production || !waste || totalProduction <= 0) {
    return { totalProduction, wasteQuantity, yieldRate: null, error: '' }
  }
  if (wasteQuantity < 0 || wasteQuantity > totalProduction) {
    return {
      totalProduction,
      wasteQuantity,
      yieldRate: null,
      error: '불량 수량은 총 생산량보다 클 수 없습니다.',
    }
  }

  return {
    totalProduction,
    wasteQuantity,
    yieldRate: ((totalProduction - wasteQuantity) / totalProduction) * 100,
    error: '',
  }
}

export const formatProductionWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
