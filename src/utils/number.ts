// 숫자 입력 필드에서 천 단위 콤마 표시를 위한 유틸리티

/** 문자열/숫자에서 콤마·공백·통화기호를 제거한 순수 숫자 문자열을 반환 */
export function stripFormatting(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[,\s₩원]/g, '')
}

/** 콤마가 포함된 표시용 문자열을 숫자로 파싱 (실패 시 0) */
export function parseNumber(value: unknown): number {
  const parsed = Number(stripFormatting(value as string))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * 입력 중인 값에 천 단위 콤마를 붙여 표시용 문자열로 변환한다.
 * - 정수부에만 콤마를 넣고 소수부/입력 중인 소수점은 그대로 유지한다.
 * - 빈 문자열, '-', 소수점만 있는 경우 등 입력 중간 상태를 보존한다.
 */
export function formatWithCommas(value: string | number | null | undefined): string {
  const raw = stripFormatting(value)
  if (raw === '') return ''

  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw

  // 숫자·소수점 외 문자가 섞이면 그대로 반환 (파싱 실패 대비)
  if (!/^\d*\.?\d*$/.test(unsigned)) return raw

  const [intPart, decimalPart] = unsigned.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  let result = withCommas
  if (unsigned.includes('.')) result += `.${decimalPart ?? ''}`
  return negative ? `-${result}` : result
}
