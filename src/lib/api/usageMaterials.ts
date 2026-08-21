/**
 * 제품 관리 카드의 '투입 재료' 를 만드는 규칙.
 *
 * production.ts 에서 떼어냈다 — 그쪽은 supabase 를 import 해서 Node 가
 * 바로 읽지 못한다. 규칙만 따로 두면 테스트가 실제 코드를 검증할 수 있다.
 */
// types.ts 를 import 하지 않고 한 줄 옮겨 둔다. Node 의 타입 스트리핑은
// 상대 경로에 확장자를 요구하는데, .ts 를 붙이면 이번엔 빌드 설정과 어긋난다.
// 이 파일이 순수하게 남아야 테스트가 그대로 읽을 수 있다.
const num = (v: unknown) => Number(v ?? 0) || 0

/** 제품별 최근 투입 재료. 제품 관리 카드가 쓴다 */
export type ProductMaterialNames = Record<string, { month: string; names: string[] }>

/** groupLatestUsageMaterials 가 받는 행. 조회 결과의 필요한 부분만 */
export type UsageMaterialRow = {
  product_id: string
  amount: number
  materials: { name: string } | null
  cost_periods: { period: string } | null
}

/**
 * 조회 결과를 제품별 '최근 달의 재료 이름'으로 접는다.
 *
 * 조회에서 떼어낸 이유는 테스트가 이 규칙을 직접 검증할 수 있게 하기 위해서다 —
 * 어느 달을 고르는지, 같은 재료가 두 번 나오면 어떻게 되는지가 화면에 그대로 뜬다.
 */
export function groupLatestUsageMaterials(rows: UsageMaterialRow[]): ProductMaterialNames {
  /** 제품별 최근 달 */
  const latest = new Map<string, string>()
  for (const row of rows) {
    const period = row.cost_periods?.period
    if (!period) continue
    const seen = latest.get(row.product_id)
    if (!seen || period > seen) latest.set(row.product_id, period)
  }

  const grouped: ProductMaterialNames = {}
  for (const [productId, period] of latest) {
    const lines = rows.filter(
      (row) => row.product_id === productId && row.cost_periods?.period === period,
    )
    // 금액이 큰 재료가 앞에 온다. 제품 상세의 원재료비 상세와 같은 순서
    const names = [...new Set(
      lines
        .sort((a, b) => num(b.amount) - num(a.amount))
        .map((row) => row.materials?.name)
        .filter((name): name is string => Boolean(name)),
    )]
    if (names.length > 0) grouped[productId] = { month: period.slice(0, 7), names }
  }

  return grouped
}
