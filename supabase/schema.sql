-- ============================================================================
-- 헷살 원가분석 — Supabase 전체 스키마 (단일 파일)
--
-- 이 파일 하나로 빈 프로젝트를 완성 상태까지 만든다.
-- SQL Editor 에 통째로 붙여넣고 Run.
--
-- ⚠️ 기존 테이블과 데이터를 모두 지우고 다시 만든다.
--
-- 실행 전에 수동으로 해야 하는 것 (SQL 로 못 하는 부분):
--   Authentication → Users → Add user  ("Auto Confirm User" 체크)
--     qwer1234@sunshine.local   / 0000   → 관리자
--     worker1234@sunshine.local / 0000   → 실무자
--   계정을 먼저 만들어야 마지막 §12 에서 profiles 가 연결된다.
--
-- 구성: 테이블 12 · 뷰 2 · RPC 3 · Storage 2
-- 제품·원재료 시드는 없다. 실행하면 빈 상태로 시작한다 (§11 참고).
-- ============================================================================


-- §0. 초기화 -----------------------------------------------------------------
drop table if exists
  product_cost_summaries, operating_cost_allocations, operating_costs,
  material_usages, production_records, recipe_items, file_uploads,
  cost_periods, products, materials, profiles, exchange_rates cascade;

drop view if exists v_product_recipe_cost, v_cost_trend_monthly cascade;

drop function if exists
  confirm_period(uuid), create_product_with_recipe(jsonb, jsonb), touch_last_active(),
  my_role(), is_admin(), is_editor(), is_draft(uuid), set_updated_at() cascade;

drop type if exists user_role, material_unit, product_status, period_status,
  cost_category, allocation_type, profit_status cascade;


-- §1. 타입 -------------------------------------------------------------------
create type user_role       as enum ('admin','entry','reviewer');
create type material_unit   as enum ('kg','g');
create type product_status  as enum ('active','review');
create type period_status   as enum ('draft','submitted','confirmed');
create type cost_category   as enum ('labor','utility','indirect','finance','other');
create type allocation_type as enum ('percent','amount');
create type profit_status   as enum ('normal','watch','risk');

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;


-- §2. 마스터 -----------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  login_id       text unique not null,
  name           text not null,
  role           user_role not null default 'reviewer',
  is_active      boolean not null default true,
  last_active_at timestamptz,
  created_at     timestamptz not null default now()
);

