[← 목차](../API.md)

# 03. 데이터 입력 (월 회차 · 생산량 · 투입 실적 · 운영비)

대상 테이블: `cost_periods` `production_records` `material_usages` `operating_costs` `operating_cost_allocations`
대상 화면: 데이터 입력 1단계, 2단계

| 기능 | 테이블 | 단계 |
|---|---|---|
| [§4-1](#4-1-월-회차-확보-없으면-생성) 월 회차 확보 | `cost_periods` | 공통 |
| [§4-2](#4-2-월-목록-조회) 월 목록 조회 | `cost_periods` | 공통 |
| [§5-1](#5-1-생산량-조회) 생산량 조회 | `production_records` | 1단계 |
| [§5-2](#5-2-생산량-저장) 생산량 저장 | `production_records` | 1단계 |
| [§6-1](#6-1-투입-실적-조회) 투입 실적 조회 | `material_usages` | 1단계 |
| [§6-2](#6-2-투입-실적-저장) 투입 실적 저장 | `material_usages` | 1단계 |
| [§6-3](#6-3-투입-실적-삭제) 투입 실적 삭제 | `material_usages` | 1단계 |
| [§7-1](#7-1-운영비-조회) 운영비 조회 | `operating_costs` (+배분) | 2단계 |
| [§7-2](#7-2-운영비-저장) 운영비 저장 | `operating_costs` (+배분) | 2단계 |
| [§7-3](#7-3-운영비-항목-삭제) 항목 삭제 | `operating_costs` | 2단계 |

> **모든 입력이 `period_id`를 기준으로 돈다.** 화면 진입 시 §4-1을 먼저 호출해 `period_id`를 확보한다.

---

## §4-1. 월 회차 확보 (없으면 생성) ✔️

```ts
async function ensurePeriod(month: string) {          // '2026-08'
  const { data, error } = await supabase
    .from('cost_periods')
    .upsert({ period: `${month}-01` }, { onConflict: 'period' })
    .select('id, period, status')
    .single()
  return data
}
```

필수:

* `period`

필드:

```
period  반드시 그 달 1일. 화면 state 가 'YYYY-MM' 이면 '-01' 을 붙인다 (F-10)
status  'draft' | 'submitted' | 'confirmed'. 기본값 draft
```

data:

```json
{ "id": "9c1e…", "period": "2026-08-01", "status": "draft" }
```

error:

```json
{ "code": "22007", "message": "invalid input syntax for type date: \"2026-08\"" }
```

---

## §4-2. 월 목록 조회 ✔️

월 선택 드롭다운용.

```ts
const { data, error } = await supabase
  .from('cost_periods')
  .select('id, period, status')
  .order('period', { ascending: false })
```

---

## §5-1. 생산량 조회 ✔️

```ts
const { data, error } = await supabase
  .from('production_records')
  .select('product_id, production_qty, defect_qty, products(sku, name)')
  .eq('period_id', periodId)
```

필수:

* `periodId`

동작:

```
1. 해당 월의 입력 행만 조회한다.
2. 아직 입력하지 않은 달은 빈 배열이다.
3. 화면 행은 제품 목록과 좌측 조인해 만들어야 미입력 제품도 보인다 (F-11).
```

data:

```json
[
  { "product_id": "11aa…", "production_qty": 24500, "defect_qty": 441,
    "products": { "sku": "SKU-2024-001", "name": "포기김치" } }
]
```

---

## §5-2. 생산량 저장 ✔️

임시저장과 다음단계 이동이 같은 호출이다.

```ts
const { error } = await supabase
  .from('production_records')
  .upsert(
    rows.map(r => ({
      period_id:      periodId,
      product_id:     r.id,
      production_qty: Number(r.production) || 0,
      defect_qty:     Number(r.defect) || 0,
    })),
    { onConflict: 'period_id,product_id' },
  )
```

필수:

* `period_id`
* `product_id`

옵션:

* `production_qty` — 기본값 `0`
* `defect_qty` — 기본값 `0`
* `note`

동작:

```
1. unique(period_id, product_id) 로 insert / update 를 자동 분기한다.
2. 배열을 보내면 전체가 한 트랜잭션으로 처리된다.
3. 해당 월이 confirmed 면 RLS 정책에 막혀 0행이 저장된다.
```

error:

```json
{ "code": "22P02", "message": "invalid input syntax for type numeric: \"\"" }
{ "code": "23503", "message": "violates foreign key constraint \"production_records_product_id_fkey\"" }
```

> 화면의 `production`은 문자열이라 빈 칸이 그대로 가면 `22P02`가 난다. 반드시 `Number(v) || 0`으로 변환한다.

---

## §6-1. 투입 실적 조회 ✔️

표준 배합(`recipe_items`)과 별개로, **그 달에 실제로 들어간 원재료**를 기록한다. 실적이 있으면 마감 시 표준보다 우선한다([부록](../API.md#부록-표준원가-vs-실제원가)).

```ts
const { data, error } = await supabase
  .from('material_usages')
  .select('product_id, usage_qty, unit, unit_price, amount, source, materials(code, name)')
  .eq('period_id', periodId)
  .eq('product_id', productId)
```

필수:

* `periodId`

옵션:

* `.eq('product_id', productId)` — 제품별 필터

data:

```json
[
  { "product_id": "11aa…", "usage_qty": 606248, "unit": "kg", "unit_price": 865,
    "amount": 524404520, "source": "excel",
    "materials": { "code": "MAT-001", "name": "배추" } }
]
```

---

## §6-2. 투입 실적 저장 ✔️

엑셀에서 파싱한 실적([§12-4](01-frontend.md#124-전체-코드))이나 수기 입력을 저장한다.

```ts
const { error } = await supabase
  .from('material_usages')
  .upsert(
    lines.map(l => ({
      period_id:   periodId,
      product_id:  l.productId,
      material_id: l.materialId,
      usage_qty:   Number(l.usage) || 0,
      unit:        l.unit ?? 'kg',
      unit_price:  Number(l.unitPrice) || 0,
      source:      'excel',
    })),
    { onConflict: 'period_id,product_id,material_id' },
  )
```

필수:

* `period_id`
* `product_id`
* `material_id`

옵션:

* `usage_qty` — 기본값 `0`
* `unit` — 기본값 `'kg'`
* `unit_price` — 기본값 `0`
* `source` — 기본값 `'manual'`. 엑셀 유입이면 `'excel'`

필드:

```
amount  generated. usage_qty × unit_price. 읽기 전용
source  'manual' | 'excel'. 데이터 출처 추적용
```

---

## §6-3. 투입 실적 삭제 ✔️

해당 월 실적을 지우면 마감 시 표준원가로 되돌아간다.

```ts
const { error } = await supabase
  .from('material_usages')
  .delete()
  .eq('period_id', periodId)
  .eq('product_id', productId)
```

---

## §7-1. 운영비 조회 ✔️

인건비와 커스텀 항목이 같은 테이블에 있고 `allocation` 값으로 구분된다.

| 항목 | `allocation` | `total_amount` | `share_percent` | `amount` |
|---|---|---|---|---|
| 인건비 | `percent` | 사용자 입력 | 사용자 입력 | 계산 (총액×%) |
| 전기세 등 | `amount` | 계산 (합계) | `null` | 사용자 입력 |

```ts
const { data, error } = await supabase
  .from('operating_costs')
  .select('id, name, category, allocation, total_amount, sort_order, operating_cost_allocations(product_id, share_percent, amount)')
  .eq('period_id', periodId)
  .order('sort_order')

const labor  = data?.find(c => c.allocation === 'percent')    // 인건비
const custom = data?.filter(c => c.allocation === 'amount')   // customItems
```

data:

```json
[
  { "id": "55cc…", "name": "인건비", "category": "labor", "allocation": "percent",
    "total_amount": 316320000,
    "operating_cost_allocations": [
      { "product_id": "11aa…", "share_percent": 40, "amount": 126528000 }
    ] },
  { "id": "66dd…", "name": "전기세", "category": "utility", "allocation": "amount",
    "total_amount": 79080000,
    "operating_cost_allocations": [
      { "product_id": "11aa…", "share_percent": null, "amount": 31632000 }
    ] }
]
```

---

## §7-2. 운영비 저장 ✔️

항목 헤더를 저장해 `id`를 받고, 그 `id`로 배분을 저장하는 **2단계 호출**이다.

### (1) 인건비 — % 배분

```ts
const { data: cost } = await supabase
  .from('operating_costs')
  .upsert({
    period_id: periodId, name: '인건비', category: 'labor',
    allocation: 'percent', total_amount: Number(costs.laborTotal) || 0, sort_order: 0,
  }, { onConflict: 'period_id,name' })
  .select('id, total_amount').single()

await supabase.from('operating_cost_allocations').upsert(
  Object.entries(costs.productFees).map(([productId, pct]) => ({
    operating_cost_id: cost.id,
    product_id:        productId,
    share_percent:     Number(pct) || 0,
    amount:            (cost.total_amount * (Number(pct) || 0)) / 100,   // F-5
  })),
  { onConflict: 'operating_cost_id,product_id' },
)
```

### (2) 커스텀 항목 — 금액 직접 입력

```ts
const total = Object.values(item.productFees).reduce((s, v) => s + (Number(v) || 0), 0)

const { data: c2 } = await supabase
  .from('operating_costs')
  .upsert({
    period_id: periodId, name: item.name || '기타 항목',
    category: 'utility', allocation: 'amount', total_amount: total,
  }, { onConflict: 'period_id,name' })
  .select('id').single()

await supabase.from('operating_cost_allocations').upsert(
  Object.entries(item.productFees).map(([productId, v]) => ({
    operating_cost_id: c2.id, product_id: productId, amount: Number(v) || 0,
  })),
  { onConflict: 'operating_cost_id,product_id' },
)
```

필수:

* `period_id`
* `name`

필드:

```
name        unique(period_id, name). 같은 달에 동명 항목 불가
category    'labor' | 'utility' | 'indirect' | 'finance' | 'other'
allocation  'percent' | 'amount'
```

동작:

```
1. 항목 행을 upsert 하고 id 를 받는다.
2. 그 id 로 배분을 별도 upsert 한다.
3. share_percent 합이 100 인지는 클라이언트가 검증한다 (F-6).
4. 원가 계산은 share_percent 가 아니라 amount 만 참조한다.
```

---

## §7-3. 운영비 항목 삭제 ✔️

```ts
const { error } = await supabase.from('operating_costs').delete().eq('id', costId)
```

필수:

* `.eq('id', costId)`

동작:

```
1. 필터가 없으면 전체가 삭제되므로 반드시 지정한다.
2. on delete cascade 로 배분 행도 함께 삭제된다.
```

---

[← 02-products](02-products.md) · [목차](../API.md) · [다음: 04-results →](04-results.md)
