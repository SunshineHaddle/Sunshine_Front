/** 원재료 · 제품 · 배합 */
import { supabase } from '../supabase'
import { num, type MaterialRow, type MaterialUnit, type ProductStatus } from '../types'
import type {
  IngredientCatalogItem,
  RecipeProduct,
} from '../../pages/product-management/productManagementData'
import { shrinkImage } from '../../utils/thumbnail'

/** supabase-js 는 throw 하지 않으므로 여기서 한 번 감싼다. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ── §2-1. 원재료 목록 조회 ──────────────────────────────────
export async function fetchMaterials(): Promise<IngredientCatalogItem[]> {
  const rows = unwrap(
    await supabase
      .from('materials')
      .select('id, code, name, unit, unit_price')
      .eq('is_active', true)
      .order('code'),
  ) as MaterialRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitPrice: num(row.unit_price),
  }))
}

// ── §2-2. 원재료 등록 ───────────────────────────────────────
export async function createMaterial(input: {
  name: string
  unit: MaterialUnit
  unitPrice: number
}): Promise<IngredientCatalogItem> {
  const row = unwrap(
    await supabase
      .from('materials')
      .insert({
        code: `MAT-${Date.now()}`,
        name: input.name,
        unit: input.unit,
        unit_price: input.unitPrice,
      })
      .select('id, code, name, unit, unit_price')
      .single(),
  ) as MaterialRow

  return { id: row.id, name: row.name, unit: row.unit, unitPrice: num(row.unit_price) }
}

// ── 조회 결과 → 화면 타입(RecipeProduct) 매핑 ────────────────
type ProductWithRecipe = {
  id: string
  sku: string
  name: string
  variant: string | null
  description: string | null
  image_url: string | null
  specification: string | null
  package_unit: string | null
  unit_weight_kg: number | null
  sale_price: number
  margin_rate: number
  status: ProductStatus
  recipe_items: {
    usage_qty: number
    unit: MaterialUnit
    unit_price: number
    amount: number
    sort_order: number
    materials: { id: string; code: string; name: string } | null
  }[]
}

function toRecipeProduct(row: ProductWithRecipe): RecipeProduct {
  const items = [...(row.recipe_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    variant: row.variant ?? undefined,
    description: row.description ?? '',
    imageUrl: row.image_url ?? undefined,
    specification: row.specification ?? undefined,
    packageUnit: row.package_unit ?? undefined,
    unitWeightKg: row.unit_weight_kg ?? undefined,
    // 수율은 더 이상 계산하지 않는다. 화면 타입 호환을 위해 100 으로 채운다.
    // 월말 재고조사로 확정된 소요량에 로스가 이미 포함되어 있다.
    yieldRate: 100,
    salePrice: num(row.sale_price),
    marginRate: num(row.margin_rate),
    status: row.status,
    // F-4 : 재료비와 재료 개수는 DB 컬럼이 아니라 여기서 합산한다
    materialCost: items.reduce((sum, item) => sum + num(item.amount), 0),
    ingredientCount: items.length,
    ingredients: items.map((item) => ({
      materialId: item.materials?.id,
      name: item.materials?.name ?? '(삭제된 재료)',
      usage: num(item.usage_qty),
      unit: item.unit,
      unitPrice: num(item.unit_price),
      cost: num(item.amount),
    })),
    // 노무비·간접비는 월 단위(operating_costs)로 옮겨갔다.
    // 제품 단위 값이 필요하면 확정 스냅샷(§8-2)에서 가져온다.
    laborCost: 0,
    indirectCosts: [],
  }
}

const PRODUCT_SELECT = `
  id, sku, name, variant, description, image_url,
  specification, package_unit, unit_weight_kg, sale_price, margin_rate, status,
  recipe_items ( usage_qty, unit, unit_price, amount, sort_order,
                 materials ( id, code, name ) )
`

// ── §3-1. 제품 목록 조회 ────────────────────────────────────
export async function fetchProducts(): Promise<RecipeProduct[]> {
  const rows = unwrap(
    await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_active', true)
      .order('sku'),
  ) as unknown as ProductWithRecipe[]

  return rows.map(toRecipeProduct)
}

// ── §3-2. 제품 상세 조회 ────────────────────────────────────
export async function fetchProduct(productId: string): Promise<RecipeProduct | null> {
  const row = unwrap(
    await supabase.from('products').select(PRODUCT_SELECT).eq('id', productId).maybeSingle(),
  ) as unknown as ProductWithRecipe | null

  return row ? toRecipeProduct(row) : null
}

/**
 * 다음 제품 SKU.
 *
 * 예전에는 화면의 활성 제품 개수 + 1 로 만들었는데, 제품을 비활성화하면
 * 개수가 줄어 이미 쓴 번호로 되돌아가 23505(중복 키)가 났다.
 * 비활성 제품도 SKU 를 그대로 들고 있으므로 전체에서 최대값을 찾는다.
 */
