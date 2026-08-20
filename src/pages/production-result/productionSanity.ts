/**
 * 마감 직전 생산량 검증.
 *
 * 김치는 절임·탈수로 무게가 줄고 양념으로 다시 붙는다. 실제 장부를 보면
 * 생산량은 투입 총량의 대략 85~95% 선이다. 그 범위를 크게 벗어나면
 * 대개 자릿수를 잘못 적은 것이다 (847톤 투입에 생산량 24kg 같은 사례가 실제로 있었다).
 *
 * DB 는 이런 값을 막지 않는다. margin_rate 를 numeric(12,2) 로 넓힌 뒤로는
 * 오버플로 에러조차 나지 않아, 틀린 원가가 조용히 확정된다.
 *
 * 고객이 "오차 허용, 현실적인 수준의 정확성"을 요구했으므로 막지 않고 경고만 한다.
 */

/** 이 배수 밖이면 자릿수 실수로 본다. 정상 범위(0.85~0.95)보다 넉넉하게 잡았다 */
const MIN_RATIO = 0.5
const MAX_RATIO = 1.5

export type ProductionIssue = {
  productId: string
  name: string
  /** 투입 총량 kg */
  inputKg: number
  /** 생산량 kg */
  outputKg: number
  /** outputKg / inputKg. inputKg 이 0 이면 null */
  ratio: number | null
  reason: 'missing' | 'too-low' | 'too-high'
}

const REASON_TEXT: Record<ProductionIssue['reason'], string> = {
  missing: '생산량이 비어 있음',
  'too-low': '생산량이 투입량에 비해 너무 적음',
  'too-high': '생산량이 투입량보다 지나치게 많음',
}

/**
 * 투입량과 생산량을 대조해 의심스러운 제품을 찾는다.
 * 투입 실적이 없는 제품(표준원가로 계산되는 제품)은 비교 대상이 아니다.
 */
export function findProductionIssues(
  usageTotals: { productId: string; totalUsage: number }[],
  productions: { productId: string; name: string; production: number }[],
): ProductionIssue[] {
  const productionById = new Map(productions.map((p) => [p.productId, p]))
  const issues: ProductionIssue[] = []

  for (const { productId, totalUsage } of usageTotals) {
    if (totalUsage <= 0) continue

    const record = productionById.get(productId)
    const name = record?.name ?? '(이름 없는 제품)'
    const outputKg = record?.production ?? 0

    if (outputKg <= 0) {
      issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio: null, reason: 'missing' })
      continue
    }

    const ratio = outputKg / totalUsage
    if (ratio < MIN_RATIO) {
      issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio, reason: 'too-low' })
    } else if (ratio > MAX_RATIO) {
      issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio, reason: 'too-high' })
    }
  }

  return issues
}

const kg = (n: number) => `${Math.round(n).toLocaleString('ko-KR')} kg`

/** 확인 다이얼로그에 넣을 문구 */
export function describeIssues(issues: ProductionIssue[]): string {
  const lines = issues.map((issue) => {
    const ratio = issue.ratio === null ? '' : ` (투입의 ${Math.round(issue.ratio * 100)}%)`
    return `· ${issue.name}: 투입 ${kg(issue.inputKg)} → 생산 ${kg(issue.outputKg)}${ratio}\n  ${REASON_TEXT[issue.reason]}`
  })

  return (
    `생산량이 투입량과 크게 어긋나는 제품이 ${issues.length}개 있습니다.\n\n`
    + `${lines.join('\n')}\n\n`
    + '보통 생산량은 투입 총량의 85~95% 입니다.\n'
    + '자릿수를 잘못 입력하면 단위원가가 수백 배로 계산됩니다.\n\n'
    + '이대로 원가를 계산할까요?'
  )
}

