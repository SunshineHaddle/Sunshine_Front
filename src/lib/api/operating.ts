/** §7 — 운영비 */
import { supabase } from '../supabase'
import { num, type AllocationType, type CostCategory } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** 'manual' = 제품별 직접 입력, 'material_cost' = 재료비 비중 자동배분 (설계서 §4-3) */
export type AllocationBasis = 'manual' | 'material_cost'

export type OperatingCostItem = {
  id: string
  name: string
  category: CostCategory
  allocation: AllocationType
  allocationBasis: AllocationBasis
  totalAmount: number
  sortOrder: number
  allocations: { productId: string; sharePercent: number | null; amount: number }[]
}

// ── §7-1. 운영비 조회 ───────────────────────────────────────
export async function fetchOperatingCosts(periodId: string): Promise<OperatingCostItem[]> {
  const rows = unwrap(
    await supabase
      .from('operating_costs')
      .select(
        'id, name, category, allocation, allocation_basis, total_amount, sort_order,' +
          ' operating_cost_allocations(product_id, share_percent, amount)',
      )
      .eq('period_id', periodId)
      .order('sort_order'),
  ) as unknown as Record<string, unknown>[]

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: row.category as CostCategory,
    allocation: row.allocation as AllocationType,
    allocationBasis: (row.allocation_basis ?? 'manual') as AllocationBasis,
    totalAmount: num(row.total_amount),
    sortOrder: Number(row.sort_order ?? 0),
    allocations: ((row.operating_cost_allocations ?? []) as {
      product_id: string
      share_percent: number | null
      amount: number
    }[]).map((a) => ({
      productId: a.product_id,
      sharePercent: a.share_percent === null ? null : num(a.share_percent),
      amount: num(a.amount),
    })),
  }))
}

// ── §7-2 (3). 회사 전체 총액 — 재료비 비중 자동배분 ─────────
/**
 * 설계서 §4-3 방식. 제품별로 나누지 않고 총액만 저장하면,
 * confirm_period 가 마감 시점에 "총액 × (제품 재료비 ÷ 전체 재료비)" 로 배분한다.
 */
export async function saveAutoCost(input: {
  periodId: string
  name: string
  category: CostCategory
  totalAmount: string | number
  sortOrder?: number
}) {
  unwrap(
    await supabase
      .from('operating_costs')
      .upsert(
        {
          period_id: input.periodId,
          name: input.name,
          category: input.category,
          allocation: 'amount',
          allocation_basis: 'material_cost',
          total_amount: num(input.totalAmount),
          sort_order: input.sortOrder ?? 0,
        },
        { onConflict: 'period_id,name' },
      )
      .select('id')
      .single(),
  )
}

/** 항목 헤더를 저장하고 id 를 돌려준다. */
async function upsertCostItem(input: {
  periodId: string
  name: string
  category: CostCategory
  allocation: AllocationType
  totalAmount: number
  sortOrder?: number
}): Promise<string> {
  const row = unwrap(
    await supabase
      .from('operating_costs')
      .upsert(
        {
          period_id: input.periodId,
          name: input.name,
          category: input.category,
          allocation: input.allocation,
          total_amount: input.totalAmount,
          sort_order: input.sortOrder ?? 0,
        },
        { onConflict: 'period_id,name' },
      )
      .select('id')
      .single(),
  ) as { id: string }

  return row.id
}

async function upsertAllocations(
  costId: string,
  rows: { productId: string; sharePercent?: number | null; amount: number }[],
) {
  if (rows.length === 0) return
  unwrap(
    await supabase.from('operating_cost_allocations').upsert(
      rows.map((row) => ({
        operating_cost_id: costId,
        product_id: row.productId,
        share_percent: row.sharePercent ?? null,
        amount: num(row.amount),
      })),
      { onConflict: 'operating_cost_id,product_id' },
    ),
  )
}