export async function nextProductSku(): Promise<string> {
  const prefix = `SKU-${new Date().getFullYear()}-`
  const rows = unwrap(
    // is_active 로 거르지 않는다 — 숨긴 제품의 번호도 피해야 한다
    await supabase.from('products').select('sku').like('sku', `${prefix}%`),
  ) as { sku: string }[]

  const max = rows.reduce((highest, row) => {
    const n = Number(row.sku.slice(prefix.length))
    return Number.isFinite(n) && n > highest ? n : highest
  }, 0)

  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

// ── §3-3. 제품 생성 (배합 포함) ─────────────────────────────
export async function createProductWithRecipe(input: {
  /** 비우면 DB 의 최대 번호 다음으로 자동 부여한다 */
  sku?: string
  name: string
  description?: string
  items: { materialId: string; usage: number; unit: MaterialUnit; unitPrice: number }[]
}): Promise<string> {
  const p_items = input.items.map((item, index) => ({
    material_id: item.materialId,
    usage_qty: item.usage,
    unit: item.unit,
    unit_price: item.unitPrice,
    sort_order: index,
  }))

  // 번호를 읽고 쓰는 사이에 다른 사람이 같은 번호를 가져갈 수 있다.
  // 흔한 일은 아니라 잠그는 대신 몇 번 다시 시도한다.
  const attempts = input.sku ? 1 : 4
  let lastError: unknown

  for (let i = 0; i < attempts; i += 1) {
    const sku = input.sku ?? await nextProductSku()
    const res = await supabase.rpc('create_product_with_recipe', {
      p_product: {
        sku,
        name: input.name,
        description: input.description ?? null,
        status: 'review',
      },
      p_items,
    })

    if (!res.error) return res.data as string
    // 23505 = unique 위반. sku 가 겹쳤다면 다음 번호로 다시 시도한다
    if (res.error.code !== '23505') throw new Error(res.error.message)
    lastError = res.error
  }

  throw new Error(
    `제품 코드가 계속 중복됩니다. 잠시 후 다시 시도해주세요. (${
      lastError instanceof Error ? lastError.message : String(lastError)
    })`,
  )
}

// ── §3-4. 제품 수정 ─────────────────────────────────────────
export async function updateProduct(
  productId: string,
  patch: Partial<{
    name: string
    description: string
    image_url: string
    sale_price: number
    margin_rate: number
    specification: string
    package_unit: string
    /** null 이면 마감 계산이 1kg 으로 간주한다 */
    unit_weight_kg: number | null
    status: ProductStatus
  }>,
) {
  unwrap(await supabase.from('products').update(patch).eq('id', productId).select())
}

// ── §3-5. 제품 이미지 업로드 ────────────────────────────────
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  // 썸네일로만 쓰이므로 업로드 전에 최대 512px 로 줄여 용량을 낮춘다
  const small = await shrinkImage(file, 512)
  const safeName = small.name.replace(/[^\w.-]/g, '_')
  const path = `${productId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, small, { upsert: true })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  await updateProduct(productId, { image_url: data.publicUrl })
  return data.publicUrl
}

// ── §3-6. 배합 수정 ─────────────────────────────────────────
export async function saveRecipeItems(
  productId: string,
  items: { materialId: string; usage: number; unit: MaterialUnit; unitPrice: number }[],
) {
  if (items.length > 0) {
    unwrap(
      await supabase.from('recipe_items').upsert(
        items.map((item, index) => ({
          product_id: productId,
          material_id: item.materialId,
          usage_qty: item.usage,
          unit: item.unit,
          unit_price: item.unitPrice,
          sort_order: index,
        })),
        { onConflict: 'product_id,material_id' },
      ),
    )
  }

  // upsert 만으로는 화면에서 제거한 재료가 남는다.
  const kept = items.map((item) => item.materialId)
  const query = supabase.from('recipe_items').delete().eq('product_id', productId)
  // kept 가 비면 in.() 문법 오류가 나므로 전체 삭제로 분기한다.
  unwrap(await (kept.length ? query.not('material_id', 'in', `(${kept.join(',')})`) : query))
}

/**
 * 이 제품을 붙잡고 있는 자료 수.
 *
 * products 를 참조하는 5개 중 recipe_items 만 on delete cascade 다.
 * 나머지는 남아 있으면 삭제가 23503 으로 막힌다.
 */
export type ProductReferences = {
  usages: number
  production: number
  summaries: number
  allocations: number
  total: number
}

export async function countProductReferences(productId: string): Promise<ProductReferences> {
  const count = async (table: string) => {
    const res = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
    if (res.error) throw new Error(res.error.message)
    return res.count ?? 0
  }

  const [usages, production, summaries, allocations] = await Promise.all([
    count('material_usages'),
    count('production_records'),
    count('product_cost_summaries'),
    count('operating_cost_allocations'),
  ])

  return {
    usages,
    production,
    summaries,
    allocations,
    total: usages + production + summaries + allocations,
  }
}

/**
 * 이 제품의 자료를 붙잡고 있는 마감된 달.
 *
 * DELETE 는 RLS 에 막혀도 에러를 내지 않는다 — USING 이 필터로 작동해
 * 조건에 안 맞는 행을 조용히 건너뛴다. 그래서 먼저 확인하지 않으면
 * draft 달 자료만 지워지고 제품은 남는 반쪽 상태가 된다.
 */
export async function findLockedPeriods(productId: string): Promise<string[]> {
  const locked = async (table: string) => {
    const res = await supabase
      .from(table)
      // !inner 가 없으면 기간 필터가 적용되지 않는다
      .select('cost_periods!inner(period, status)')
      .eq('product_id', productId)
      .eq('cost_periods.status', 'confirmed')
    if (res.error) throw new Error(res.error.message)

    return (res.data as unknown as { cost_periods: { period: string } }[])
      .map((row) => row.cost_periods.period)
  }

  /**
   * 운영비 배분은 period_id 가 없다. 부모(operating_costs)를 타고 회차를 찾는다.
   *
   * 이 테이블을 빼먹으면 사전 검사를 통과한 뒤 마지막 products DELETE 에서
   * 23503(FK 위반)으로 터진다 — 배분 행의 RLS 가 draft 인 달만 지우게 해서,
   * 마감된 달의 배분은 조용히 남기 때문이다. 실제로 그렇게 막힌 적이 있다.
   */
  const lockedAllocations = async () => {
    const res = await supabase
      .from('operating_cost_allocations')
      .select('operating_costs!inner(cost_periods!inner(period, status))')
      .eq('product_id', productId)
      .eq('operating_costs.cost_periods.status', 'confirmed')
    if (res.error) throw new Error(res.error.message)

    return (res.data as unknown as {
      // 다대일 임베드는 객체로 오지만, 배열로 오는 경우도 방어한다
      operating_costs: { cost_periods: { period: string } | { period: string }[] } | null
    }[]).flatMap((row) => {
      const joined = row.operating_costs?.cost_periods
      if (!joined) return []
      return Array.isArray(joined) ? joined.map((p) => p.period) : [joined.period]
    })
  }

  const [usages, production, allocations] = await Promise.all([
    locked('material_usages'),
    locked('production_records'),
    lockedAllocations(),
  ])

  return [...new Set([...usages, ...production, ...allocations])].sort()
}

/**
 * §3-7 제품을 실제로 지운다.
 *
 * recipe_items 만 on delete cascade 라 나머지 4개는 직접 지운다.
 * 마감된 달의 자료가 하나라도 있으면 **아무것도 건드리지 않고** 중단한다 —
 * 중간까지 지우고 실패하면 되돌릴 수 없기 때문이다.
 */
export async function deleteProduct(productId: string) {
  const lockedPeriods = await findLockedPeriods(productId)
  if (lockedPeriods.length > 0) {
    const months = lockedPeriods
      .map((p) => `${p.slice(0, 4)}년 ${Number(p.slice(5, 7))}월`)
      .join(', ')
    throw new Error(
      `마감된 달의 자료가 있어 삭제할 수 없습니다: ${months}\n`
      + '데이터 입력 1단계에서 해당 월의 마감을 먼저 취소해주세요.',
    )
  }

  const wipe = async (table: string) => {
    const res = await supabase.from(table).delete().eq('product_id', productId)
    if (res.error) throw new Error(res.error.message)
  }

  // ponytail: 자식 테이블을 하나씩 지운다. 트랜잭션이 아니라 중간에 실패하면
  // 일부만 지워진 채로 남는다. 앞서 findLockedPeriods 로 막히는 경우를 걸러
  // 실패 확률을 낮춰 두었다. 반쪽 삭제가 실제로 발생하면 삭제용 RPC 로 옮긴다.
  await wipe('operating_cost_allocations')
  await wipe('product_cost_summaries')
  await wipe('material_usages')
  await wipe('production_records')

  // recipe_items 는 여기서 cascade 로 함께 사라진다.
  // 남은 참조가 있으면 여기서 23503 이 나므로 조용히 반쪽 삭제되지 않는다
  unwrap(await supabase.from('products').delete().eq('id', productId).select())
}

/** 숨긴 제품(is_active = false). 되돌리기 목록에 쓴다 */
export async function fetchHiddenProducts(): Promise<{ id: string; sku: string; name: string }[]> {
  return unwrap(
    await supabase
      .from('products')
      .select('id, sku, name')
      .eq('is_active', false)
      .order('sku'),
  ) as { id: string; sku: string; name: string }[]
}

/** 숨긴 제품을 다시 목록에 올린다 */
export async function restoreProduct(productId: string) {
  unwrap(await supabase.from('products').update({ is_active: true }).eq('id', productId).select())
}

// ── §3-7. 제품 비활성화 ────────────────────────────────────
export async function deactivateProduct(productId: string) {
  unwrap(await supabase.from('products').update({ is_active: false }).eq('id', productId).select())
}
