/** docs/api/04-results.md §8·§9 — 마감 / 수익성 / 추이 */
import { supabase } from '../supabase'
import { num, type CostSource, type ProfitStatus } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ── §8-1. 월 마감 ───────────────────────────────────────────
/** @returns 저장된 제품 수 */
export async function confirmPeriod(periodId: string): Promise<number> {
  return num(unwrap(await supabase.rpc('confirm_period', { p_period_id: periodId })))
}

// ── §8-2. 결과 · 수익성 조회 ────────────────────────────────
export type CostSummary = {
  productId: string
  sku: string
  name: string
  variant?: string
  specification?: string
  packageUnit?: string
  productionQty: number
  materialCost: number
  laborCost: number
  utilityCost: number
  manufacturingCost: number
  totalCost: number
  unitCost: number
  salePrice: number
  marginRate: number
  costRate: number
  status: ProfitStatus
  costSource: CostSource
}

const SUMMARY_SELECT = `
  product_id, production_qty, material_cost, labor_cost, utility_cost,
  manufacturing_cost, total_cost, unit_cost, cost_source,
  sale_price, margin_rate, cost_rate, status,
  products ( sku, name, variant, specification, package_unit )
`

export async function fetchCostSummaries(periodId: string): Promise<CostSummary[]> {
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      .select(SUMMARY_SELECT)
      .eq('period_id', periodId)
      .order('total_cost', { ascending: false }),
  ) as unknown as Record<string, unknown>[]

  return rows.map((row) => {
    const product = row.products as {
      sku: string
      name: string
      variant: string | null
      specification: string | null
      package_unit: string | null
    } | null

    return {
      productId: String(row.product_id),
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      variant: product?.variant ?? undefined,
      specification: product?.specification ?? undefined,
      packageUnit: product?.package_unit ?? undefined,
      productionQty: num(row.production_qty),
      materialCost: num(row.material_cost),
      laborCost: num(row.labor_cost),
      utilityCost: num(row.utility_cost),
      manufacturingCost: num(row.manufacturing_cost),
      totalCost: num(row.total_cost),
      unitCost: num(row.unit_cost),
      salePrice: num(row.sale_price),
      marginRate: num(row.margin_rate),
      costRate: num(row.cost_rate),
      status: row.status as ProfitStatus,
      costSource: row.cost_source as CostSource,
    }
  })
}

// ── §9-1. 원가 변동 추이 ────────────────────────────────────
export type CostTrendPoint = {
  period: string
  /** '8월' 형태의 축 라벨 (F-14) */
  label: string
  manufacturingCost: number
  managementTotalCost: number
}

export async function fetchCostTrend(fromPeriod: string): Promise<CostTrendPoint[]> {
  const rows = unwrap(
    await supabase
      .from('v_cost_trend_monthly')
      .select('period, manufacturing_cost, management_total_cost')
      .gte('period', fromPeriod)
      .order('period'),
  ) as { period: string; manufacturing_cost: number; management_total_cost: number }[]

  return rows.map((row) => ({
    period: row.period,
    label: `${Number(row.period.slice(5, 7))}월`,
    manufacturingCost: num(row.manufacturing_cost),
    managementTotalCost: num(row.management_total_cost),
  }))
}

// ── §9-2. 제품 단가 12개월 추이 ─────────────────────────────
export async function fetchUnitCostTrend(
  productId: string,
  fromPeriod: string,
): Promise<{ period: string; label: string; unitCost: number }[]> {
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select('unit_cost, cost_periods!inner(period)')
      .eq('product_id', productId)
      .gte('cost_periods.period', fromPeriod)
      .order('period', { referencedTable: 'cost_periods' }),
  ) as unknown as { unit_cost: number; cost_periods: { period: string } }[]

  return rows.map((row) => ({
    period: row.cost_periods.period,
    label: `${Number(row.cost_periods.period.slice(5, 7))}월`,
    unitCost: num(row.unit_cost),
  }))
}

// ── §9-3. 제품별 표준 재료비 집계 ───────────────────────────
export type RecipeCostSummary = {
  productId: string
  materialCost: number
  ingredientCount: number
}

export async function fetchRecipeCostSummary(): Promise<RecipeCostSummary[]> {
  const rows = unwrap(
    await supabase
      .from('v_product_recipe_cost')
      .select('product_id, material_cost, ingredient_count'),
  ) as { product_id: string; material_cost: number; ingredient_count: number }[]

  return rows.map((row) => ({
    productId: row.product_id,
    materialCost: num(row.material_cost),
    ingredientCount: num(row.ingredient_count),
  }))
}
