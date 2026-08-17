// node src/pages/production-result/productionSanity.test.mjs
import assert from 'node:assert/strict'

const MIN_RATIO = 0.5
const MAX_RATIO = 1.5

function findProductionIssues(usageTotals, productions) {
  const productionById = new Map(productions.map((p) => [p.productId, p]))
  const issues = []
  for (const { productId, totalUsage } of usageTotals) {
    if (totalUsage <= 0) continue
    const record = productionById.get(productId)
    const name = record?.name ?? '(이름 없는 제품)'
    const outputKg = record?.production ?? 0
    if (outputKg <= 0) {
      issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio: null, reason: 'missing' })
      continue
    }
    const ratio = outputKg / totalUsage
    if (ratio < MIN_RATIO) issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio, reason: 'too-low' })
    else if (ratio > MAX_RATIO) issues.push({ productId, name, inputKg: totalUsage, outputKg, ratio, reason: 'too-high' })
  }
  return issues
}

// 실제로 있었던 사고: 포기김치 847톤 투입에 생산량 24kg
{
  const issues = findProductionIssues(
    [{ productId: 'p1', totalUsage: 847366 }],
    [{ productId: 'p1', name: '포기김치', production: 24 }],
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0].reason, 'too-low')
  assert.equal(issues[0].name, '포기김치')
}

// 정상 범위 (투입의 94%) — 경고하지 않는다
assert.deepEqual(
  findProductionIssues(
    [{ productId: 'p1', totalUsage: 847366 }],
    [{ productId: 'p1', name: '포기김치', production: 796500 }],
  ),
  [],
)

// 경계값: 정확히 0.5 / 1.5 는 통과 (미만·초과만 잡는다)
assert.equal(findProductionIssues([{ productId: 'p', totalUsage: 100 }], [{ productId: 'p', name: 'x', production: 50 }]).length, 0)
assert.equal(findProductionIssues([{ productId: 'p', totalUsage: 100 }], [{ productId: 'p', name: 'x', production: 150 }]).length, 0)
assert.equal(findProductionIssues([{ productId: 'p', totalUsage: 100 }], [{ productId: 'p', name: 'x', production: 49 }])[0].reason, 'too-low')
assert.equal(findProductionIssues([{ productId: 'p', totalUsage: 100 }], [{ productId: 'p', name: 'x', production: 151 }])[0].reason, 'too-high')

// 생산량 미입력
{
  const issues = findProductionIssues(
    [{ productId: 'p1', totalUsage: 5000 }],
    [{ productId: 'p1', name: '갓김치', production: 0 }],
  )
  assert.equal(issues[0].reason, 'missing')
  assert.equal(issues[0].ratio, null)
}

// production_records 자체가 없는 경우도 미입력으로 본다
assert.equal(
  findProductionIssues([{ productId: 'p9', totalUsage: 5000 }], [])[0].reason,
  'missing',
)

// 투입 실적이 없는 제품(표준원가 계산 대상)은 비교하지 않는다
assert.deepEqual(findProductionIssues([], [{ productId: 'p1', name: '물김치', production: 300000 }]), [])
assert.deepEqual(findProductionIssues([{ productId: 'p1', totalUsage: 0 }], [{ productId: 'p1', name: 'x', production: 0 }]), [])

// 여러 제품이 섞여도 문제 있는 것만 골라낸다
{
  const issues = findProductionIssues(
    [
      { productId: 'a', totalUsage: 1000 },
      { productId: 'b', totalUsage: 1000 },
      { productId: 'c', totalUsage: 1000 },
    ],
    [
      { productId: 'a', name: '정상', production: 900 },
      { productId: 'b', name: '너무적음', production: 10 },
      { productId: 'c', name: '너무많음', production: 9000 },
    ],
  )
  assert.deepEqual(issues.map((i) => i.name), ['너무적음', '너무많음'])
}

console.log('ok')
