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
 * 마감 직전 재료비 근거 검증.
 *
 * confirm_period() 의 재료비는 `실적 있으면 material_usages, 없으면 recipe_items × 생산량`이다.
 * 둘 다 0 이면 **재료비 0 원**이 조용히 확정된다 — 에러도, 0 행도 아니고 그냥 0 이다.
 *
 * 실제 DB 가 그 상태다. 표준 배합(recipe_items)은 수량이 0 이거나 아예 비어 있고
 * (엑셀에서 자동 등록된 제품은 재료 목록만 만들어지고 값이 0 으로 들어간다),
 * 지금은 모든 달에 수불자료가 있어 드러나지 않을 뿐이다.
 * 엑셀을 올리지 않은 달을 마감하는 순간 전 제품의 재료비가 0 이 된다.
 *
 * 생산량 검증과 같은 이유로 막지는 않고 경고만 한다 — 고객이 오차 허용을 요구했다.
 */
export type CostBasisIssue = {
  productId: string
  name: string
  /** 생산량 kg */
  outputKg: number
  /** 'no-usage' : 수불자료도 배합도 없다 · 'zero-usage' : 수불자료는 있는데 금액이 0 */
  reason: 'no-usage' | 'zero-usage'
}

/**
 * 재료비가 0 으로 계산될 제품을 찾는다.
 *
 * @param productions   그 달 생산량
 * @param usageTotals   그 달 투입 실적 (금액 합계 포함)
 * @param standardCosts 제품 1kg 표준 배합 원가 = recipe_items 의 amount 합
 */
export function findMissingCostBasis(
  productions: { productId: string; name: string; production: number }[],
  usageTotals: { productId: string; totalAmount: number }[],
  standardCosts: { productId: string; unitMaterialCost: number }[],
): CostBasisIssue[] {
  const usageById = new Map(usageTotals.map((row) => [row.productId, row.totalAmount]))
  const standardById = new Map(standardCosts.map((row) => [row.productId, row.unitMaterialCost]))
  const issues: CostBasisIssue[] = []

  for (const record of productions) {
    // 생산량이 없으면 애초에 계산 대상이 아니다. 그건 findProductionIssues 가 본다
    if (record.production <= 0) continue

    const usageAmount = usageById.get(record.productId)
    // 수불자료가 있고 금액도 잡혀 있으면 실측으로 계산된다 — 문제없다
    if (usageAmount !== undefined && usageAmount > 0) continue
    // 실적이 없어도 표준 배합에 값이 있으면 배합 × 생산량으로 계산된다
    if (usageAmount === undefined && (standardById.get(record.productId) ?? 0) > 0) continue

    issues.push({
      productId: record.productId,
      name: record.name,
      outputKg: record.production,
      reason: usageAmount === undefined ? 'no-usage' : 'zero-usage',
    })
  }

  return issues
}

/** 확인 다이얼로그에 넣을 문구 */
export function describeCostBasis(issues: CostBasisIssue[]): string {
  const lines = issues.map((issue) => {
    const why = issue.reason === 'no-usage'
      ? '수불자료가 없고 표준 배합도 비어 있음'
      : '수불자료는 있으나 금액이 0 원'
    return `· ${issue.name}: 생산 ${kg(issue.outputKg)}\n  ${why}`
  })

  return (
    `재료비가 0 원으로 계산될 제품이 ${issues.length}개 있습니다.\n\n`
    + `${lines.join('\n')}\n\n`
    + '1단계에서 수불자료를 올리거나, 제품 상세의 "표준 배합 수정"에서\n'
    + '배합 수량·단가를 채운 뒤 마감하세요.\n\n'
    + '이대로 마감하면 재료비 0 원이 그대로 저장되고,\n'
    + '고치려면 마감을 취소하고 다시 계산해야 합니다.\n\n'
    + '그래도 계속할까요?'
  )
}
