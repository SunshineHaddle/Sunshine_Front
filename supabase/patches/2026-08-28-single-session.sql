-- ============================================================================
-- 패치 2026-08-28 : 한 아이디로 동시 접속 막기
--
-- 이미 쓰고 있는 사람이 있으면 두 번째 로그인을 거부한다.
-- 판정은 profiles.last_active_at 으로 한다 — 화면이 열려 있는 동안 앱이
-- touch_last_active() 로 주기적으로 갱신하고, 그 값이 최근이면 사용 중으로 본다.
--
-- 여기서는 '놓아주는' 함수만 추가한다. 로그아웃할 때 불러서 자리를 비운다.
-- 없으면 로그아웃 직후 재로그인이 대기 시간만큼 막힌다.
--
-- 브라우저를 그냥 닫으면 이 함수가 불리지 않으므로, 앱이 정한 유효시간
-- (기본 3분)이 지나야 자리가 풀린다. 그게 이 방식의 대가다.
--
-- 적용 : Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
-- ============================================================================

-- last_active_at 만 건드린다. touch_last_active() 와 같은 이유로 security definer 다
-- (profiles 에 "자기 행 수정" 정책을 열면 자기 role 을 admin 으로 바꿀 수 있다 — ⑥)
create or replace function release_session() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = null where id = auth.uid();
$$;

grant execute on function release_session() to authenticated;


-- ── 확인 ────────────────────────────────────────────────────
-- 2행이 나와야 한다 (touch_last_active, release_session)
select proname, prosecdef as "definer"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('touch_last_active', 'release_session');
