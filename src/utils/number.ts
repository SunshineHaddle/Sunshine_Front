export function stripFormatting(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[,\s₩원]/g, '')
}

export function parseNumber(value: unknown): number {
  const parsed = Number(stripFormatting(value as string))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatWithCommas(value: string | number | null | undefined): string {
  const raw = stripFormatting(value)
  if (raw === '') return ''

  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw

  if (!/^\d*\.?\d*$/.test(unsigned)) return raw

  const [intPart, decimalPart] = unsigned.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  let result = withCommas
  if (unsigned.includes('.')) result += `.${decimalPart ?? ''}`
  return negative ? `-${result}` : result
}
