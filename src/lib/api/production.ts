/** §5·§6 — 생산량 / 원재료 투입 실적 */
import { supabase } from '../supabase'
import { num, type MaterialUnit } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export type ProductionLine = {
  productId: string
  sku: string
  name: string
  production: number
}

/**
 * 수율·불량률은 다루지 않는다.
 * 월말 재고조사로 확정된 소요량이 material_usages 에 들어오므로
 * 로스가 이미 그 값에 포함되어 있다. 여기서 또 곱하면 이중 반영이다.
 */

// ── §5-1. 생산량 조회 ───────────────────────────────────────
export async function fetchProduction(periodId: string): Promise<ProductionLine[]> {
  const rows = unwrap(
    await supabase
      .from('production_records')
      .select('product_id, production_qty, products(sku, name)')
      .eq('period_id', periodId),
  ) as unknown as Record<string, unknown>[]

  return rows.map((row) => {
    const product = row.products as { sku: string; name: string } | null
    return {
      productId: String(row.product_id),
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      production: num(row.production_qty),
    }
  })
}

// ── §5-2. 생산량 저장 ───────────────────────────────────────
export async function saveProduction(
  periodId: string,
  rows: { productId: string; production: string | number }[],
) {
  if (rows.length === 0) return

  // 이 회차의 생산량을 통째로 교체한다. 예전 엑셀에만 있던 제품 record 가 남으면
  // 2단계(가공비 배분)에 그 달에 만들지도 않은 제품이 나온다.
  unwrap(await supabase.from('production_records').delete().eq('period_id', periodId))

  unwrap(
    await supabase.from('production_records').insert(
      rows.map((row) => ({
        period_id: periodId,
        product_id: row.productId,
        // 화면 입력은 문자열이라 빈 칸이 그대로 가면 22P02 가 난다
        production_qty: num(row.production),
      })),
    ),
  )
}

// ── §6-1. 투입 실적 조회 ────────────────────────────────────
export type UsageLine = {
  productId: string
  materialCode: string
  materialName: string
  usage: number
  unit: MaterialUnit
  unitPrice: number
  amount: number
  source: string
}

export async function fetchMaterialUsages(
  periodId: string,
  productId?: string,
): Promise<UsageLine[]> {
  let query = supabase
    .from('material_usages')
    .select('product_id, usage_qty, unit, unit_price, amount, source, materials(code, name)')
    .eq('period_id', periodId)
  if (productId) query = query.eq('product_id', productId)

  const rows = unwrap(await query) as unknown as {
    product_id: string
    usage_qty: number
    unit: MaterialUnit
    unit_price: number
    amount: number
    source: string
    materials: { code: string; name: string } | null
  }[]

  return rows.map((row) => ({
    productId: row.product_id,
    materialCode: row.materials?.code ?? '',
    materialName: row.materials?.name ?? '',
    usage: num(row.usage_qty),
    unit: row.unit,
    unitPrice: num(row.unit_price),
    amount: num(row.amount),
    source: row.source,
  }))
}

/**
 * 제품별 투입 총량(kg). 생산량이 상식적인지 검증하는 데 쓴다.
 *
 * 투입 847톤에 생산량 24kg 같은 오입력을 잡을 방법이 이것뿐이다 —
 * 예전에는 마진율이 numeric(7,2) 를 넘겨 22003 으로 터지는 게 유일한 신호였는데,
 * 컬럼을 numeric(12,2) 로 넓히면서 그 신호마저 사라졌다.
 */
export async function fetchUsageTotals(
  periodId: string,
): Promise<{ productId: string; totalUsage: number }[]> {
  const rows = unwrap(
    await supabase.from('material_usages').select('product_id, usage_qty').eq('period_id', periodId),
  ) as { product_id: string; usage_qty: number }[]

  const byProduct = new Map<string, number>()
  for (const row of rows) {
    byProduct.set(row.product_id, (byProduct.get(row.product_id) ?? 0) + num(row.usage_qty))
  }
  return [...byProduct].map(([productId, totalUsage]) => ({ productId, totalUsage }))
}

/**
 * 이 달 수불자료에 등장한 제품 id 만.
 *
 * 1단계 생산량 목록을 "엑셀에 있는 제품"으로 좁히는 데 쓴다.
 * fetchMaterialUsages 와 달리 freshEntry(빈 폼으로 시작) 여부와 무관하게 부른다 —
 * 어떤 제품이 그 달에 생산됐는지는 폼에 미리 채우는 값이 아니라 목록의 범위이기 때문이다.
 */
export async function fetchUsageProductIds(periodId: string): Promise<string[]> {
  const rows = unwrap(
    await supabase.from('material_usages').select('product_id').eq('period_id', periodId),
  ) as { product_id: string }[]

  return [...new Set(rows.map((row) => row.product_id))]
}

/**
 * 한 제품이 특정 달에 실제로 투입한 재료. 제품 상세의 원재료비 상세가 쓴다.
 *
 * periodId 대신 'YYYY-MM' 을 받아 cost_periods 를 조인한다 —
 * 화면에서 회차 id 를 따로 조회하지 않아도 되게 하기 위해서다.
 */
export async function fetchProductUsagesByMonth(
  productId: string,
  month: string,
): Promise<UsageLine[]> {
  const rows = unwrap(
    await supabase
      .from('material_usages')
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select('product_id, usage_qty, unit, unit_price, amount, source,'
        + ' materials(code, name), cost_periods!inner(period)')
      .eq('product_id', productId)
      .eq('cost_periods.period', `${month}-01`),
  ) as unknown as {
    product_id: string
    usage_qty: number
    unit: MaterialUnit
    unit_price: number
    amount: number
    source: string
    materials: { code: string; name: string } | null
  }[]

  return rows
    .map((row) => ({
      productId: row.product_id,
      materialCode: row.materials?.code ?? '',
      materialName: row.materials?.name ?? '',
      usage: num(row.usage_qty),
      unit: row.unit,
      unitPrice: num(row.unit_price),
      amount: num(row.amount),
      source: row.source,
    }))
    // 금액이 큰 재료가 위로 오면 어디에 돈이 쓰였는지 바로 보인다
    .sort((a, b) => b.amount - a.amount)
}

// ── §6-2. 투입 실적 저장 ────────────────────────────────────
export async function saveMaterialUsages(
  periodId: string,
  lines: {
    productId: string
    materialId: string
    usage: number
    unit?: MaterialUnit
    unitPrice: number
    source?: string
  }[],
) {
  if (lines.length === 0) return

  unwrap(
    await supabase.from('material_usages').upsert(
      lines.map((line) => ({
        period_id: periodId,
        product_id: line.productId,
        material_id: line.materialId,
        usage_qty: num(line.usage),
        unit: line.unit ?? 'kg',
        unit_price: num(line.unitPrice),
        source: line.source ?? 'manual',
      })),
      { onConflict: 'period_id,product_id,material_id' },
    ),
  )
}

// ── §6-3. 투입 실적 삭제 ────────────────────────────────────
export async function deleteMaterialUsages(periodId: string, productId?: string) {
  let query = supabase.from('material_usages').delete().eq('period_id', periodId)
  if (productId) query = query.eq('product_id', productId)
  unwrap(await query)
}
