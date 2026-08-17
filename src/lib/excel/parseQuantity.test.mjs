// node src/lib/excel/parseQuantity.test.mjs — 수량·단가 단위 해석 self-check
import assert from 'node:assert/strict'

// parseQuantity.ts 의 로직만 복사 (ts 런타임 없이 검증)
const WEIGHT_FACTOR = { kg: 1, g: 0.001, t: 1000 }
const WEIGHT_ALIASES = {
  kg: 'kg', KG: 'kg', 킬로: 'kg', 킬로그램: 'kg', 키로: 'kg',
  g: 'g', gram: 'g', grams: 'g', 그램: 'g',
  t: 't', ton: 't', tons: 't', 톤: 't',
}
const COUNT_UNITS = new Set([
  '개', '개수', 'ea', 'EA', 'pcs', 'pc',
  '박스', 'box', 'BOX', '상자',
  '팩', 'pack', 'PACK', '봉', '봉지', '포', '포대', '자루',
  '병', '캔', '통', '말',
])
const VOLUME_UNITS = new Set(['l', 'L', 'ml', 'mL', '리터', '밀리리터', 'cc'])

function parseQuantity(raw, headerUnit = 'kg') {
  if (raw === null || raw === undefined || raw === '') return { ok: false, reason: '비어 있음' }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: '숫자가 아님' }
    if (raw < 0) return { ok: false, reason: '음수' }
    const qty = raw * WEIGHT_FACTOR[headerUnit]
    return headerUnit === 'kg' ? { ok: true, qty } : { ok: true, qty, convertedFrom: headerUnit }
  }
  const text = String(raw).trim()
  if (text === '') return { ok: false, reason: '비어 있음' }
  const matched = text.match(/^([+-]?[\d,\s]*\.?\d+)\s*(.*)$/)
  if (!matched) return { ok: false, reason: `숫자를 찾을 수 없음 ('${text}')` }
  const number = Number(matched[1].replace(/[,\s]/g, ''))
  if (!Number.isFinite(number)) return { ok: false, reason: `숫자가 아님 ('${text}')` }
  if (number < 0) return { ok: false, reason: `음수 ('${text}')` }
  const suffix = matched[2].replace(/[()[\]{}].*$/, '').split('/')[0].trim()
  if (suffix === '') {
    const qty = number * WEIGHT_FACTOR[headerUnit]
    return headerUnit === 'kg' ? { ok: true, qty } : { ok: true, qty, convertedFrom: headerUnit }
  }
  if (COUNT_UNITS.has(suffix)) return { ok: false, reason: `'${suffix}' 는 개수 단위` }
  if (VOLUME_UNITS.has(suffix)) return { ok: false, reason: `'${suffix}' 는 부피 단위` }
  const unit = WEIGHT_ALIASES[suffix] ?? WEIGHT_ALIASES[suffix.toLowerCase()]
  if (!unit) return { ok: false, reason: `알 수 없는 단위 '${suffix}'` }
  const qty = number * WEIGHT_FACTOR[unit]
  return unit === 'kg' ? { ok: true, qty } : { ok: true, qty, convertedFrom: unit }
}

function unitFromHeader(headerText) {
  const inside = String(headerText ?? '').match(/[([]([^)\]]+)[)\]]/)?.[1]?.trim()
  if (!inside) return 'kg'
  return WEIGHT_ALIASES[inside] ?? WEIGHT_ALIASES[inside.toLowerCase()] ?? 'kg'
}

// ── 숫자 그대로 (기존 양식) ───────────────────────────────
assert.deepEqual(parseQuantity(606248), { ok: true, qty: 606248 })
assert.deepEqual(parseQuantity('1,234.5'), { ok: true, qty: 1234.5 })
assert.deepEqual(parseQuantity('1 234'), { ok: true, qty: 1234 })

// ── 무게 단위가 붙은 경우 → kg 으로 환산 ──────────────────
assert.deepEqual(parseQuantity('12.5kg'), { ok: true, qty: 12.5 })
assert.deepEqual(parseQuantity('300 g'), { ok: true, qty: 0.3, convertedFrom: 'g' })
assert.deepEqual(parseQuantity('300그램'), { ok: true, qty: 0.3, convertedFrom: 'g' })
assert.deepEqual(parseQuantity('2 ton'), { ok: true, qty: 2000, convertedFrom: 't' })
assert.deepEqual(parseQuantity('5 KG'), { ok: true, qty: 5 })
// 괄호·슬래시 뒤 설명은 떼어낸다
assert.deepEqual(parseQuantity('5kg(정미)'), { ok: true, qty: 5 })

// ── 개수·부피 단위는 막는다 (kg 으로 바꿀 수 없다) ────────
for (const bad of ['20개', '3박스', '10 EA', '5팩', '2상자']) {
  assert.equal(parseQuantity(bad).ok, false, `${bad} 는 막혀야 한다`)
}
for (const bad of ['10L', '500ml', '3리터']) {
  assert.equal(parseQuantity(bad).ok, false, `${bad} 는 막혀야 한다`)
}

// ── 헤더가 단위를 선언한 경우 ─────────────────────────────
assert.equal(unitFromHeader('수량(kg)'), 'kg')
assert.equal(unitFromHeader('수량(g)'), 'g')
assert.equal(unitFromHeader('수량'), 'kg')
// 헤더가 g 면 단위 없는 숫자도 g 로 본다
assert.deepEqual(parseQuantity(500, 'g'), { ok: true, qty: 0.5, convertedFrom: 'g' })
// 셀에 붙은 단위가 헤더보다 우선한다
assert.deepEqual(parseQuantity('2kg', 'g'), { ok: true, qty: 2 })

// ── 잘못된 값 ─────────────────────────────────────────────
assert.equal(parseQuantity('').ok, false)
assert.equal(parseQuantity(null).ok, false)
assert.equal(parseQuantity('미상').ok, false)
assert.equal(parseQuantity('-5').ok, false)
assert.equal(parseQuantity('10말리').ok, false) // 알 수 없는 단위

console.log('ok')
