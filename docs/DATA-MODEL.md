# 데이터 모델

원본은 `supabase/schema.sql` 이다. 이 문서는 읽기용 요약이며,
**실제 반영은 SQL Editor에 붙여넣고 Run** 해야 한다 (Supabase는 저장소를 읽지 않는다).

---

## 1. 타입 (enum)

| 타입 | 값 |
|---|---|
| `user_role` | `admin` `entry` `reviewer` |
| `material_unit` | `kg` `g` |
| `product_status` | `active` `review` |
| `period_status` | `draft` `submitted` `confirmed` |
| `cost_category` | `labor` `utility` `indirect` `finance` `other` |
| `allocation_type` | `percent` `amount` |
| `profit_status` | `normal` `watch` `risk` |

---

## 2. 테이블

### 마스터

**`profiles`** — `auth.users` 와 1:1. `id` 가 곧 auth 사용자 id.
`login_id` `name` `role` `is_active` `last_active_at`

**`materials`** — 원재료 마스터.
`code`(unique) `name` `unit` `unit_price` `is_active`

> `name` 이 수불자료의 품명과 **글자까지 같아야** 매칭된다.
> 단가는 **현재 값 하나뿐**이다. 월별 이력이나 이월 재고 개념이 없다.

**`products`** — 제품 마스터.
`sku`(unique) `name` `variant` `description` `image_url`
`specification` `package_unit` `unit_weight_kg` `sale_price` `margin_rate`
`status` `is_active`

> `name` 이 수불자료의 **시트 이름**과 같아야 한다.
> `unit_weight_kg` 는 포장 1개의 무게(kg). 비면 1로 간주되어 마진율이 과대 계상된다.

**`recipe_items`** — 제품 1단위 표준 배합.
`product_id` `material_id` `usage_qty` `unit` `unit_price` `amount`(generated) `sort_order`

> 그 달 실적(`material_usages`)이 없을 때만 쓰인다.

### 월별 입력

**`cost_periods`** — 월 앵커. 모든 월별 데이터가 이걸 참조한다.
`period`(`YYYY-MM-01`, unique) `status` `submitted_by` `submitted_at`

> `status='confirmed'` 이면 아래 4개 테이블 쓰기가 전원 차단된다.

**`production_records`** — 제품별 생산량(kg).
`period_id` `product_id` `production_qty`

**`material_usages`** — 그 달 실제 투입. 수불자료가 들어오는 곳.
`period_id` `product_id` `material_id` `usage_qty` `unit` `unit_price` `amount`(generated) `source`

> unique: `(period_id, product_id, material_id)` — 재업로드 시 upsert 된다.
> `unit` 은 `commitSubul` 이 항상 `'kg'` 로 넣는다.

**`operating_costs`** — 월 운영비 항목.
`period_id` `category` `name` `total_amount` `allocation` `allocation_basis` `sort_order`

**`operating_cost_allocations`** — 제품별 배분.
`operating_cost_id` `product_id` `amount` `share_percent`

> `period_id` 컬럼이 없어서 RLS가 부모(`operating_costs`)를 타고 판정한다.

### 결과·이력

**`product_cost_summaries`** — 마감 시점의 원가 스냅샷.
`period_id` `product_id` `production_qty`
`material_cost` `labor_cost` `utility_cost`
`manufacturing_cost`(generated) `total_cost`(generated)
`unit_cost` `sale_price` `margin_rate` `cost_rate` `status` `cost_source`

> `margin_rate` `cost_rate` 는 `numeric(12,2)`.
> 원래 `numeric(7,2)` 였는데 생산량이 작을 때 오버플로(`22003`)가 나서 넓혔다.

**`file_uploads`** — 엑셀 원본 이력.
`period_id` `bucket` `storage_path` `original_name` `file_name` `description`
`file_type` `size` `row_count` `uploaded_by` `uploaded_at`

---

## 3. 뷰

**`v_product_recipe_cost`** — 제품별 표준 재료비 집계 (`recipe_items` 합산).
제품 목록에서 재료비를 보여줄 때 쓴다. 클라이언트 합산보다 이쪽을 신뢰한다.

**`v_cost_trend_monthly`** — 월별 제조원가·경영총원가 집계.
`product_cost_summaries` 를 월 단위로 합산한다. **확정된 달만 나온다.**

---

## 4. RPC

**`create_product_with_recipe(p_product jsonb, p_items jsonb)`**
제품과 배합을 한 트랜잭션으로 만든다. 제품 id를 돌려준다.

**`confirm_period(p_period_id uuid)`** → 저장된 제품 수
월 마감 계산. 핵심 로직:

```
재료비 = material_usages 합계        (있으면 'actual')
       ∨ recipe_items 합계 × 생산량   (없으면 'standard')

운영비 배분 = manual (제품별 직접 배분)
            ∨ material_cost 비례 (allocation_basis='material_cost')

포장 단가 = (재료비 + 노무비 + 경비) ÷ 생산량 × coalesce(unit_weight_kg, 1)

마진율 = sale_price > 0 ? (1 - 포장단가/sale_price) × 100 : 0
상태   = 마진율 < 0 → risk, < 20 → watch, 그 외 → normal
```

> **`sale_price = 0` 이면 마진율 0, 상태 `normal`.**
> 값을 모르는 상태인데 화면엔 "정상 0%"로 보인다. 판매가 미입력과 구분되지 않는다.

> 수율을 곱하지 않는다 (설계결정 ①).

**`touch_last_active()`** — `profiles.last_active_at` 만 갱신. `security definer`.
사용자가 자기 행을 직접 update 하게 두면 `role` 도 바꿀 수 있어서 RPC로만 연다.

---

## 5. RLS

anon key는 빌드된 JS에 그대로 박히므로 **RLS가 유일한 방어선**이다.

### 헬퍼 (전부 `security definer`)

```sql
my_role()    → profiles.role  (is_active 인 경우만)
is_admin()   → my_role() = 'admin'
is_editor()  → my_role() in ('admin','entry')
is_draft(p)  → cost_periods.status = 'draft'
```

### 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `read` | **11개 테이블 전부** | `using (true)` — 로그인만 하면 전부 읽힘 |
| `admin write` | `products` `recipe_items` `product_cost_summaries` `profiles` | `is_admin()` |
| `editor write` | `materials` | `is_editor()` |
| `editor write` | `cost_periods` | `is_editor()` |
| `editor draft write` | `production_records` `material_usages` `operating_costs` `file_uploads` | `is_editor() and is_draft(period_id)` |
| `editor draft write` | `operating_cost_allocations` | 부모 `operating_costs` 의 period로 판정 |

> ⚠️ `read` 가 역할을 구분하지 않는다. 실무자도 `product_cost_summaries` 를
> 읽을 수 있다. 화면에서만 가려진다. [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md) §1.

### Storage

| 버킷 | 공개 | 정책 |
|---|---|---|
| `product-images` | Public | read: 전체 / insert·update·delete: authenticated |
| `excel-uploads` | Private | 전부 authenticated. 다운로드는 서명 URL(60초) |

---

## 6. 스키마를 바꿀 때

1. `supabase/schema.sql` 을 고친다 (기록)
2. **Supabase SQL Editor에 해당 구문을 붙여넣고 Run** (실제 반영)
3. `src/lib/types.ts` 의 행 타입을 맞춘다
4. `npx tsc -b --force`

`schema.sql` 은 맨 위에서 기존 객체를 drop 하므로 **통째로 재실행하면 데이터가 날아간다.**
운영 중에는 바뀐 구문만 골라서 실행할 것.
