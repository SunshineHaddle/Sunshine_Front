[← 목차](../API.md)

# 04. 결과 · 대시보드

대상 테이블: `product_cost_summaries`
대상 뷰: `v_cost_trend_monthly` `v_product_recipe_cost`
대상 화면: 데이터 입력 3단계, 대시보드, 제품 상세

| 기능 | 대상 |
|---|---|
| [§8-1](#8-1-월-마감-확정) 월 마감 (확정) | RPC `confirm_period` |
| [§8-2](#8-2-결과--수익성-조회) 결과 · 수익성 조회 | `product_cost_summaries` |
| [§9-1](#9-1-원가-변동-추이) 원가 변동 추이 | `v_cost_trend_monthly` |
| [§9-2](#9-2-제품-단가-12개월-추이) 제품 단가 12개월 추이 | `product_cost_summaries` |
| [§9-3](#9-3-제품별-표준-재료비-집계) 제품별 표준 재료비 | `v_product_recipe_cost` |

---

## §8-1. 월 마감 (확정) ✔️ `RPC`

1·2단계 입력을 읽어 원가를 계산하고 스냅샷으로 굳힌 뒤 해당 월을 잠근다.

```ts
const { data: count, error } = await supabase
  .rpc('confirm_period', { p_period_id: periodId })
```

필수:

* `p_period_id`

동작:

```
1. material_usages 에 그 달 실적이 있으면 재료비로 사용한다   → cost_source='actual'
2. 없으면 recipe_items 합계 × 생산량 을 사용한다             → cost_source='standard'
3. operating_cost_allocations.amount 를 category 로 노무비/경비로 나눈다.
4. unit_cost, margin_rate, cost_rate, defect_rate 를 계산한다.
5. margin_rate < 0 → risk, < 20 → watch, 그 외 normal.
6. product_cost_summaries 에 upsert 한다. 재실행해도 중복되지 않는다.
7. cost_periods.status 를 'confirmed' 로 바꿔 이후 입력을 차단한다.
8. 저장된 제품 수를 반환한다.
```

data:

```json
12
```

> 확정 후에는 [§5-2](03-cost-entry.md#5-2-생산량-저장), [§7-2](03-cost-entry.md#7-2-운영비-저장) 저장이 RLS에 막힌다. 다시 열려면 `cost_periods.status`를 `'draft'`로 되돌린 뒤 재확정한다.

---

## §8-2. 결과 · 수익성 조회 ✔️

3단계 결과 확인 화면과 대시보드 수익성 현황표가 **같은 호출**을 쓴다. PDF 생성([F-2](01-frontend.md#f-2-pdf-생성))의 입력도 이 결과다.

```ts
const { data, error } = await supabase
  .from('product_cost_summaries')
  .select(`
    production_qty, material_cost, labor_cost, utility_cost,
    manufacturing_cost, total_cost, unit_cost, cost_source,
    sale_price, margin_rate, cost_rate, yield_rate, defect_rate, status,
    products ( sku, name, variant, specification, package_unit )
  `)
  .eq('period_id', periodId)
  .order('total_cost', { ascending: false })
```

대시보드에서 최신 확정월을 쓰려면 앞에 한 번 더:

```ts
const { data: latest } = await supabase
  .from('cost_periods').select('id')
  .eq('status', 'confirmed')
  .order('period', { ascending: false }).limit(1).maybeSingle()
```

필드:

```
manufacturing_cost  generated. material_cost + labor_cost
total_cost          generated. + utility_cost. 둘 다 읽기 전용
cost_source         'actual' | 'standard'. 재료비 산출 근거
status              'normal' | 'watch' | 'risk'
```

동작:

```
1. 확정된 월의 스냅샷을 조회한다. 미확정 월은 빈 배열이다.
2. 마스터 데이터를 나중에 고쳐도 이 값은 바뀌지 않는다.
```

data:

```json
[
  { "production_qty": 24500, "material_cost": 312130000, "labor_cost": 133770000,
    "utility_cost": 80850000, "manufacturing_cost": 445900000, "total_cost": 526750000,
    "unit_cost": 21500, "cost_source": "actual", "sale_price": 28900,
    "margin_rate": 25.6, "cost_rate": 74.4, "yield_rate": 98.2, "defect_rate": 1.8,
    "status": "normal",
    "products": { "sku": "SKU-2024-001", "name": "포기김치",
                  "variant": "정품", "specification": "5kg", "package_unit": "PCK" } }
]
```

---

## §9-1. 원가 변동 추이 ✔️

기존 `costTrendData.ts` 상수를 대체한다. 뷰라서 조회만 가능하다.

```ts
const { data, error } = await supabase
  .from('v_cost_trend_monthly')
  .select('period, manufacturing_cost, management_total_cost')
  .gte('period', '2026-01-01')
  .order('period')
```

동작:

```
1. product_cost_summaries 를 월별 집계한 뷰를 조회한다.
2. 확정되지 않은 월은 집계에 포함되지 않는다.
3. CostPoint.label 은 period 에서 월만 잘라 만든다 (F-14).
```

data:

```json
[
  { "period": "2026-01-01", "manufacturing_cost": 61000000, "management_total_cost": 78000000 },
  { "period": "2026-02-01", "manufacturing_cost": 64000000, "management_total_cost": 82000000 }
]
```

error:

```json
{ "code": "42501", "message": "permission denied for view v_cost_trend_monthly" }
```

> 뷰에는 RLS를 걸 수 없다. [§0-6](00-common.md#0-6-뷰-권한) 참고.

---

## §9-2. 제품 단가 12개월 추이 ✔️

`MonthlyUnitPriceTrend`의 `seededFactor` 가짜 생성 로직을 대체한다.

```ts
const { data, error } = await supabase
  .from('product_cost_summaries')
  .select('unit_cost, cost_periods!inner(period)')
  .eq('product_id', productId)
  .gte('cost_periods.period', '2025-09-01')
  .order('period', { referencedTable: 'cost_periods' })
```

> `cost_periods!inner(...)`의 `!inner`가 없으면 기간 필터가 적용되지 않는다.

---

## §9-3. 제품별 표준 재료비 집계 ✔️

`v_product_recipe_cost` 뷰. [§3-1](02-products.md#3-1-제품-목록-조회)처럼 클라이언트에서 합산하지 않고 DB가 집계한 값을 쓰고 싶을 때 사용한다.

```ts
const { data, error } = await supabase
  .from('v_product_recipe_cost')
  .select('product_id, material_cost, ingredient_count')
```

옵션:

* `.eq('product_id', productId)` — 단일 제품

동작:

```
1. recipe_items 를 제품별로 집계한다. 배합이 없는 제품은 0 / 0 으로 나온다.
2. 제품 정보와 함께 쓰려면 두 번 조회해 클라이언트에서 병합한다.
   뷰에는 FK 가 없어 products 중첩 select 가 되지 않는다.
```

data:

```json
[
  { "product_id": "11aa…", "material_cost": 9000, "ingredient_count": 3 },
  { "product_id": "22bb…", "material_cost": 0,    "ingredient_count": 0 }
]
```

---

[← 03-cost-entry](03-cost-entry.md) · [목차](../API.md) · [다음: 05-files →](05-files.md)