/**
 * 마감 차단 검사.
 *
 * 위의 두 검사(⑧ 생산량, ⑬ 재료비 근거)는 경고만 하고 통과시킨다.
 * 이건 다르다 — **막는다.**
 *
 * 정보가 비어 있는 채로 마감된 제품은 나중에 손댈 수가 없다.
 * 마감된 달의 자료는 삭제도 수정도 RLS 가 막고(⑪), 되돌리려면 그 달 전체를
 * 다시 열어 재계산해야 한다. 그 과정에서 과거 원가 스냅샷이 바뀐다(②).
 * 들어가기 전에 세우는 편이 싸다.
 *
 * 제품 상세 화면의 값들이 여기서 만들어진다:
 *   재료비   ← material_usages 금액 (또는 recipe_items × 생산량)
 *   부자재비 ← operating_cost_allocations 의 labor + 나머지 카테고리
 *   원재료비 상세 ← 그 달 material_usages 행
 */
export type ConfirmBlocker = {
  productId: string
  name: string
  /** 비어 있는 항목들 */
  missing: ('원재료비 상세' | '재료비' | '부자재비')[]
}

/**
 * @param productions   그 달 생산량
 * @param usageTotals   그 달 투입 실적 (행 수·금액)
 * @param standardCosts 제품 1kg 표준 배합 원가
 * @param allocations   제품별 운영비 배분액. material_cost 자동배분은
 *                      마감 시점에 계산되므로 hasAutoBasis 로 따로 받는다
 * @param hasAutoBasis  그 달에 재료비 비중 자동배분 운영비가 있는가
 */
export function findConfirmBlockers(
  productions: { productId: string; name: string; production: number }[],
  usageTotals: { productId: string; totalAmount: number; rowCount: number }[],
  standardCosts: { productId: string; unitMaterialCost: number }[],
  allocations: { productId: string; amount: number }[],
  hasAutoBasis: boolean,
): ConfirmBlocker[] {
  const usageById = new Map(usageTotals.map((row) => [row.productId, row]))
  const standardById = new Map(standardCosts.map((row) => [row.productId, row.unitMaterialCost]))

  const allocById = new Map<string, number>()
  for (const row of allocations) {
    allocById.set(row.productId, (allocById.get(row.productId) ?? 0) + row.amount)
  }

  const blockers: ConfirmBlocker[] = []

  for (const record of productions) {
    // 생산량이 없는 제품은 애초에 계산 대상이 아니다
    if (record.production <= 0) continue

    const usage = usageById.get(record.productId)
    const missing: ConfirmBlocker['missing'] = []

    // 원재료비 상세 박스 = 그 달 material_usages 행
    if (!usage || usage.rowCount === 0) missing.push('원재료비 상세')

    // 재료비 = 실적 금액, 없으면 배합 × 생산량
    const materialCost = usage && usage.totalAmount > 0
      ? usage.totalAmount
      : record.production * (standardById.get(record.productId) ?? 0)
    if (materialCost <= 0) missing.push('재료비')

    // 부자재비 = 운영비 배분. 자동배분은 재료비가 있어야 몫이 생긴다
    const allocated = allocById.get(record.productId) ?? 0
    if (allocated <= 0 && !(hasAutoBasis && materialCost > 0)) missing.push('부자재비')

    if (missing.length > 0) {
      blockers.push({ productId: record.productId, name: record.name, missing })
    }
  }

  return blockers
}

/** 마감을 막을 때 띄울 문구 */
export function describeBlockers(blockers: ConfirmBlocker[]): string {
  const lines = blockers.map((b) => `· ${b.name}: ${b.missing.join(' · ')} 없음`)

  return (
    `값이 비어 있는 제품이 ${blockers.length}개 있어 마감할 수 없습니다.\n\n`
    + `${lines.join('\n')}\n\n`
    + '채우는 곳\n'
    + '  원재료비 상세 · 재료비 → 1단계에서 수불자료(.xlsx)를 올리세요\n'
    + '  부자재비 → 2단계에서 인건비·경비를 입력하세요\n\n'
    + '비어 있는 채로 마감하면 그 값이 그대로 굳고,\n'
    + '고치려면 그 달 전체의 마감을 취소해 다시 계산해야 합니다.'
  )
}
