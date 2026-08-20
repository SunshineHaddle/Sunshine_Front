-- 테스트 제품 '맛지리는김치' 완전 삭제.
--
-- 화면의 '완전 삭제'로는 지울 수 없다. 마감된 달의 자료가 걸려 있으면
-- RLS 가 자식 행 DELETE 를 조용히 건너뛰고(HANDOFF ⑪), 마지막에 FK 위반으로 터진다.
-- SQL Editor 는 postgres 권한이라 RLS 를 통과하므로 여기서는 지워진다.
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.

-- ── 1) 먼저 확인 ────────────────────────────────────────────
-- 무엇이 지워지는지 본다. 이 select 만 먼저 돌려도 된다.
select
  p.id, p.sku, p.name, p.status,
  (select count(*) from recipe_items               where product_id = p.id) as 배합,
  (select count(*) from material_usages            where product_id = p.id) as 투입내역,
  (select count(*) from production_records         where product_id = p.id) as 생산량,
  (select count(*) from operating_cost_allocations where product_id = p.id) as 운영비배분,
  (select count(*) from product_cost_summaries     where product_id = p.id) as 원가결과
from products p
where p.name = '맛지리는김치';

-- sku 가 'PRD-' 로 시작하면 엑셀 시트명에서 자동 생성된 제품이다.


-- ── 2) 삭제 ─────────────────────────────────────────────────
-- 위 select 결과가 그 제품 하나가 맞는지 확인한 뒤 아래를 돌린다.
-- recipe_items 는 on delete cascade 라 따로 지우지 않아도 함께 사라진다.

begin;

with target as (select id from products where name = '맛지리는김치')
delete from operating_cost_allocations where product_id in (select id from target);

with target as (select id from products where name = '맛지리는김치')
delete from product_cost_summaries     where product_id in (select id from target);

with target as (select id from products where name = '맛지리는김치')
delete from material_usages            where product_id in (select id from target);

with target as (select id from products where name = '맛지리는김치')
delete from production_records         where product_id in (select id from target);

delete from products where name = '맛지리는김치';

commit;


-- ── 3) 확인 ─────────────────────────────────────────────────
-- 0 행이어야 한다.
select count(*) from products where name = '맛지리는김치';

-- ⚠️ 되돌릴 수 없다. 이 제품이 들어간 과거 달을 다시 마감하면
--    그 달 원가 합계가 이 제품 몫만큼 줄어든다.
