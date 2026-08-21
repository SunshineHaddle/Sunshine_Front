-- ============================================================================
-- 패치 2026-08-22 : 음수 값을 DB에서 막는다
--
-- 배경 : 입력칸이 마이너스를 받아들였고 DB에도 제약이 없었다. 그런데 음수는
--        에러가 아니라 **조용한 실종**으로 이어진다 —
--        생산량이 -5000 이면 confirm_period 는 `production_qty > 0` 이 아니라
--        단위원가를 0 으로 두고, 수익성 표는 `.gt('production_qty', 0)` 으로
--        그 행을 아예 뺀다. 자릿수 실수(설계결정 ⑧)는 경고라도 뜨는데
--        부호 실수는 제품이 통째로 사라져 발견이 더 어렵다.
--
-- 화면에서도 NumberInput 이 기본으로 음수를 막지만, API 를 직접 부르는 경로와
-- 이미 들어간 값까지 덮으려면 DB 제약이 있어야 한다.
--
-- 적용 : Supabase 대시보드 > SQL Editor.
--        ① 먼저 확인 쿼리를 돌려 위반 행이 0 인지 본다.
--        ② 0 이면 ② 블록을 실행한다.
-- ============================================================================

-- ── ① 먼저 확인 : 전부 0 이어야 한다 ─────────────────────────
select 'production_records.production_qty' as 대상, count(*) as 위반
  from production_records where production_qty < 0
union all select 'material_usages.usage_qty', count(*)
  from material_usages where usage_qty < 0
union all select 'material_usages.unit_price', count(*)
  from material_usages where unit_price < 0
union all select 'recipe_items.usage_qty', count(*)
  from recipe_items where usage_qty < 0
union all select 'recipe_items.unit_price', count(*)
  from recipe_items where unit_price < 0
union all select 'materials.unit_price', count(*)
  from materials where unit_price < 0
union all select 'products.sale_price', count(*)
  from products where sale_price < 0
union all select 'products.unit_weight_kg', count(*)
  from products where unit_weight_kg is not null and unit_weight_kg <= 0
union all select 'operating_costs.total_amount', count(*)
  from operating_costs where total_amount < 0
union all select 'operating_cost_allocations.amount', count(*)
  from operating_cost_allocations where amount < 0;


-- ── ② 제약 추가 ──────────────────────────────────────────────
-- 위반 행이 있으면 여기서 실패한다. 그 값을 먼저 고쳐야 한다.
--
-- margin_rate 는 제외한다 — 원가가 판매가를 넘으면 음수가 정상이다.
begin;

alter table production_records
  add constraint production_qty_non_negative check (production_qty >= 0);

alter table material_usages
  add constraint usage_qty_non_negative   check (usage_qty >= 0),
  add constraint usage_price_non_negative check (unit_price >= 0);

alter table recipe_items
  add constraint recipe_qty_non_negative   check (usage_qty >= 0),
  add constraint recipe_price_non_negative check (unit_price >= 0);

alter table materials
  add constraint material_price_non_negative check (unit_price >= 0);

-- 포장 무게는 0 도 막는다. 0 이면 단위원가가 늘 0 이 된다
alter table products
  add constraint sale_price_non_negative check (sale_price >= 0),
  add constraint unit_weight_positive    check (unit_weight_kg is null or unit_weight_kg > 0);

alter table operating_costs
  add constraint total_amount_non_negative check (total_amount >= 0);

alter table operating_cost_allocations
  add constraint alloc_amount_non_negative check (amount >= 0),
  add constraint alloc_share_valid         check (share_percent is null or share_percent >= 0);

commit;


-- ── ③ 확인 ───────────────────────────────────────────────────
-- 아래가 11행 나오면 반영된 것이다.
select conrelid::regclass as 테이블, conname as 제약
from pg_constraint
where contype = 'c' and conname like '%non_negative%'
   or conname in ('unit_weight_positive', 'alloc_share_valid')
order by 1, 2;