-- name 은 수불자료의 품명과 글자까지 같아야 한다. 엑셀이 이름으로 매칭하기 때문
create table materials (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  unit       material_unit not null default 'kg',
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  sku            text unique not null,
  name           text not null,           -- 수불자료의 시트 이름과 일치해야 한다
  variant        text,
  description    text,
  image_url      text,
  specification  text,
  package_unit   text not null default 'PCK',
  -- 포장 1개의 무게(kg). 원가는 kg 단위, 판매가는 포장 단위라 환산이 필요하다.
  -- 비워두면 1 로 간주하며, 그러면 마진율이 실제보다 크게 나온다.
  unit_weight_kg numeric(10,3) check (unit_weight_kg is null or unit_weight_kg > 0),
  sale_price     numeric(14,2) not null default 0 check (sale_price >= 0),
  margin_rate    numeric(6,2)  not null default 20,
  status         product_status not null default 'review',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- 제품 1단위 기준 표준 배합. 실적(material_usages)이 없는 달에만 쓰인다
create table recipe_items (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  material_id uuid not null references materials(id),
  usage_qty   numeric(14,3) not null default 0 check (usage_qty >= 0),
  unit        material_unit not null default 'kg',
  unit_price  numeric(14,2) not null default 0 check (unit_price >= 0),  -- 시세 변동에 소급되지 않도록 복사해 둔다
  amount      numeric(16,2) generated always as (usage_qty * unit_price) stored,
  sort_order  int not null default 0,
  unique (product_id, material_id)
);


-- §3. 월별 입력 ---------------------------------------------------------------
-- 모든 월별 데이터의 앵커. period 는 반드시 그 달 1일
create table cost_periods (
  id           uuid primary key default gen_random_uuid(),
  period       date unique not null,
  status       period_status not null default 'draft',   -- confirmed 면 입력 잠김
  submitted_by uuid references profiles(id),
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

-- 수율·불량률 컬럼이 없다. 월말 재고조사로 확정된 소요량이 material_usages 로
-- 들어오므로 로스가 이미 그 값에 포함되어 있다. 수율을 또 곱하면 이중 반영이다.
create table production_records (
  id             uuid primary key default gen_random_uuid(),
  period_id      uuid not null references cost_periods(id) on delete cascade,
  product_id     uuid not null references products(id),
  production_qty numeric(14,3) not null default 0 check (production_qty >= 0),
  note           text,
  unique (period_id, product_id)
);

-- 수불자료가 들어오는 곳. 그 달 실제 투입 실적
create table material_usages (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references cost_periods(id) on delete cascade,
  product_id  uuid not null references products(id),
  material_id uuid not null references materials(id),
  usage_qty   numeric(14,3) not null default 0 check (usage_qty >= 0),
  unit        material_unit not null default 'kg',
  unit_price  numeric(14,2) not null default 0 check (unit_price >= 0),
  -- 장부 금액을 쓰지 않고 다시 계산한다. 손글씨 전사본은 금액이 틀린 경우가 있다
  amount      numeric(16,2) generated always as (usage_qty * unit_price) stored,
  source      text not null default 'manual',    -- 'manual' | 'excel'
  unique (period_id, product_id, material_id)
);

-- allocation_basis : 'manual'        = allocations 에 넣은 금액을 그대로 사용
--                    'material_cost' = 마감 시 재료비 비중으로 자동 배분
create table operating_costs (
  id               uuid primary key default gen_random_uuid(),
  period_id        uuid not null references cost_periods(id) on delete cascade,
  name             text not null,
  category         cost_category not null default 'other',
  allocation       allocation_type not null default 'amount',
  allocation_basis text not null default 'manual',
  total_amount     numeric(16,2) not null default 0 check (total_amount >= 0),
  sort_order       int not null default 0,
  unique (period_id, name)
);

create table operating_cost_allocations (
  id                uuid primary key default gen_random_uuid(),
  operating_cost_id uuid not null references operating_costs(id) on delete cascade,
  product_id        uuid not null references products(id),
  share_percent     numeric(6,3) check (share_percent is null or share_percent >= 0),
  amount            numeric(16,2) not null default 0 check (amount >= 0),
  unique (operating_cost_id, product_id)
);


-- §4. 결과 스냅샷 -------------------------------------------------------------
-- 계산값을 저장하는 유일한 예외. 나중에 단가·배합을 고쳐도
-- 지난달 원가는 그때 값 그대로 남아야 하기 때문이다.
create table product_cost_summaries (
  id                 uuid primary key default gen_random_uuid(),
  period_id          uuid not null references cost_periods(id) on delete cascade,
  product_id         uuid not null references products(id),
  production_qty     numeric(14,3) not null default 0,
  material_cost      numeric(16,2) not null default 0,
  labor_cost         numeric(16,2) not null default 0,
  utility_cost       numeric(16,2) not null default 0,
  manufacturing_cost numeric(16,2) generated always as (material_cost + labor_cost) stored,
  total_cost         numeric(16,2) generated always as (material_cost + labor_cost + utility_cost) stored,
  unit_cost          numeric(16,2) not null default 0,   -- 포장 1개당. 판매가와 같은 단위
  sale_price         numeric(14,2) not null default 0,
  -- 생산량이 재료비에 비해 작으면 마진율이 -742772% 같은 값이 나온다.
  -- numeric(7,2) 로는 22003 overflow 가 나므로 넉넉히 잡는다
  margin_rate        numeric(12,2) not null default 0,
  cost_rate          numeric(12,2) not null default 0,
  status             profit_status not null default 'normal',
  cost_source        text not null default 'standard',   -- 'actual' | 'standard'
  calculated_at      timestamptz not null default now(),
  unique (period_id, product_id)
);

create table file_uploads (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid references cost_periods(id) on delete set null,
  bucket        text not null default 'excel-uploads',
  storage_path  text unique not null,
  original_name text not null,             -- 한글 원본명 보존 (Storage 경로는 치환)
  file_name     text,
  description   text,
  file_type     text,
  size          bigint,
  row_count     int,
  uploaded_by   uuid references profiles(id),
  uploaded_at   timestamptz not null default now()
);


-- §5. 인덱스 -----------------------------------------------------------------
create index on recipe_items (product_id);
create index on production_records (period_id);
create index on material_usages (period_id, product_id);
create index on operating_costs (period_id);
create index on operating_cost_allocations (operating_cost_id);
create index on product_cost_summaries (period_id);
create index on file_uploads (period_id, uploaded_at desc);


-- §6. 권한 판정 헬퍼 ----------------------------------------------------------
-- security definer 라 profiles 를 읽어도 RLS 재귀에 걸리지 않는다
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() = 'admin';
$$;

-- 관리자 + 실무자. 데이터 입력이 가능한 사람
create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'entry');
$$;

-- 아직 마감되지 않은 달인가
create or replace function is_draft(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cost_periods where id = p and status = 'draft');
$$;


-- §7. RLS --------------------------------------------------------------------
-- anon key 는 빌드된 JS 에 그대로 박힌다. RLS 가 유일한 방어선이다.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','materials','products','recipe_items','material_usages',
    'cost_periods','production_records','operating_costs',
    'operating_cost_allocations','product_cost_summaries','file_uploads'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- 입력에 필요한 자료는 로그인한 사람 누구나 읽는다
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','materials','products','recipe_items','material_usages',
    'cost_periods','production_records','operating_costs',
    'operating_cost_allocations','file_uploads'
  ] loop
    execute format('create policy "read" on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- 원가 결과는 관리자만 읽는다.
-- 미팅 요구: "원가 및 통계자료는 관리자만 열람, 실무자는 입력만" (02:37)
-- 화면은 이미 실무자에게 대시보드를 감추지만, anon key 가 번들 JS 에 박혀 있어
-- 실무자 계정으로 로그인한 뒤 콘솔에서 직접 select 하면 그대로 나왔다.
-- UI 가림막이 아니라 여기서 막아야 접근 통제다.
create policy "admin read" on product_cost_summaries
  for select to authenticated using (is_admin());

-- 마스터·결과 : 관리자만
do $$
declare t text;
begin
  foreach t in array array['products','recipe_items','product_cost_summaries','profiles'] loop
    execute format('create policy "admin write" on %I for all to authenticated
                    using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- 원재료는 1단계에서 실무자도 등록해야 한다 (수불자료 미매칭 재료)
create policy "editor write" on materials for all to authenticated
  using (is_editor()) with check (is_editor());

-- 월 회차는 실무자도 만들 수 있어야 입력을 시작한다
create policy "editor write" on cost_periods for all to authenticated
  using (is_editor()) with check (is_editor());

-- 월별 입력 : 실무자 + draft 인 달만
do $$
declare t text;
begin
  foreach t in array array[
    'production_records','material_usages','operating_costs','file_uploads'
  ] loop
    execute format('create policy "editor draft write" on %I for all to authenticated
                    using (is_editor() and (period_id is null or is_draft(period_id)))
                    with check (is_editor() and (period_id is null or is_draft(period_id)))', t);
  end loop;
end $$;

-- 배분 테이블은 period_id 가 없어 부모(operating_costs)를 타고 판정한다
create policy "editor draft write" on operating_cost_allocations for all to authenticated
  using (is_editor() and exists (
    select 1 from operating_costs oc
    where oc.id = operating_cost_id and is_draft(oc.period_id)))
  with check (is_editor() and exists (
    select 1 from operating_costs oc
    where oc.id = operating_cost_id and is_draft(oc.period_id)));

-- profiles 에 "자기 행은 수정 가능" 정책을 만들면 안 된다.
-- RLS 는 컬럼 단위 제한이 안 되므로 사용자가 자기 role 을 admin 으로
-- 바꿀 수 있다(권한 상승). 마지막 접속 갱신은 §9 의 RPC 로만 한다.


-- §8. 뷰 ---------------------------------------------------------------------
create view v_product_recipe_cost as
select p.id as product_id,
       coalesce(sum(ri.amount), 0) as material_cost,
       count(ri.id)                as ingredient_count
from products p
left join recipe_items ri on ri.product_id = p.id
group by p.id;

-- 확정된 달만 집계되는 게 아니라, 스냅샷이 있는 달이 모두 들어온다
create view v_cost_trend_monthly as
select cp.period,
       sum(s.manufacturing_cost) as manufacturing_cost,
       sum(s.total_cost)         as management_total_cost
from product_cost_summaries s
join cost_periods cp on cp.id = s.period_id
group by cp.period order by cp.period;

-- 뷰에는 RLS 를 직접 걸 수 없다. GRANT 로 anon 을 막고,
-- security_invoker 로 "뷰를 부른 사람의 권한"으로 밑 테이블을 읽게 한다.
-- 이게 없으면 뷰가 소유자 권한으로 돌아, product_cost_summaries 의 RLS 를
-- v_cost_trend_monthly 가 통째로 우회한다 (실무자가 원가 추이를 다 읽는다).
alter view v_product_recipe_cost set (security_invoker = true);
alter view v_cost_trend_monthly set (security_invoker = true);
revoke all on v_product_recipe_cost, v_cost_trend_monthly from anon;
grant select on v_product_recipe_cost, v_cost_trend_monthly to authenticated;


-- §9. RPC --------------------------------------------------------------------
-- 제품과 배합을 한 트랜잭션으로 저장한다.
-- 두 번에 나눠 insert 하면 실패 시 재료 없는 제품이 남는다.
create or replace function create_product_with_recipe(p_product jsonb, p_items jsonb)
returns uuid language plpgsql security invoker as $$
declare new_id uuid;
begin
  insert into products (sku, name, description, status)
  values (p_product->>'sku', p_product->>'name', p_product->>'description',
          coalesce((p_product->>'status')::product_status, 'review'))
  returning id into new_id;

  insert into recipe_items (product_id, material_id, usage_qty, unit, unit_price, sort_order)
  select new_id, (i->>'material_id')::uuid, (i->>'usage_qty')::numeric,
         coalesce((i->>'unit')::material_unit, 'kg'),
         (i->>'unit_price')::numeric, coalesce((i->>'sort_order')::int, 0)
  from jsonb_array_elements(p_items) i;

  return new_id;
end $$;

-- 월 마감. 1·2단계 입력을 읽어 원가를 계산하고 스냅샷으로 굳힌다.
-- 재실행해도 중복되지 않는다 (upsert).
-- security definer 인 이유: 실무자(entry)도 1단계에서 마감할 수 있어야 하는데
-- product_cost_summaries 는 "admin write" 정책이라 invoker 로는 insert 가 막힌다.
-- 결과를 *읽는* 권한("admin read")은 그대로 관리자 전용이라, 실무자는 계산만
-- 돌릴 뿐 원가 결과를 볼 수는 없다 (미팅 요구 그대로).
create or replace function confirm_period(p_period_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare affected int;
begin
  -- definer 는 RLS 를 지나치므로 호출 권한을 여기서 직접 막는다.
  --
  -- coalesce 가 꼭 필요하다. my_role() 은 profiles 행이 없거나 is_active=false 면
  -- NULL 을 돌려주고, 그러면 is_editor() 도 false 가 아니라 NULL 이 된다.
  -- plpgsql 의 IF 는 NULL 을 false 로 취급하므로 `if not is_editor()` 는
  -- 비활성 계정을 **막지 못하고 통과시킨다** (RLS 에서는 NULL 이 거부인데 반대다).
  if coalesce(is_editor(), false) is not true then
    raise exception '마감 권한이 없습니다.' using errcode = '42501';
  end if;

  -- 이미 마감된 달을 다시 계산하지 못하게 막는다.
  -- 예전에는 invoker 라 product_cost_summaries 의 RLS 가 막아줬는데,
  -- definer 가 되면서 그 방어가 사라졌다. 이게 없으면 굳혀둔 스냅샷이
  -- 조용히 덮어써진다(②). 화면은 셋 다 draft 일 때만 부르므로 영향이 없다.
  if not exists (select 1 from cost_periods where id = p_period_id and status = 'draft') then
    raise exception '이미 마감된 달입니다. 1단계에서 마감을 먼저 취소해주세요.'
      using errcode = '42501';
  end if;

  -- 예전 계산 결과를 먼저 비운다. 아래는 upsert 라, 이번 회차 생산량에서 빠진
  -- 제품(예전 엑셀 잔재)이 지워지지 않고 표에 그대로 남는다.
  delete from product_cost_summaries where period_id = p_period_id;

  with standard_cost as (
    select product_id, sum(amount) as unit_material_cost
    from recipe_items group by product_id
  ),
  actual_cost as (
    select product_id, sum(amount) as material_cost
    from material_usages where period_id = p_period_id group by product_id
  ),
  base as (
    select pr.product_id, pr.production_qty, p.sale_price,
           coalesce(p.unit_weight_kg, 1) as unit_weight_kg,
           -- 실적이 있으면 실측, 없으면 레시피 × 생산량
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
    -- 총액 × (그 제품 재료비 ÷ 전체 재료비)
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
    from (select * from manual_alloc union all select * from auto_alloc) x
    group by product_id
  ),
  calc as (
    select b.*, coalesce(al.labor,0) as labor_cost, coalesce(al.utility,0) as utility_cost
    from base b left join alloc al on al.product_id = b.product_id
  ),
  calc2 as (
    -- 수율을 곱하지 않는다. 실측 소요량에 로스가 이미 포함되어 있다
    select c.*,
           case when c.production_qty > 0
                then (c.material_cost + c.labor_cost + c.utility_cost)
                     / c.production_qty * c.unit_weight_kg
                else 0 end as pack_cost
    from calc c
  )
  insert into product_cost_summaries (
    period_id, product_id, production_qty, material_cost, labor_cost, utility_cost,
    unit_cost, sale_price, margin_rate, cost_rate, status, cost_source
  )
  select p_period_id, product_id, production_qty, material_cost, labor_cost, utility_cost,
         round(pack_cost, 2), sale_price,
         case when sale_price > 0 then round((1 - pack_cost / sale_price) * 100, 2) else 0 end,
         case when sale_price > 0 then round((pack_cost / sale_price) * 100, 2) else 0 end,
         case when sale_price > 0 and (1 - pack_cost / sale_price) * 100 < 0  then 'risk'
              when sale_price > 0 and (1 - pack_cost / sale_price) * 100 < 20 then 'watch'
              else 'normal' end::profit_status,
         cost_source
  from calc2
  on conflict (period_id, product_id) do update set
    production_qty = excluded.production_qty, material_cost = excluded.material_cost,
    labor_cost     = excluded.labor_cost,     utility_cost  = excluded.utility_cost,
    unit_cost      = excluded.unit_cost,      sale_price    = excluded.sale_price,
    margin_rate    = excluded.margin_rate,    cost_rate     = excluded.cost_rate,
    status         = excluded.status,         cost_source   = excluded.cost_source,
    calculated_at  = now();

  get diagnostics affected = row_count;
  update cost_periods set status = 'confirmed' where id = p_period_id;
  return affected;
end $$;

-- 마지막 접속 갱신. 컬럼을 특정한 이 함수로만 허용한다 (§7 주석 참고)
create or replace function touch_last_active() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

grant execute on function touch_last_active() to authenticated;


-- §10. Storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),    -- 제품 사진. getPublicUrl 로 읽는다
  ('excel-uploads',  'excel-uploads',  false)    -- 수불자료 원본. createSignedUrl 로만
on conflict (id) do nothing;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "product images read"   on storage.objects for select to public
  using (bucket_id = 'product-images');
create policy "product images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "product images update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy "product images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');

create policy "excel read"   on storage.objects for select to authenticated
  using (bucket_id = 'excel-uploads');
create policy "excel insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'excel-uploads');
create policy "excel delete" on storage.objects for delete to authenticated
  using (bucket_id = 'excel-uploads');


-- §11. 시드 ------------------------------------------------------------------
-- **비워 둔다.** 제품·원재료는 화면에서 등록한다.
--
-- 예전에는 원재료 14종과 제품 2개(포기김치·맛김치)를 여기서 넣었다. 그런데
-- 데이터를 싹 지우려고 이 파일을 돌리면 그 시드가 다시 살아나서, 비운 줄 알았는데
-- 제품 두 개가 남아 있는 상황이 됐다.
--
-- 원재료는 1단계에서 수불자료를 올리면 미매칭 목록으로 뜨고, 버튼 한 번으로
-- 등록된다(단가도 엑셀 값이 들어간다). 제품도 같은 자리에서 만든다 — ⑭ 참고.
--
-- 시드가 다시 필요하면 git 이력에서 이 블록을 꺼내 쓸 것.
-- 단, 제품을 여기서 만들면 판매가·포장무게(unit_weight_kg)를 반드시 함께 넣어야
-- 한다. 비어 있으면 마감 때 1kg 으로 간주되어 마진율이 과대 계상된다(③).


-- §12. Auth 계정 ↔ profiles 연결 ---------------------------------------------
-- 위 안내대로 Authentication 에서 계정을 먼저 만들어야 행이 생긴다.
-- 계정을 추가할 때마다 이 블록만 다시 실행하면 된다.
insert into profiles (id, login_id, name, role)
select id, split_part(email, '@', 1),
       case when email like 'qwer%' then '관리자' else '실무자' end,
       case when email like 'qwer%' then 'admin'::user_role else 'entry'::user_role end
from auth.users
on conflict (id) do nothing;


-- §13. 확인 ------------------------------------------------------------------
-- ① 테이블 12개
select count(*) as tables from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- ② profiles 2행 (0행이면 계정을 먼저 만들고 §12 를 다시 실행)
select login_id, name, role, is_active from profiles;

-- ③ anon 정책 0행 (있으면 로그인 없이 DB 가 열려 있다는 뜻)
select tablename, policyname from pg_policies
where schemaname = 'public' and 'anon' = any(roles);

-- ④ Storage 정책 7행
select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' order by policyname;
