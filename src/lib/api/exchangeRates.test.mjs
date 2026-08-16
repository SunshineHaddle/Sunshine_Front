// node src/lib/api/exchangeRates.test.mjs — 환율 변환·변동률 self-check
import assert from 'node:assert/strict'

// 변환 규칙: API 는 "1 KRW = perKrw 외화" → 앱은 "1 외화 = 1/perKrw 원"
const invert = (perKrw) => 1 / perKrw

// USD: 1 KRW = 0.00071 USD → 1 USD ≈ 1408.45 원
assert.ok(Math.abs(invert(0.00071) - 1408.45) < 1, `USD 변환: ${invert(0.00071)}`)
// JPY: 1 KRW = 0.11267 JPY → 1 JPY ≈ 8.875 원
assert.ok(Math.abs(invert(0.11267) - 8.875) < 0.1, `JPY 변환: ${invert(0.11267)}`)

console.log('ok')
