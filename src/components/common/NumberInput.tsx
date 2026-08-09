import type { InputHTMLAttributes } from 'react'
import { formatWithCommas, stripFormatting } from '../../utils/number'

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
>

type NumberInputProps = NativeInputProps & {
  /** 표시할 값 (숫자 또는 문자열). 콤마 없이 넘겨도 자동으로 포맷된다. */
  value: string | number
  /** 콤마가 제거된 순수 숫자 문자열을 전달한다. */
  onValueChange: (rawValue: string) => void
  /** 소수 입력 허용 여부 (기본값: true). false면 정수만 입력 가능. */
  allowDecimal?: boolean
}

/**
 * 천 단위 콤마를 자동으로 표시하는 숫자 입력 필드.
 * 내부적으로 type="text" 를 사용하며, onValueChange 로는 콤마가 제거된 값을 전달한다.
 */
export function NumberInput({
  value,
  onValueChange,
  allowDecimal = true,
  ...rest
}: NumberInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={formatWithCommas(value)}
      onChange={(event) => {
        const raw = stripFormatting(event.target.value)
        // 숫자·소수점·음수부호만 허용
        const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/
        if (raw === '' || pattern.test(raw)) {
          onValueChange(raw)
        }
      }}
    />
  )
}
