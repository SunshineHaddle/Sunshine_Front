/** docs/api/02-products.md — 원재료 · 제품 · 배합 */
import { supabase } from '../supabase'
import { num, type MaterialRow, type MaterialUnit, type ProductStatus } from '../types'
import type {
  IngredientCatalogItem,
  RecipeProduct,
} from '../../pages/product-management/productManagementData'

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
  yield_rate: number
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
    yieldRate: num(row.yield_rate),
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
  specification, package_unit, yield_rate, sale_price, margin_rate, status,
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

// ── §3-3. 제품 생성 (배합 포함) ─────────────────────────────
export async function createProductWithRecipe(input: {
  sku: string
  name: string
  description?: string
  yieldRate?: number
  items: { materialId: string; usage: number; unit: MaterialUnit; unitPrice: number }[]
}): Promise<string> {
  return unwrap(
    await supabase.rpc('create_product_with_recipe', {
      p_product: {
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        yield_rate: input.yieldRate ?? 100,
        status: 'review',
      },
      p_items: input.items.map((item, index) => ({
        material_id: item.materialId,
        usage_qty: item.usage,
        unit: item.unit,
        unit_price: item.unitPrice,
        sort_order: index,
      })),
    }),
  ) as string
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
    yield_rate: number
    status: ProductStatus
  }>,
) {
  unwrap(await supabase.from('products').update(patch).eq('id', productId).select())
}

// ── §3-5. 제품 이미지 업로드 ────────────────────────────────
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.-]/g, '_')
  const path = `${productId}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true })
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

// ── §3-7. 제품 비활성화 ────────────────────────────────────
export async function deactivateProduct(productId: string) {
  unwrap(await supabase.from('products').update({ is_active: false }).eq('id', productId).select())
}
