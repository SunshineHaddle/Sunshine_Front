# 셋업 체크리스트

> 2026-08-11 기준. DB에 직접 접속해 확인한 상태를 반영했다.
> **SQL Editor의 텍스트를 지워도 DB는 그대로다.** 편집창은 메모장일 뿐이다.

---

## A. 이미 완료된 것 (확인함)

| # | 항목 | 상태 |
|---|---|---|
| A-1 | 테이블 11개 생성 | ✅ 전부 접근 가능 |
| A-2 | 뷰 2개 (`v_product_recipe_cost`, `v_cost_trend_monthly`) | ✅ |
| A-3 | RPC 2개 (`create_product_with_recipe`, `confirm_period`) | ✅ |
| A-4 | 마이그레이션 (`allocation_basis`, 불량률 3종, `good_unit_cost`, `cost_source`) | ✅ |
| A-5 | 시드 — 원재료 14개 (수불자료 품명과 정확히 일치) | ✅ |
| A-6 | 시드 — 제품 2개 (포기김치, 맛김치) | ✅ |
| A-7 | RLS + 개발용 `dev anon all` 정책 | ✅ 쓰기 확인됨 |
| A-8 | `.env` anon key | ✅ |
| A-9 | Auth 계정 2개 생성 | ✅ |
| A-10 | 수불자료 파싱 → 마감 → 대시보드 뷰 전 구간 | ✅ 실제 파일로 검증 |

다시 실행할 필요 없다.

---

## B. 남은 것 — 3개

### B-1. SQL 한 번 실행 ⬅ 지금 할 것

SQL Editor에 **아래 전체**를 붙여넣고 Run. 여러 번 실행해도 안전하다.

내용은 두 가지다.
- 판매가 단위 불일치 수정 (원가는 kg당인데 판매가는 포장당이라 마진율이 94%로 나왔다)
- Auth 계정 ↔ `profiles` 연결 (지금 `profiles` 가 0행이라 관리자 권한이 동작하지 않는다)

```sql
-- ── 1) 포장 단위 무게 ────────────────────────────────────────
alter table products add column if not exists unit_weight_kg numeric(10,3);

update products set unit_weight_kg = 5 where sku = 'SKU-2026-001';  -- 포기김치 5kg
update products set unit_weight_kg = 1 where sku = 'SKU-2026-002';  -- 맛김치 1kg

-- ── 2) Auth 계정 ↔ profiles 연결 ────────────────────────────
insert into profiles (id, login_id, name, role)
select id, split_part(email, '@', 1),
       case when email like 'qwer%' then '관리자' else '실무자' end,
       case when email like 'qwer%' then 'admin'::user_role else 'entry'::user_role end
from auth.users
on conflict (id) do nothing;

-- ── 3) confirm_period : 포장 단위 원가로 마진 계산 ───────────
create or replace function confirm_period(p_period_id uuid)
returns int language plpgsql security invoker as $$
declare affected int;
begin
  with standard_cost as (
    select product_id, sum(amount) as unit_material_cost from recipe_items group by product_id
  ),
  actual_cost as (
    select product_id, sum(amount) as material_cost
    from material_usages where period_id = p_period_id group by product_id
  ),
  base as (
    select pr.product_id, pr.production_qty, pr.defect_qty, p.sale_price,
           coalesce(p.unit_weight_kg, 1) as unit_weight_kg,
           pr.inbound_defect_rate, pr.process_waste_rate, pr.finished_defect_rate,
           coalesce(ac.material_cost,
                    pr.production_qty * coalesce(sc.unit_material_cost, 0)) as material_cost,
           case when ac.material_cost is not null then 'actual' else 'standard' end as cost_source
    from production_records pr
    join products p            on p.id = pr.product_id
    left join standard_cost sc on sc.product_id = pr.product_id
    left join actual_cost ac   on ac.product_id = pr.product_id
    where pr.period_id = p_period_id
  ),
  totals as (select nullif(sum(material_cost), 0) as all_material from base),
  manual_alloc as (
    select a.product_id, oc.category, sum(a.amount) as amt
    from operating_cost_allocations a
    join operating_costs oc on oc.id = a.operating_cost_id
    where oc.period_id = p_period_id and oc.allocation_basis = 'manual'
    group by a.product_id, oc.category
  ),
  auto_alloc as (
    -- 설계서 §4-3 : 총액 × (그 제품 재료비 ÷ 전체 재료비)
    select b.product_id, oc.category,
           sum(oc.total_amount * b.material_cost / t.all_material) as amt
    from operating_costs oc
    join base b on true cross join totals t
    where oc.period_id = p_period_id and oc.allocation_basis = 'material_cost'
      and t.all_material is not null
    group by b.product_id, oc.category
  ),
  alloc as (
    select product_id,
           coalesce(sum(amt) filter (where category = 'labor'), 0)  as labor,
           coalesce(sum(amt) filter (where category <> 'labor'), 0) as utility
    from (select * from manual_alloc union all select * from auto_alloc) x group by product_id
  ),
  calc as (
    select b.*, coalesce(al.labor,0) as labor_cost, coalesce(al.utility,0) as utility_cost,
           round(((1 - b.inbound_defect_rate/100) * (1 - b.process_waste_rate/100)
                * (1 - b.finished_defect_rate/100)) * 100, 2) as calc_yield
    from base b left join alloc al on al.product_id = b.product_id
  ),
  calc2 as (
    select c.*, c.material_cost + c.labor_cost + c.utility_cost as total_cost,
           case when c.production_qty > 0
                then (c.material_cost + c.labor_cost + c.utility_cost) / c.production_qty
                else 0 end as unit_cost
    from calc c
  ),
  calc3 as (
    select c.*, c.unit_cost * c.unit_weight_kg as pack_cost,
           case when c.calc_yield > 0
                then c.unit_cost * c.unit_weight_kg / (c.calc_yield/100) else 0 end as good_pack_cost
    from calc2 c
  )
  insert into product_cost_summaries (
    period_id, product_id, production_qty, material_cost, labor_cost, utility_cost,
    unit_cost, good_unit_cost, sale_price, margin_rate, cost_rate,
    yield_rate, defect_rate, status, cost_source
  )
  select p_period_id, product_id, production_qty, material_cost, labor_cost, utility_cost,
         round(pack_cost, 2), round(good_pack_cost, 2), sale_price,
         case when sale_price > 0 then round((1 - pack_cost / sale_price) * 100, 2) else 0 end,
         case when sale_price > 0 then round((pack_cost / sale_price) * 100, 2) else 0 end,
         calc_yield, round(100 - calc_yield, 2),
         case when sale_price > 0 and (1 - pack_cost / sale_price) * 100 < 0  then 'risk'
              when sale_price > 0 and (1 - pack_cost / sale_price) * 100 < 20 then 'watch'
              else 'normal' end::profit_status,
         cost_source
  from calc3
  on conflict (period_id, product_id) do update set
    production_qty = excluded.production_qty, material_cost  = excluded.material_cost,
    labor_cost     = excluded.labor_cost,     utility_cost   = excluded.utility_cost,
    unit_cost      = excluded.unit_cost,      good_unit_cost = excluded.good_unit_cost,
    sale_price     = excluded.sale_price,     margin_rate    = excluded.margin_rate,
    cost_rate      = excluded.cost_rate,      yield_rate     = excluded.yield_rate,
    defect_rate    = excluded.defect_rate,    status         = excluded.status,
    cost_source    = excluded.cost_source,    calculated_at  = now();

  get diagnostics affected = row_count;
  update cost_periods set status = 'confirmed' where id = p_period_id;
  return affected;
end $$;

-- ── 4) 재계산 ────────────────────────────────────────────────
update cost_periods set status = 'draft' where period = '2026-08-01';
select confirm_period(id) from cost_periods where period = '2026-08-01';
```

