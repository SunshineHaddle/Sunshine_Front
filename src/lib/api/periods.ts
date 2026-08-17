/** §4 — 월 회차 */
import { supabase } from '../supabase'
import { toPeriodDate, type CostPeriodRow } from '../types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/**
 * §4-1. 해당 월 회차를 확보한다. 없으면 만들고 있으면 기존 것을 준다.
 * @param month 'YYYY-MM' 형식. 내부에서 'YYYY-MM-01' 로 변환한다 (F-10)
 */
export async function ensurePeriod(month: string): Promise<CostPeriodRow> {
  return unwrap(
    await supabase
      .from('cost_periods')
      .upsert({ period: toPeriodDate(month) }, { onConflict: 'period' })
      .select('id, period, status, submitted_by, submitted_at')
      .single(),
  ) as CostPeriodRow
}

/** §4-2. 월 목록 (드롭다운용) */
export async function fetchPeriods(): Promise<CostPeriodRow[]> {
  return unwrap(
    await supabase
      .from('cost_periods')
      .select('id, period, status, submitted_by, submitted_at')
      .order('period', { ascending: false }),
  ) as CostPeriodRow[]
}

/**
 * 해당 월 회차를 찾기만 한다. 없으면 null.
 *
 * ensurePeriod 와 달리 만들지 않는다 — 대시보드처럼 조회만 하는 화면에서
 * upsert 를 쓰면 열어보기만 해도 빈 회차가 생긴다.
 * @param month 'YYYY-MM'
 */
export async function fetchPeriodByMonth(month: string): Promise<CostPeriodRow | null> {
  return unwrap(
    await supabase
      .from('cost_periods')
      .select('id, period, status, submitted_by, submitted_at')
      .eq('period', toPeriodDate(month))
      .maybeSingle(),
  ) as CostPeriodRow | null
}

/** 가장 최근 확정된 월. */
export async function fetchLatestConfirmedPeriod(): Promise<CostPeriodRow | null> {
  return unwrap(
    await supabase
      .from('cost_periods')
      .select('id, period, status, submitted_by, submitted_at')
      .eq('status', 'confirmed')
      .order('period', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as CostPeriodRow | null
}

/** 마감된 월을 다시 열어 수정 가능하게 만든다. */
export async function reopenPeriod(periodId: string) {
  unwrap(
    await supabase.from('cost_periods').update({ status: 'draft' }).eq('id', periodId).select(),
  )
}
