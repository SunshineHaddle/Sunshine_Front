import type { InputHTMLAttributes } from 'react'
import { formatWithCommas, stripFormatting } from '../../utils/number'

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
>

type NumberInputProps = NativeInputProps & {
  value: string | number
  onValueChange: (rawValue: string) => void
  allowDecimal?: boolean
  /**
   * 음수 허용 여부. **기본은 막는다.**
   *
   * 이 화면의 숫자는 생산량·수량·단가·판매가라 전부 0 이상이다. 그런데 음수가
   * 들어가면 조용히 사라진다 — 생산량이 -5000 이면 confirm_period 는
   * `production_qty > 0` 이 아니라 단위원가를 0 으로 두고, 수익성 표는
   * `.gt('production_qty', 0)` 으로 그 행을 아예 뺀다. 자릿수 실수(⑧)는
   * 경고라도 뜨는데 부호 실수는 제품이 통째로 없어져 발견이 더 어렵다.
   */
  allowNegative?: boolean
}

export function NumberInput({
  value,
  onValueChange,
  allowDecimal = true,
  allowNegative = false,
  ...rest
}: NumberInputProps) {
  const pattern = allowNegative
    ? (allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/)
    : (allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/)

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={formatWithCommas(value)}
      onChange={(event) => {
        const raw = stripFormatting(event.target.value)
        if (raw === '' || pattern.test(raw)) {
          onValueChange(raw)
        }
      }}
    />
  )
}