마지막 줄이 숫자를 반환하면(예: `2`) 정상이다.

### B-2. Storage 버킷 2개 — 콘솔에서

anon 키로는 만들 수 없어 대시보드에서 직접 해야 한다. **Storage → New bucket**

| 버킷 이름 | Public bucket |
|---|---|
| `product-images` | ✅ 체크 |
| `excel-uploads` | ❌ **해제** (원본 생산 데이터) |

### B-3. 실제 숫자 전달 — 아래 C 참고

---

## C. 필요한 정보

수불자료에는 **원재료 투입내역만** 있다. 원가를 계산하려면 아래가 더 필요하다.
현재는 전부 임시값이 들어가 있고, **제가 지어낸 숫자다.**

| # | 항목 | 현재 임시값 | 근거 | 어디서 오나 |
|---|---|---|---|---|
| C-1 | 제품별 생산량 (kg) | 포기 796,524 / 맛 93,550 | 투입총량 × 94% | 생산 일지 |
| C-2 | 총 인건비 (월) | 286,677,945 | 재료비의 25% | 급여 대장 |
| C-3 | 전기·수도세 (월) | 80,269,825 | 재료비의 7% | 고지서 |
| C-4 | 이자비용 (월) | 34,401,353 | 재료비의 3% | 대출 명세 |
| C-5 | 불량률 3종 | 입고 2 / 공정 3 / 완제품 1 % | 임의 | 품질 기록 |
| C-6 | 제품 판매가 | 포기 28,900 / 맛 6,500 원 | 옛 목데이터 | 단가표 |
| C-7 | 포장 단위 무게 | 포기 5kg / 맛 1kg | `specification` 추정 | 제품 사양 |

**C-1 ~ C-4가 가장 중요하다.** 이 넷이 없으면 재료비만 나오고 제조원가·마진이 의미가 없다.

정확한 값이 없으면 **대략적인 값이라도** 알려주면 넣어둔다. 목요일 검증 때 실제 값으로 교체하면 된다.

### 추가로 확인 필요한 것

- 수불자료에 **포기김치·맛김치 2개 제품만** 있다. 나머지 제품(총각무김치, 백김치, 깍두기 등)도 원가 분석 대상인가? 대상이면 그 제품들의 수불자료도 필요하다.
- `수불자료.xlsx` 는 손글씨 전사본이라 장부 금액이 수량×단가와 어긋난다(포기김치 249만원 차이). `수불자료_26.08.xlsx` 는 차이가 0이다. **어느 쪽이 정본인가?**
  (DB의 `amount` 는 수량×단가로 자동 계산되므로 저장 값 자체는 항상 정합이다)

---

## D. 부록 — 처음부터 완전히 다시 만들려면

**지금은 필요 없다.** DB가 정상이므로 A를 다시 할 이유가 없다.
스키마가 꼬였을 때만 아래를 쓴다. 기존 데이터가 전부 지워진다.

```sql
drop table if exists
  product_cost_summaries, operating_cost_allocations, operating_costs,
  material_usages, production_records, recipe_items, file_uploads,
  cost_periods, products, materials, profiles cascade;
drop view if exists v_product_recipe_cost, v_cost_trend_monthly cascade;
drop function if exists confirm_period(uuid), create_product_with_recipe(jsonb, jsonb),
  is_admin(), set_updated_at() cascade;
drop type if exists user_role, material_unit, product_status, period_status,
  cost_category, allocation_type, profit_status cascade;
```

이후 이 문서의 히스토리에 있는 통합 스키마 → 마이그레이션 → 시드 → B-1 순서로 다시 실행한다.
