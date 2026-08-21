// node src/pages/operating-cost-entry/shareSplit.test.mjs
// operatingCostModel.ts 의 equalShares / distributeByShares 와 같은 계산.
// 끝수 처리가 틀리면 배분 합계가 총액과 어긋나므로 여기서 지킨다.
import assert from 'node:assert/strict'

const toWonNumber = (value) => Math.max(0, Number(value) || 0)

function equalShares(productIds) {
  const shares = {}
  if (productIds.length === 0) return shares

  const even = Math.floor((100 / productIds.length) * 10) / 10
  let remaining = 100
  productIds.forEach((productId, index) => {
    const share = index === productIds.length - 1 ? Math.round(remaining * 10) / 10 : even
    remaining -= share
    shares[productId] = String(share)
  })

  return shares
}

function distributeByShares(total, shares, productIds) {
  const result = {}
  if (productIds.length === 0) return result

  let allocated = 0
  productIds.forEach((productId, index) => {
    const isLast = index === productIds.length - 1
    const amount = isLast
      ? Math.round(total - allocated)
      : Math.round((total * toWonNumber(shares[productId] ?? '0')) / 100)
    result[productId] = amount
    allocated += amount
  })

  return result
}

const sumShares = (shares) => Object.values(shares).reduce((sum, v) => sum + toWonNumber(v), 0)
const sumAmounts = (amounts) => Object.values(amounts).reduce((sum, v) => sum + v, 0)

// ── equalShares ─────────────────────────────────────────────
assert.deepEqual(equalShares([]), {})
assert.deepEqual(equalShares(['p1']), { p1: '100' })
assert.deepEqual(equalShares(['p1', 'p2']), { p1: '50', p2: '50' })

// 3등분처럼 나누어떨어지지 않아도 합은 정확히 100%
{
  const shares = equalShares(['p1', 'p2', 'p3'])
  assert.deepEqual(shares, { p1: '33.3', p2: '33.3', p3: '33.4' })
  assert.equal(sumShares(shares), 100)
}

// 제품 수가 많아도(7개) 마지막이 끝수를 흡수한다
for (const count of [3, 6, 7, 9, 11, 23]) {
  const ids = Array.from({ length: count }, (_, i) => `p${i}`)
  assert.equal(Math.round(sumShares(equalShares(ids)) * 10) / 10, 100, `${count}개 균등 분배`)
}

// ── distributeByShares ──────────────────────────────────────
assert.deepEqual(distributeByShares(100000, {}, []), {})

// 균등 분배한 비율로 나누면 총액이 보존된다 (1원도 새지 않는다)
{
  const ids = ['p1', 'p2', 'p3']
  const amounts = distributeByShares(100000, equalShares(ids), ids)
  assert.equal(sumAmounts(amounts), 100000)
  assert.deepEqual(amounts, { p1: 33300, p2: 33300, p3: 33400 })
}

// 손으로 넣은 비율도 그대로 반영된다
{
  const ids = ['p1', 'p2']
  assert.deepEqual(distributeByShares(1000000, { p1: '70', p2: '30' }, ids), { p1: 700000, p2: 300000 })
}

// 비율이 빠진 제품은 0원. 마지막 제품이 남은 금액을 받는다
{
  const ids = ['p1', 'p2', 'p3']
  const amounts = distributeByShares(90000, { p1: '50' }, ids)
  assert.deepEqual(amounts, { p1: 45000, p2: 0, p3: 45000 })
  assert.equal(sumAmounts(amounts), 90000)
}

// 총액 0 이면 전부 0
{
  const ids = ['p1', 'p2']
  assert.deepEqual(distributeByShares(0, equalShares(ids), ids), { p1: 0, p2: 0 })
}

// 나누어떨어지지 않는 금액도 총액이 어긋나지 않는다
for (const total of [1, 7, 999, 100001, 1234567]) {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
  assert.equal(sumAmounts(distributeByShares(total, equalShares(ids), ids)), total, `총액 ${total}`)
}

console.log('ok')
