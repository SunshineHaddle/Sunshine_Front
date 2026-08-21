/**
 * 수익성 계산. supabase 를 import 하지 않는 순수 모듈이라
 * 테스트가 이 파일을 그대로 읽는다 (results.ts 는 supabase 클라이언트를
 * 만들기 때문에 Node 에서 바로 import 할 수 없다).
 */
import type { ProfitStatus } from '../types'

/**
 * 판매가는 스냅샷 대신 `products` 의 현재 값을 쓴다.
 *
 * `confirm_period()` 는 마감 시점의 판매가를 스냅샷에 복사한다. 그래서
 * 마감을 먼저 하고 나중에 판매가를 입력하면 표에 0 원이 박힌 채로 남았다.
 * 고치려면 그 달 마감을 취소하고 다시 계산해야 했다.
 *
 * 원가(재료비·인건비·경비·단위원가)는 여전히 스냅샷 그대로다 — 굳히는 이유는
 * 지난달 원가가 소급 변경되지 않게 하려는 것이고(②), 판매가는 원가가 아니다.
 *
 * 대신 **판매가를 바꾸면 과거 달 마진율도 함께 바뀐다.** 그때 팔던 가격으로
 * 고정하고 싶어지면 아래 salePrice 를 스냅샷 값으로 되돌리면 된다.
 */
export function profitFrom(unitCost: number, salePrice: number): {
  marginRate: number
  costRate: number
  status: ProfitStatus
} {
  if (salePrice <= 0) return { marginRate: 0, costRate: 0, status: 'normal' }

  // confirm_period() 의 계산과 같은 식·같은 임계값을 쓴다
  const marginRate = Math.round((1 - unitCost / salePrice) * 100 * 100) / 100
  const costRate = Math.round((unitCost / salePrice) * 100 * 100) / 100
  const status: ProfitStatus = marginRate < 0 ? 'risk' : marginRate < 20 ? 'watch' : 'normal'
  return { marginRate, costRate, status }
}
