/**
 * Supabase/PostgREST 에러를 사용자가 읽을 수 있는 한글로 바꾼다.
 *
 * RLS 위반은 INSERT/UPDATE 에서 42501 로 올라오는데, 원문이
 * "new row violates row-level security policy for table ..." 이라
 * 실제 원인(마감된 달 / 권한 부족)이 화면에 드러나지 않는다.
 */

/** 월별 입력 테이블 — 마감(confirmed)되면 전원 쓰기가 막힌다 */
const PERIOD_LOCKED_TABLES = [
  'material_usages',
  'production_records',
  'operating_costs',
  'operating_cost_allocations',
  'file_uploads',
]

/** 마스터·결과 테이블 — 관리자만 쓸 수 있다 */
const ADMIN_ONLY_TABLES = ['products', 'recipe_items', 'product_cost_summaries', 'profiles']

const TABLE_LABEL: Record<string, string> = {
  material_usages: '원재료 투입내역',
  production_records: '생산량',
  operating_costs: '운영비',
  operating_cost_allocations: '운영비 배분',
  file_uploads: '원본 파일 이력',
  products: '제품',
  recipe_items: '배합',
  product_cost_summaries: '원가 결과',
  profiles: '사용자',
}

export function describeDbError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  if (!/row-level security/i.test(raw)) return raw

  const table = raw.match(/table "([^"]+)"/)?.[1] ?? ''
  const label = TABLE_LABEL[table] ?? table

  if (PERIOD_LOCKED_TABLES.includes(table)) {
    return `이 달은 이미 마감되어 ${label}을(를) 수정할 수 없습니다. `
      + '데이터 입력 3단계에서 마감을 취소한 뒤 다시 시도해주세요.'
  }

  if (ADMIN_ONLY_TABLES.includes(table)) {
    return `${label} 등록·수정은 관리자만 가능합니다. 관리자 계정으로 로그인해주세요.`
  }

  return `권한이 없어 저장되지 않았습니다. (${label || '알 수 없는 대상'})`
}
