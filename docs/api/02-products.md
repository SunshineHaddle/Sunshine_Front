[← 목차](../API.md)

# 02. 원재료 · 제품 · 배합

대상 테이블: `materials` `products` `recipe_items`
대상 화면: 제품 관리, 제품 상세, 제품 생성

| 기능 | 테이블 |
|---|---|
| [§2-1](#2-1-원재료-목록-조회) 원재료 목록 조회 | `materials` |
| [§2-2](#2-2-원재료-등록) 원재료 등록 | `materials` |
| [§3-1](#3-1-제품-목록-조회) 제품 목록 조회 | `products` + `recipe_items` |
| [§3-2](#3-2-제품-상세-조회) 제품 상세 조회 | `products` + `recipe_items` + `materials` |
| [§3-3](#3-3-제품-생성-배합-포함) 제품 생성 | RPC |
| [§3-4](#3-4-제품-수정) 제품 수정 | `products` |
| [§3-5](#3-5-제품-이미지-업로드) 이미지 업로드 | Storage + `products` |
| [§3-6](#3-6-배합-수정) 배합 수정 | `recipe_items` |
| [§3-7](#3-7-제품-비활성화) 제품 비활성화 | `products` |

---

## §2-1. 원재료 목록 조회 ✔️

제품 생성 화면의 재료 검색 목록. 기존 `ingredientCatalog` 상수를 대체한다.

```ts
const { data, error } = await supabase
  .from('materials')
  .select('id, code, name, unit, unit_price')
  .eq('is_active', true)
  .order('code')
```

필수:

* 없음

옵션:

* `.eq('is_active', true)` — 폐기 재료 제외
* `.ilike('name', '%배추%')` — 이름 검색
* `.order('code')`

data:

```json
[
  { "id": "a1b2…", "code": "MAT-001", "name": "배추", "unit": "kg", "unit_price": 1800 },
  { "id": "c3d4…", "code": "MAT-002", "name": "무",   "unit": "kg", "unit_price": 1500 }
]
```

---

## §2-2. 원재료 등록 ✔️

카탈로그에 없는 재료를 추가한다.

```ts
const { data, error } = await supabase
  .from('materials')
  .insert({ code: `MAT-${Date.now()}`, name, unit, unit_price: price })
  .select()
  .single()
```

필수:

* `code`
* `name`

옵션:

* `unit` — 기본값 `'kg'`
* `unit_price` — 기본값 `0`

필드:

```
code       unique. 중복 시 23505
name       원재료명
unit       'kg' | 'g' 만 허용 (enum material_unit)
unit_price 숫자. 빈 문자열이면 22P02
```

error:

```json
{ "code": "23505", "message": "duplicate key value violates unique constraint \"materials_code_key\"" }
{ "code": "22P02", "message": "invalid input value for enum material_unit: \"box\"" }
```

---

## §3-1. 제품 목록 조회 ✔️

제품 관리 페이지. 재료비와 재료 개수는 DB 컬럼이 아니므로 응답에서 합산한다([F-4](01-frontend.md#f-4-재료비재료-개수-합산)).

```ts
const { data, error } = await supabase
  .from('products')
  .select('id, sku, name, variant, description, image_url, yield_rate, status, recipe_items(amount)')
  .eq('is_active', true)
  .order('sku')

const products = data?.map(p => ({
  ...p,
  materialCost:    p.recipe_items.reduce((s, i) => s + Number(i.amount), 0),
  ingredientCount: p.recipe_items.length,
}))
```

동작:

```
1. products 를 조회한다.
2. select 안의 recipe_items(...) 가 FK 관계를 따라 배합을 중첩해 붙인다.
3. materialCost / ingredientCount 는 클라이언트에서 만든다.
```

data:

```json
[
  {
    "id": "11aa…", "sku": "SKU-2024-001", "name": "포기김치", "variant": "정품",
    "image_url": "https://…", "yield_rate": 94.2, "status": "active",
    "recipe_items": [ { "amount": 9000 }, { "amount": 4480 } ]
  }
]
```

---

## §3-2. 제품 상세 조회 ✔️

2단계 중첩으로 재료명까지 한 번에 가져온다.

```ts
const { data, error } = await supabase
  .from('products')
  .select(`
    id, sku, name, variant, description, image_url,
    specification, package_unit, yield_rate, sale_price, margin_rate, status,
    recipe_items ( id, usage_qty, unit, unit_price, amount, sort_order,
                   materials ( id, code, name ) )
  `)
  .eq('id', productId)
  .maybeSingle()
```

필수:

* `productId`

필드:

```
amount  generated 컬럼. usage_qty × unit_price 자동 계산.
        읽기 전용이라 insert/update 에 포함하면 에러
```

data:

```json
{
  "id": "11aa…", "sku": "SKU-2024-001", "name": "포기김치",
  "specification": "5kg", "package_unit": "PCK", "sale_price": 28900,
  "recipe_items": [
    { "usage_qty": 5, "unit": "kg", "unit_price": 1800, "amount": 9000,
      "materials": { "code": "MAT-001", "name": "배추" } }
  ]
}
```

error:

```json
{ "code": "PGRST116", "message": "JSON object requested, multiple (or no) rows returned" }
```

> `.single()`은 0행일 때도 이 에러를 낸다. 없을 수 있으면 `.maybeSingle()`을 쓴다.

---

## §3-3. 제품 생성 (배합 포함) ✔️ `RPC`

제품과 배합을 한 트랜잭션으로 저장한다. 두 번에 나눠 insert하면 실패 시 재료 없는 제품이 남는다.

```ts
const { data: newId, error } = await supabase.rpc('create_product_with_recipe', {
  p_product: {
    sku: `SKU-${new Date().getFullYear()}-007`,
    name: productName,
    description,
    yield_rate: 100,
    status: 'review',
  },
  p_items: selectedIngredients.map((ing, i) => ({
    material_id: ing.id,
    usage_qty:   ing.usage,
    unit:        ing.unit,
    unit_price:  ing.unitPrice,
    sort_order:  i,
  })),
})
```

필수:

* `p_product.sku`
* `p_product.name`
* `p_items` — 1개 이상
* `p_items[].material_id`

옵션:

* `p_product.description`
* `p_product.yield_rate` — 기본값 `100`
* `p_product.status` — 기본값 `'review'`
* `p_items[].unit` — 기본값 `'kg'`
* `p_items[].sort_order` — 기본값 `0`

동작:

```
1. products 에 제품을 insert 하고 생성된 uuid 를 확보한다.
2. p_items 를 펼쳐 recipe_items 에 일괄 insert 한다.
3. 중간에 실패하면 함수 전체가 롤백되어 제품도 남지 않는다.
4. 생성된 제품 uuid 를 반환한다.
```

data:

```json
"7f3c9e21-55d4-4a1b-9c88-2e6f0b1d4a77"
```

error:

```json
{ "code": "23505", "message": "duplicate key value violates unique constraint \"products_sku_key\"" }
{ "code": "23503", "message": "violates foreign key constraint \"recipe_items_material_id_fkey\"" }
```

---

## §3-4. 제품 수정 ✔️

제품명 변경, 이미지 교체, 판매가 수정에 공용으로 쓴다.

```ts
const { data, error } = await supabase
  .from('products')
  .update({ name })
  .eq('id', productId)
  .select()
```

필수:

* `.eq('id', productId)`

수정 가능 필드:

* `name` `image_url` `sale_price` `margin_rate` `specification` `package_unit` `status` `description` `yield_rate`

동작:

```
1. eq 필터가 없으면 전체 행이 수정된다. 반드시 지정한다.
2. updated_at 은 트리거가 now() 로 자동 갱신한다.
3. RLS 에 막히면 error 없이 빈 배열이 온다.
```

---

## §3-5. 제품 이미지 업로드 ✔️ `Storage`

Storage와 `products.image_url`은 자동 연동되지 않으므로 **2번 호출**이 필요하다.

```ts
const path = `${productId}/${Date.now()}-${file.name}`

const { error: upErr } = await supabase.storage
  .from('product-images')
  .upload(path, file, { upsert: true })

const { data: { publicUrl } } = supabase.storage
  .from('product-images')
  .getPublicUrl(path)

await supabase.from('products').update({ image_url: publicUrl }).eq('id', productId)
```

필수:

* `file`
* `path`

옵션:

* `upsert` — 기본값 `false`. `true`면 같은 경로 덮어쓰기
* `cacheControl` — 기본값 `'3600'`

error:

```json
{ "statusCode": "409", "error": "Duplicate", "message": "The resource already exists" }
{ "statusCode": "404", "error": "Bucket not found" }
```

---

## §3-6. 배합 수정 ✔️

제품 상세에서 배합을 고칠 때. 추가·수정은 `upsert`, 제거는 `delete`로 나눠 처리한다.

```ts
// 추가 / 수정
const { error } = await supabase
  .from('recipe_items')
  .upsert(
    items.map((it, i) => ({
      product_id:  productId,
      material_id: it.materialId,
      usage_qty:   Number(it.usage) || 0,
      unit:        it.unit ?? 'kg',
      unit_price:  Number(it.unitPrice) || 0,
      sort_order:  i,
    })),
    { onConflict: 'product_id,material_id' },
  )

// 화면에서 제거된 재료 삭제
const { error: delErr } = await supabase
  .from('recipe_items')
  .delete()
  .eq('product_id', productId)
  .not('material_id', 'in', `(${keptMaterialIds.join(',')})`)
```

필수:

* `product_id`
* `material_id`

옵션:

* `usage_qty` — 기본값 `0`
* `unit` — 기본값 `'kg'`
* `unit_price` — 기본값 `0`
* `sort_order` — 기본값 `0`

동작:

```
1. unique(product_id, material_id) 로 insert / update 를 분기한다.
2. amount 는 generated 라 보내면 안 된다. 자동 계산된다.
3. upsert 만으로는 제거된 재료가 남으므로 delete 를 함께 호출한다.
4. 이미 확정된 월의 스냅샷은 바뀌지 않는다.
```

error:

```json
{ "code": "23503", "message": "violates foreign key constraint \"recipe_items_material_id_fkey\"" }
```

> `keptMaterialIds`가 빈 배열이면 `in ()` 문법 오류가 난다. 남는 재료가 없으면 `.eq('product_id', productId)`만으로 전체 삭제한다.

---

## §3-7. 제품 비활성화 ✔️

제품은 `delete`하지 않는다. 과거 월 스냅샷이 FK로 참조하고 있어 삭제되지 않는다.

```ts
const { error } = await supabase
  .from('products')
  .update({ is_active: false })
  .eq('id', productId)
```

동작:

```
1. is_active=false 로 목록 조회에서만 제외한다.
2. 실제 delete 를 시도하면 23503 이 난다.
   과거 원가 이력을 보존하기 위한 의도된 제약이다.
```

error:

```json
{ "code": "23503", "message": "update or delete on table \"products\" violates foreign key constraint \"product_cost_summaries_product_id_fkey\"" }
```

---

[← 01-frontend](01-frontend.md) · [목차](../API.md) · [다음: 03-cost-entry →](03-cost-entry.md)
