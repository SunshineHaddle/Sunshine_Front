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
