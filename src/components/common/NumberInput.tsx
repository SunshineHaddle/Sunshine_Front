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
}

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
        const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/
        if (raw === '' || pattern.test(raw)) {
          onValueChange(raw)
        }
      }}
    />
  )
}