// ── §7-2 (1). 인건비 — 총액 + % 배분 ────────────────────────
export async function saveLaborCost(
  periodId: string,
  totalAmount: number,
  /** productId → 비율(%) */
  sharesByProduct: Record<string, string | number>,
) {
  const total = num(totalAmount)
  const costId = await upsertCostItem({
    periodId,
    name: '인건비',
    category: 'labor',
    allocation: 'percent',
    totalAmount: total,
    sortOrder: 0,
  })

  await upsertAllocations(
    costId,
    Object.entries(sharesByProduct).map(([productId, pct]) => ({
      productId,
      sharePercent: num(pct),
      // F-5 : 원가 계산은 amount 만 참조하므로 여기서 환산해 둔다
      amount: (total * num(pct)) / 100,
    })),
  )
}

// ── §7-2 (2). 커스텀 항목 — 제품별 금액 직접 입력 ───────────
export async function saveCustomCost(
  periodId: string,
  name: string,
  /** productId → 금액(원) */
  amountsByProduct: Record<string, string | number>,
  options?: { category?: CostCategory; sortOrder?: number },
) {
  const entries = Object.entries(amountsByProduct)
  const total = entries.reduce((sum, [, v]) => sum + num(v), 0)

  const costId = await upsertCostItem({
    periodId,
    name: name || '기타 항목',
    category: options?.category ?? 'utility',
    allocation: 'amount',
    totalAmount: total,
    sortOrder: options?.sortOrder ?? 1,
  })

  await upsertAllocations(
    costId,
    entries.map(([productId, v]) => ({ productId, amount: num(v) })),
  )
}

/**
 * 이번에 저장한 항목 말고는 그 달에서 지운다.
 *
 * upsert 는 (period_id, name) 기준이라 **폼에서 없앤 항목이 DB 에 남는다.**
 * 실제로 이런 일이 있었다 — 8월 경비를 지우고 다시 마감했는데 100만원이
 * 계속 붙어 나왔다. 이름을 바꿔 저장한 경우도 같다: 새 이름으로 행이 하나 더
 * 생기고 옛 행은 그대로 남아 두 번 배분된다.
 *
 * 마감 계산(confirm_period)은 그 달 operating_costs 를 전부 훑으므로,
 * 화면에 없는 행이 남아 있으면 원가에 조용히 섞인다.
 */
async function pruneOperatingCosts(periodId: string, keepNames: string[]) {
  const rows = unwrap(
    await supabase.from('operating_costs').select('id, name').eq('period_id', periodId),
  ) as { id: string; name: string }[]

  const keep = new Set(keepNames)
  const stale = rows.filter((row) => !keep.has(row.name)).map((row) => row.id)
  if (stale.length === 0) return

  // .in('col', []) 은 문법 오류라 위에서 빈 배열을 걸러낸다
  unwrap(await supabase.from('operating_costs').delete().in('id', stale))
}

/**
 * 그 달 운영비를 화면 상태 그대로 맞춘다 (있는 건 갱신, 없는 건 삭제).
 * 항목을 하나씩 저장하면 지운 항목이 남으므로 저장은 이 함수로만 한다.
 */
export async function saveOperatingCosts(input: {
  periodId: string
  laborTotal: number
  /** productId → 인건비 비율(%) */
  laborShares: Record<string, string | number>
  /** 추가 항목. 이름이 빈 것은 호출부에서 걸러 온다 */
  customItems: { name: string; amountsByProduct: Record<string, string | number> }[]
}) {
  await saveLaborCost(input.periodId, input.laborTotal, input.laborShares)

  for (const [index, item] of input.customItems.entries()) {
    await saveCustomCost(input.periodId, item.name, item.amountsByProduct, {
      sortOrder: index + 1,
    })
  }

  await pruneOperatingCosts(input.periodId, [
    '인건비',
    ...input.customItems.map((item) => item.name),
  ])
}

// ── §7-3. 항목 삭제 ─────────────────────────────────────────
export async function deleteOperatingCost(costId: string) {
  // on delete cascade 로 배분 행도 함께 지워진다
  unwrap(await supabase.from('operating_costs').delete().eq('id', costId))
}
