-- 원가 결과 열람을 관리자로 좁힌다.
--
-- 배경: 11개 테이블 전부에 `read ... using (true)` 가 걸려 있어,
-- 로그인한 사람이면 실무자여도 product_cost_summaries 를 읽을 수 있었다.
-- anon key 는 빌드된 JS 에 그대로 박히므로 브라우저 콘솔 한 줄이면 원가 전체가 나온다.
-- 미팅 요구는 "원가 및 통계자료는 관리자만 열람" (02:37) 이었다.
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
--       (Supabase 는 이 저장소를 읽지 않는다)
--
-- 되돌리기는 파일 맨 아래에 있다.

begin;

-- 1) 전체 개방 read 정책을 원가 결과 테이블에서만 걷어낸다
drop policy if exists "read" on product_cost_summaries;

-- 2) 관리자만 읽는다.
--    쓰기는 이미 "admin write"(for all) 가 막고 있고, 그 정책도 select 를 허용하므로
--    관리자는 이 정책이 없어도 읽히지만, 의도를 드러내려고 명시해 둔다.
drop policy if exists "admin read" on product_cost_summaries;
create policy "admin read" on product_cost_summaries
  for select to authenticated using (is_admin());

-- 3) 뷰가 RLS 를 우회하지 못하게 한다.
--    뷰는 기본적으로 소유자 권한으로 돈다. 이 설정이 없으면
--    v_cost_trend_monthly 가 product_cost_summaries 의 RLS 를 통째로 건너뛴다.
--    (PostgreSQL 15 이상 필요. Supabase 는 15+ 다)
alter view v_product_recipe_cost set (security_invoker = true);
alter view v_cost_trend_monthly  set (security_invoker = true);

commit;


-- ── 확인 ────────────────────────────────────────────────────
-- 실무자(worker1234) 로 로그인한 브라우저 콘솔에서 아래가 0 행이어야 한다.
--   await supabase.from('product_cost_summaries').select('*')
--   await supabase.from('v_cost_trend_monthly').select('*')
-- 관리자(qwer1234) 에서는 그대로 나와야 하고, 대시보드·제품 상세가 정상이어야 한다.

-- ── 되돌리기 ────────────────────────────────────────────────
-- drop policy if exists "admin read" on product_cost_summaries;
-- create policy "read" on product_cost_summaries
--   for select to authenticated using (true);
-- alter view v_product_recipe_cost set (security_invoker = false);
-- alter view v_cost_trend_monthly  set (security_invoker = false);
