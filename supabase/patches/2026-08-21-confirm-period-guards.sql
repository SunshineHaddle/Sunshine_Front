-- ============================================================================
-- 패치 2026-08-21 (2) : confirm_period 권한·마감 가드 보강
--
-- 앞선 패치(2026-08-21-worker-confirm-period.sql)에서 함수를 security definer 로
-- 바꾸면서 두 곳이 열렸다. 이 파일은 그 함수의 **전체 정의를 다시 만든다** —
-- 앞 패치를 이미 돌렸든 아니든, 이것만 돌리면 최종 상태가 된다.
--
-- ① 권한 검사가 NULL 을 통과시켰다
--    my_role() 은 profiles 행이 없거나 is_active=false 면 NULL 을 준다.
--    그러면 is_editor() 도 false 가 아니라 NULL 이고, plpgsql 의 IF 는 NULL 을
--    false 로 취급한다. 즉 `if not is_editor()` 는 비활성 계정을 막지 못했다.
--    RLS 정책에서는 NULL 이 '거부' 인데 IF 에서는 정반대로 동작한다.
--    → coalesce(is_editor(), false) 로 '모름'을 '아니오'로 못박는다.
--
-- ② 마감된 달을 다시 마감할 수 있었다
--    invoker 였을 때는 product_cost_summaries 의 RLS 가 막아줬는데,
--    definer 가 되면서 그 방어가 사라졌다. 이미 confirmed 인 회차에 다시
--    호출하면 굳혀둔 스냅샷이 조용히 덮어써진다 (설계결정 ②).
--    → 회차가 draft 일 때만 실행한다. 화면의 호출 세 곳은 모두 draft 일 때만
--      부르므로 정상 흐름에는 영향이 없다.
--
-- 적용 : Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
--        create or replace 라 데이터는 건드리지 않는다.
--
-- 확인 : 관리자·실무자로 draft 인 달을 마감하면 그대로 된다.
--        이미 마감된 달에 다시 마감하면 '이미 마감된 달입니다' 오류가 나야 한다.
-- ============================================================================

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
