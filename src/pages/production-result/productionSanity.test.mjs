// node src/pages/production-result/productionSanity.test.mjs
import assert from 'node:assert/strict'
import { findConfirmBlockers, findProductionIssues } from './productionSanity.ts'

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

// ── findConfirmBlockers ─────────────────────────────────────

const OK_USAGE = [{ productId: 'p1', totalAmount: 249_000_000, rowCount: 17 }]
const OK_ALLOC = [{ productId: 'p1', amount: 53_000_000 }]
const PROD = [{ productId: 'p1', name: '포기김치', production: 300000 }]
const NO_RECIPE = [{ productId: 'p1', unitMaterialCost: 0 }]

// 다 갖춰지면 막지 않는다
assert.deepEqual(findConfirmBlockers(PROD, OK_USAGE, NO_RECIPE, OK_ALLOC, false), [])

// 수불자료를 안 올린 달 — 원재료비 상세와 재료비가 함께 빈다
{
  const b = findConfirmBlockers(PROD, [], NO_RECIPE, OK_ALLOC, false)
  assert.deepEqual(b[0].missing, ['원재료비 상세', '재료비'])
}

// 2단계를 안 한 달 — 부자재비만 빈다
{
  const b = findConfirmBlockers(PROD, OK_USAGE, NO_RECIPE, [], false)
  assert.deepEqual(b[0].missing, ['부자재비'])
}

// 재료비 비중 자동배분은 마감 시점에 계산되므로 배분 행이 없어도 통과시킨다
assert.deepEqual(findConfirmBlockers(PROD, OK_USAGE, NO_RECIPE, [], true), [])

// 단, 자동배분이어도 재료비가 0 이면 몫이 생기지 않는다
{
  const b = findConfirmBlockers(PROD, [{ productId: 'p1', totalAmount: 0, rowCount: 3 }], NO_RECIPE, [], true)
  assert.deepEqual(b[0].missing, ['재료비', '부자재비'])
}

// 수불자료 행은 있는데 금액이 0 — 상세 박스는 차지만 재료비가 0 이다
{
  const b = findConfirmBlockers(PROD, [{ productId: 'p1', totalAmount: 0, rowCount: 5 }], NO_RECIPE, OK_ALLOC, false)
  assert.deepEqual(b[0].missing, ['재료비'])
}

// 생산량 0 은 계산 대상이 아니다
assert.deepEqual(
  findConfirmBlockers([{ productId: 'p1', name: '갓김치', production: 0 }], [], NO_RECIPE, [], false),
  [],
)

console.log('ok')
