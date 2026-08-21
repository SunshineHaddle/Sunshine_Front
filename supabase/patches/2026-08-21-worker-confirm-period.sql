-- ============================================================================
-- 패치 2026-08-21 : 실무자(worker)도 1단계에서 마감할 수 있게 한다
--
-- 배경 : 화면에서 실무자에게 마감 버튼을 열어줬지만, confirm_period 가
--        security invoker 라 product_cost_summaries 의 "admin write" 정책에
--        막혀 실무자가 누르면 RLS 오류가 났다.
-- 조치 : 함수만 security definer 로 바꾸고, 호출 권한은 is_editor() 로 직접 검사.
--        "원가 결과 열람은 관리자만"("admin read")은 그대로 유지된다.
--
-- 적용 : Supabase 대시보드 > SQL Editor 에 이 파일을 붙여넣고 Run.
--        create or replace 라 데이터는 건드리지 않는다. schema.sql 은 전체
--        재생성용(데이터 삭제)이므로 운영 DB 에 다시 돌리면 안 된다.
-- ============================================================================

-- security definer 인 이유: 실무자(entry)도 1단계에서 마감할 수 있어야 하는데
-- product_cost_summaries 는 "admin write" 정책이라 invoker 로는 insert 가 막힌다.
-- 결과를 *읽는* 권한("admin read")은 그대로 관리자 전용이라, 실무자는 계산만
-- 돌릴 뿐 원가 결과를 볼 수는 없다 (미팅 요구 그대로).
create or replace function confirm_period(p_period_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare affected int;
begin
  -- definer 는 RLS 를 지나치므로 호출 권한을 여기서 직접 막는다
  if not is_editor() then
    raise exception '마감 권한이 없습니다.' using errcode = '42501';
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
