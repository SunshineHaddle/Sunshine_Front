/** §8·§9 — 마감 / 수익성 / 추이 */
import { supabase } from '../supabase'
import { num, type CostSource, type ProfitStatus } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ── §8-1. 월 마감 ───────────────────────────────────────────
/** @returns 저장된 제품 수 */
export async function confirmPeriod(periodId: string): Promise<number> {
  const res = await supabase.rpc('confirm_period', { p_period_id: periodId })

  // 22003 = numeric overflow. 생산량이 재료비에 비해 터무니없이 작으면
  // 단위원가가 폭발해 마진율이 컬럼 범위를 넘는다. 원인을 바로 알려준다.
  if (res.error?.code === '22003') {
    throw new Error(
      '생산량이 재료비에 비해 너무 작아 단위원가가 비정상적으로 커졌습니다. ' +
      '1단계에서 제품별 생산량(kg)이 실제 값인지 확인해주세요.',
    )
  }
  if (res.error) throw new Error(res.error.message)
  return num(res.data)
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

/**
 * 전 제품의 단가 추이를 한 번에. 대시보드 캐러셀이 쓴다.
 * 제품마다 fetchUnitCostTrend 를 부르면 요청이 제품 수만큼 늘어난다.
 */
export type UnitCostPoint = { period: string; unitCost: number }

export async function fetchUnitCostTrendAll(
  fromPeriod: string,
): Promise<Record<string, UnitCostPoint[]>> {
  // 정렬은 걸지 않는다. 조인 테이블 컬럼 정렬은 문법이 까다롭고,
  // 어차피 화면에서 월별 자리를 찾아 꽂으므로 순서가 필요 없다.
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select('product_id, unit_cost, cost_periods!inner(period)')
      .gte('cost_periods.period', fromPeriod),
  ) as unknown as {
    product_id: string
    unit_cost: number
    // 다대일 임베드는 객체로 오지만, 배열로 오는 경우도 방어한다
    cost_periods: { period: string } | { period: string }[] | null
  }[]

  const byProduct: Record<string, UnitCostPoint[]> = {}
  for (const row of rows) {
    const joined = Array.isArray(row.cost_periods) ? row.cost_periods[0] : row.cost_periods
    if (!joined) continue
    const list = byProduct[row.product_id] ?? (byProduct[row.product_id] = [])
    list.push({ period: joined.period, unitCost: num(row.unit_cost) })
  }
  for (const list of Object.values(byProduct)) {
    list.sort((a, b) => a.period.localeCompare(b.period))
  }
  return byProduct
}

/**
 * 한 제품의 월별 원가 내역. 제품 상세의 분석 그래프가 쓴다.
 *
 * 재료비는 1단계 수불자료에서, 노무비·경비는 2단계 운영비에서 온 값이
 * 마감 때 이 제품 몫으로 배분되어 저장된 것이다.
 * 화면의 '부자재비' 는 노무비 + 경비를 뜻한다 (제품 단위 부자재 구분이 스키마에 없다).
 */
export type ProductMonthlyCost = {
  period: string
  /** '8월' 형태의 축 라벨 */
  label: string
  materialCost: number
  laborCost: number
  utilityCost: number
  /** 노무비 + 경비. 화면에서 부자재비로 부른다 */
  subMaterialCost: number
  totalCost: number
  unitCost: number
  productionQty: number
}

export async function fetchProductCostBreakdown(
  productId: string,
  fromPeriod: string,
): Promise<ProductMonthlyCost[]> {
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select(
        'material_cost, labor_cost, utility_cost, total_cost, unit_cost,'
        + ' production_qty, cost_periods!inner(period)',
      )
      .eq('product_id', productId)
      .gte('cost_periods.period', fromPeriod),
  ) as unknown as {
    material_cost: number
    labor_cost: number
    utility_cost: number
    total_cost: number
    unit_cost: number
    production_qty: number
    cost_periods: { period: string } | { period: string }[] | null
  }[]

  return rows
    .flatMap((row) => {
      const joined = Array.isArray(row.cost_periods) ? row.cost_periods[0] : row.cost_periods
      if (!joined) return []
      const labor = num(row.labor_cost)
      const utility = num(row.utility_cost)
      return [{
        period: joined.period,
        label: `${Number(joined.period.slice(5, 7))}월`,
        materialCost: num(row.material_cost),
        laborCost: labor,
        utilityCost: utility,
        subMaterialCost: labor + utility,
        totalCost: num(row.total_cost),
        unitCost: num(row.unit_cost),
        productionQty: num(row.production_qty),
      }]
    })
    .sort((a, b) => a.period.localeCompare(b.period))
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
