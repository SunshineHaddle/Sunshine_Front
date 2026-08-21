// node src/lib/api/profitFrom.test.mjs
import assert from 'node:assert/strict'
import { profitFrom } from './profit.ts'

// 포기김치 5월: 포장당 10,366원 · 판매가 17,200원
assert.deepEqual(profitFrom(10366, 17200), { marginRate: 39.73, costRate: 60.27, status: 'normal' })

// 같은 제품 8월: 배추값이 올라 마진이 얇아진다 (20% 미만 → watch)
assert.deepEqual(profitFrom(15068, 17200), { marginRate: 12.4, costRate: 87.6, status: 'watch' })

// 원가가 판매가를 넘으면 risk
assert.equal(profitFrom(20000, 17200).status, 'risk')
assert.ok(profitFrom(20000, 17200).marginRate < 0)

// 경계값 — 정확히 20% 는 normal, 그 아래가 watch
assert.equal(profitFrom(80, 100).status, 'normal')
assert.equal(profitFrom(80.5, 100).status, 'watch')
assert.equal(profitFrom(100, 100).marginRate, 0)
assert.equal(profitFrom(100, 100).status, 'watch')

// 판매가 미입력 — 마진율을 지어내지 않는다. 화면이 '판매가 미입력'으로 구분해 표시한다
assert.deepEqual(profitFrom(15068, 0), { marginRate: 0, costRate: 0, status: 'normal' })

console.log('ok')
