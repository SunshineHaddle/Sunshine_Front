/**
 * 수불자료 수량 칸의 단위 해석.
 *
 * 장부는 손으로 쓰던 걸 옮긴 것이라 숫자 옆에 단위가 붙는 일이 잦다
 * ('12.5kg', '300 g', '20개', '3박스'). 예전 파서는 이런 칸을 그냥 NaN 으로
 * 흘려보내고 "비어 있음"으로 보고해서, 값이 조용히 빠진 채 저장됐다.
 *
 * material_usages 는 kg 으로만 저장한다(commitSubul 이 unit: 'kg' 고정).
 * 그래서 무게 단위는 kg 으로 환산하고, 무게가 아닌 단위(개·박스)는
 * 환산할 방법이 없으므로 저장을 막는다.
 */

export type QuantityUnit = 'kg' | 'g' | 't'

/** kg 으로 바꾸는 배수 */
const WEIGHT_FACTOR: Record<QuantityUnit, number> = {
  kg: 1,
  g: 0.001,
  t: 1000,
}

/** 표기 흔들림을 하나로 모은다 */
const WEIGHT_ALIASES: Record<string, QuantityUnit> = {
  kg: 'kg', KG: 'kg', 킬로: 'kg', 킬로그램: 'kg', 키로: 'kg',
  g: 'g', gram: 'g', grams: 'g', 그램: 'g',
  t: 't', ton: 't', tons: 't', 톤: 't',
}

/** 무게가 아니라 개수를 세는 단위. kg 으로 환산할 수 없다 */
const COUNT_UNITS = new Set([
  '개', '개수', 'ea', 'EA', 'pcs', 'pc',
  '박스', 'box', 'BOX', '상자',
  '팩', 'pack', 'PACK', '봉', '봉지', '포', '포대', '자루',
  '병', '캔', '통', '말',
])

/** 부피 단위도 무게로 바꿀 수 없다 (비중을 모른다) */
const VOLUME_UNITS = new Set(['l', 'L', 'ml', 'mL', '리터', '밀리리터', 'cc'])

export type QuantityResult =
  | { ok: true; qty: number; /** 원본에 단위가 있었고 환산했다면 그 표기 */ convertedFrom?: string }
  | { ok: false; reason: string }

/**
 * 수량 칸 하나를 kg 숫자로 바꾼다.
 *
 * @param raw       셀 값 (숫자이거나 '12.5kg' 같은 문자열)
 * @param headerUnit 헤더가 '수량(g)' 처럼 단위를 선언했다면 그 단위.
 *                   셀에 단위가 없을 때의 기본값이 된다.
 */
export function parseQuantity(raw: unknown, headerUnit: QuantityUnit = 'kg'): QuantityResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, reason: '비어 있음' }
  }

  // 엑셀이 숫자로 준 값에는 단위가 붙을 수 없다. 헤더 단위만 적용한다.
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '숫자가 아님' }
    if (raw < 0) return { ok: false, reason: '음수' }
    const qty = raw * WEIGHT_FACTOR[headerUnit]
    return headerUnit === 'kg'
      ? { ok: true, qty }
      : { ok: true, qty, convertedFrom: headerUnit }
  }

  const text = String(raw).trim()
  if (text === '') return { ok: false, reason: '비어 있음' }

  // 숫자부 + 단위부로 가른다. '1,234.5 kg' '300g' '20 개' 모두 처리한다.
  const matched = text.match(/^([+-]?[\d,\s]*\.?\d+)\s*(.*)$/)
  if (!matched) {
    return { ok: false, reason: `숫자를 찾을 수 없음 ('${text}')` }
  }

  const number = Number(matched[1].replace(/[,\s]/g, ''))
  if (!Number.isFinite(number)) return { ok: false, reason: `숫자가 아님 ('${text}')` }
  if (number < 0) return { ok: false, reason: `음수 ('${text}')` }

  // 단위부에서 괄호·슬래시 뒤 설명을 떼어낸다. 'kg(정미)' '개/박스' → 'kg' '개'
  const suffix = matched[2].replace(/[()[\]{}].*$/, '').split('/')[0].trim()

  if (suffix === '') {
    const qty = number * WEIGHT_FACTOR[headerUnit]
    return headerUnit === 'kg'
      ? { ok: true, qty }
      : { ok: true, qty, convertedFrom: headerUnit }
  }

  if (COUNT_UNITS.has(suffix)) {
    return {
      ok: false,
      reason: `'${suffix}' 는 개수 단위라 kg 으로 바꿀 수 없음 ('${text}')`,
    }
  }

  if (VOLUME_UNITS.has(suffix)) {
    return {
      ok: false,
      reason: `'${suffix}' 는 부피 단위라 kg 으로 바꿀 수 없음 ('${text}')`,
    }
  }

  const unit = WEIGHT_ALIASES[suffix] ?? WEIGHT_ALIASES[suffix.toLowerCase()]
  if (!unit) {
    return { ok: false, reason: `알 수 없는 단위 '${suffix}' ('${text}')` }
  }

  const qty = number * WEIGHT_FACTOR[unit]
  return unit === 'kg' ? { ok: true, qty } : { ok: true, qty, convertedFrom: unit }
}

/**
 * 단가 칸. '1,200원' '1200 원/kg' 을 숫자로 바꾼다.
 * 통화·단위 표기는 정보가 없어도 되므로 떼어내고 숫자만 본다.
 */
export function parsePrice(raw: unknown): QuantityResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, reason: '비어 있음' }
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '숫자가 아님' }
    if (raw < 0) return { ok: false, reason: '음수' }
    return { ok: true, qty: raw }
  }

  const text = String(raw).trim()
  const cleaned = text.replace(/[₩,\s]/g, '').replace(/원(\/.*)?$/, '')
  if (cleaned === '') return { ok: false, reason: '비어 있음' }

  const number = Number(cleaned)
  if (!Number.isFinite(number)) return { ok: false, reason: `숫자가 아님 ('${text}')` }
  if (number < 0) return { ok: false, reason: `음수 ('${text}')` }
  return { ok: true, qty: number }
}

/** '수량(g)' 처럼 헤더에 선언된 단위를 읽는다. 없으면 kg 으로 본다 */
export function unitFromHeader(headerText: unknown): QuantityUnit {
  const inside = String(headerText ?? '').match(/[([]([^)\]]+)[)\]]/)?.[1]?.trim()
  if (!inside) return 'kg'
  return WEIGHT_ALIASES[inside] ?? WEIGHT_ALIASES[inside.toLowerCase()] ?? 'kg'
}
