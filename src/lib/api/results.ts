/** §8·§9 — 마감 / 수익성 / 추이 */
import { supabase } from '../supabase'
import { num, type CostSource, type ProfitStatus } from '../types'
import { profitFrom } from './profit'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ── §8-1. 월 마감 ───────────────────────────────────────────
/** @returns 저장된 제품 수 */
export async function confirmPeriod(periodId: string): Promise<number> {
  // 예전 계산 결과를 먼저 비운다. confirm_period 는 upsert 만 하므로,
  // 이번 회차 생산량에서 빠진 제품(예전 엑셀 잔재)이 표에 그대로 남는다.
  //
  // 이 delete 는 product_cost_summaries 의 "admin write" 정책에 걸려 실무자에게는
  // 0건 처리된다. 그래서 같은 삭제를 confirm_period 안에도 넣어뒀다(2026-08-21 패치).
  // 여기 것은 패치 이전 DB 에서도 관리자 마감이 멀쩡하도록 남겨둔 중복이다.
  unwrap(await supabase.from('product_cost_summaries').delete().eq('period_id', periodId))

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
  /**
   * 1kg 당 값. 위의 manufacturingCost·totalCost 는 그 달 **전체 금액**이라
   * 제품끼리도, 판매가와도 비교가 안 된다. 화면은 이 값을 쓴다.
   *   제조원가/kg   = (재료비 + 노무비) ÷ 생산량
   *   경영총원가/kg = (재료비 + 노무비 + 경비) ÷ 생산량
   *   unitCost      = 경영총원가/kg × unit_weight_kg  (포장 1개당, 판매가와 같은 단위)
   */
  materialCostPerKg: number
  laborCostPerKg: number
  utilityCostPerKg: number
  manufacturingCostPerKg: number
  totalCostPerKg: number
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
  products!inner ( sku, name, variant, specification, package_unit, sale_price, unit_weight_kg )
`


export async function fetchCostSummaries(periodId: string): Promise<CostSummary[]> {
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      .select(SUMMARY_SELECT)
      .eq('period_id', periodId)
      // 생산량을 입력한 제품만 보여준다. 0(미입력)인 제품은 이 달에 만들지 않은
      // 것이므로 표에 나오면 안 된다.
      .gt('production_qty', 0)
      // 숨긴 제품은 뺀다. 오타로 만들어진 제품을 숨겨도 이 표에는 계속 떴다.
      // 원가 추이 차트(v_cost_trend_monthly)의 합계는 건드리지 않는다 —
      // 그건 그 달에 실제로 쓴 돈이고, 지금 숨겼다고 과거가 줄면 안 된다(②).
      // 임베드에 필터를 걸려면 products!inner 여야 한다.
      .eq('products.is_active', true)
      .order('total_cost', { ascending: false }),
  ) as unknown as Record<string, unknown>[]

  return rows.map((row) => {
    const product = row.products as {
      sku: string
      name: string
      variant: string | null
      specification: string | null
      package_unit: string | null
      unit_weight_kg: number | null
      sale_price: number | null
    } | null

    // 현재 판매가가 있으면 그것을 쓰고, 없으면 마감 당시 스냅샷으로 떨어진다
    // 포장무게는 판매가와 마찬가지로 products 의 현재 값을 쓴다.
    // total_cost 는 스냅샷 그대로고(설계결정 ②) 나누는 단위만 지금 것으로 바꾸는 셈이라
    // 과거 원가가 소급 변경되지는 않는다. 무게를 고치면 마감을 풀지 않아도 바로 반영된다.
    const productionQty = num(row.production_qty)
    const unitCost = productionQty > 0
      ? num(row.total_cost) / productionQty * (num(product?.unit_weight_kg) || 1)
      : num(row.unit_cost)
    const salePrice = product?.sale_price != null && num(product.sale_price) > 0
      ? num(product.sale_price)
      : num(row.sale_price)
    const profit = profitFrom(unitCost, salePrice)

    // 생산량이 0 이면 나눌 수 없다. 표에 안 나오는 행이지만(.gt 필터) 방어한다
    const qty = num(row.production_qty)
    const perKg = (amount: number) => (qty > 0 ? amount / qty : 0)

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
      materialCostPerKg: perKg(num(row.material_cost)),
      laborCostPerKg: perKg(num(row.labor_cost)),
      utilityCostPerKg: perKg(num(row.utility_cost)),
      manufacturingCostPerKg: perKg(num(row.manufacturing_cost)),
      totalCostPerKg: perKg(num(row.total_cost)),
      unitCost,
      salePrice,
      marginRate: profit.marginRate,
      costRate: profit.costRate,
      status: profit.status,
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
/**
 * 제품 단가 추이의 한 점.
 *
 * unitCost 는 포장 1개당, materialCost 는 그 달 재료비 **총액**이다.
 * 대시보드 그래프는 총액을 그린다 — 제품 상세의 '재료비' 카드와 같은 값이라야
 * 두 화면을 나란히 놓고 봤을 때 숫자가 맞는다.
 */
export type UnitCostPoint = { period: string; unitCost: number; materialCost: number }

export async function fetchUnitCostTrendAll(
  fromPeriod: string,
): Promise<Record<string, UnitCostPoint[]>> {
  // 정렬은 걸지 않는다. 조인 테이블 컬럼 정렬은 문법이 까다롭고,
  // 어차피 화면에서 월별 자리를 찾아 꽂으므로 순서가 필요 없다.
  const rows = unwrap(
    await supabase
      .from('product_cost_summaries')
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select('product_id, unit_cost, material_cost, cost_periods!inner(period)')
      .gte('cost_periods.period', fromPeriod),
  ) as unknown as {
    product_id: string
    unit_cost: number
    material_cost: number
    // 다대일 임베드는 객체로 오지만, 배열로 오는 경우도 방어한다
    cost_periods: { period: string } | { period: string }[] | null
  }[]

  const byProduct: Record<string, UnitCostPoint[]> = {}
  for (const row of rows) {
    const joined = Array.isArray(row.cost_periods) ? row.cost_periods[0] : row.cost_periods
    if (!joined) continue
    const list = byProduct[row.product_id] ?? (byProduct[row.product_id] = [])
    list.push({
      period: joined.period,
      unitCost: num(row.unit_cost),
      materialCost: num(row.material_cost),
    })
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
  // ponytail: materials 에 원자재/부자재 분류 컬럼이 없어, 화면의 '부자재비' 는
  // 실제 부자재가 아니라 노무비 + 경비다. 분류 컬럼이 생기면(REQUIREMENTS-GAP §5)
  // 진짜 부자재비와 이름이 충돌하므로 그때 함께 정리한다.
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
