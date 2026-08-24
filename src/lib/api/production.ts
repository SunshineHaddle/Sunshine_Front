/** §5·§6 — 생산량 / 원재료 투입 실적 */
import { supabase } from '../supabase'
import { num, type MaterialUnit } from '../types'
import {
  groupLatestUsageMaterials,
  type ProductMaterialNames,
  type UsageMaterialRow,
} from './usageMaterials'

export type { ProductMaterialNames }

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
  /** materials.id — 투입 실적을 표준 배합 편집 폼에 되채울 때 필요하다 */
  materialId: string
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
    .select('product_id, material_id, usage_qty, unit, unit_price, amount, source, materials(code, name)')
    .eq('period_id', periodId)
  if (productId) query = query.eq('product_id', productId)

  const rows = unwrap(await query) as unknown as {
    product_id: string
    material_id: string
    usage_qty: number
    unit: MaterialUnit
    unit_price: number
    amount: number
    source: string
    materials: { code: string; name: string } | null
  }[]

  return rows.map((row) => ({
    productId: row.product_id,
    materialId: row.material_id,
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
): Promise<{ productId: string; totalUsage: number; totalAmount: number; rowCount: number }[]> {
  const rows = unwrap(
    await supabase
      .from('material_usages')
      .select('product_id, usage_qty, amount')
      .eq('period_id', periodId),
  ) as { product_id: string; usage_qty: number; amount: number }[]

  // 금액도 함께 모은다. confirm_period() 가 재료비로 쓰는 값이라
  // 0 이면 원가가 0 으로 굳는다 — findMissingCostBasis() 가 이걸 본다
  // 행 수도 센다 — 제품 상세의 '원재료비 상세' 박스가 이 행들로 그려지므로,
  // 금액이 0 인 것과 아예 비어 있는 것을 구분해야 한다
  const byProduct = new Map<string, { totalUsage: number; totalAmount: number; rowCount: number }>()
  for (const row of rows) {
    const seen = byProduct.get(row.product_id) ?? { totalUsage: 0, totalAmount: 0, rowCount: 0 }
    seen.totalUsage += num(row.usage_qty)
    seen.totalAmount += num(row.amount)
    seen.rowCount += 1
    byProduct.set(row.product_id, seen)
  }
  return [...byProduct].map(([productId, sums]) => ({ productId, ...sums }))
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
      .select('product_id, material_id, usage_qty, unit, unit_price, amount, source,'
        + ' materials(code, name), cost_periods!inner(period)')
      .eq('product_id', productId)
      .eq('cost_periods.period', `${month}-01`),
  ) as unknown as {
    product_id: string
    material_id: string
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
      materialId: row.material_id,
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


/**
 * 제품마다 "가장 최근 수불자료가 들어온 달"의 투입 재료 이름을 모은다.
 *
 * 제품 관리 카드는 원래 recipe_items(표준 배합)만 보여줬는데,
 * 엑셀로 자동 등록된 제품은 배합이 비어 있어 카드가 텅 비는 반면
 * 제품 상세에는 material_usages 실적이 가득 뜨는 어긋남이 있었다.
 * 원가 계산(confirm_period)이 '실적 있으면 실적, 없으면 배합' 순인 것과 맞춘다.
 *
 * 달을 섞지 않고 제품별 최근 한 달만 쓴다 — 전 기간을 합치면
 * 지금은 안 쓰는 재료까지 현재 배합인 것처럼 보인다.
 *
 * ⚠️ 반드시 fromPeriod 로 범위를 좁혀서 부른다.
 * Supabase 는 한 응답에 기본 1,000 행까지만 돌려주고, 넘치면 **에러 없이 자른다**.
 * material_usages 는 한 달에 (제품 수 × 재료 수) 만큼 쌓여서 1년이면 수백 행이다.
 * 전 기간을 읽으면 어느 순간부터 조용히 잘리고, 잘린 뒤에는 '제품별 최근 달'을
 * 잘못 골라 **엉뚱한 달의 재료 목록**이 카드에 뜬다.
 *
 * @param fromPeriod 'YYYY-MM-01'. 이 달부터 읽는다.
 *                   그 사이 생산 기록이 없는 제품은 결과에서 빠지고,
 *                   화면은 표준 배합으로 떨어진다.
 */
export async function fetchLatestUsageMaterials(
  fromPeriod: string,
): Promise<ProductMaterialNames> {
  const res = await supabase
    .from('material_usages')
    // !inner 가 없으면 기간 필터가 적용되지 않는다
    .select('product_id, amount, materials(name), cost_periods!inner(period)')
    .gte('cost_periods.period', fromPeriod)

  const rows = unwrap(res) as unknown as UsageMaterialRow[]

  // 범위를 좁혔는데도 상한에 닿았다면 잘렸을 수 있다. 조용히 틀린 값을 보여주는
  // 대신 콘솔에 남긴다 — 제품·재료가 늘면 fromPeriod 를 더 좁혀야 한다는 신호다.
  if (rows.length >= 1000) {
    console.warn(
      `[투입 재료] ${fromPeriod} 이후 ${rows.length}행을 읽었습니다. `
      + '응답 상한(1,000행)에 닿아 일부가 잘렸을 수 있습니다.',
    )
  }

  return groupLatestUsageMaterials(rows)
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
