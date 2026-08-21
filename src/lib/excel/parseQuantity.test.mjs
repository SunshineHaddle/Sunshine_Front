import assert from 'node:assert/strict'
import { parseQuantity, unitFromHeader } from './parseQuantity.ts'

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
