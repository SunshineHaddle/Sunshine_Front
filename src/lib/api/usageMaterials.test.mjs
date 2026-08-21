// node src/lib/api/usageMaterials.test.mjs
import assert from 'node:assert/strict'

// production.ts 는 supabase 를 import 하므로 Node 에서 바로 읽을 수 없다.
// 접는 규칙만 따로 떼어 둔 모듈을 검증한다.
const { groupLatestUsageMaterials } = await import('./usageMaterials.ts')

const row = (product, month, name, amount) => ({
  product_id: product,
  amount,
  materials: { name },
  cost_periods: { period: `${month}-01` },
})

// 달이 여럿이면 제품마다 가장 최근 달만 쓴다.
// 전 기간을 합치면 지금은 안 쓰는 재료까지 현재 배합인 것처럼 보인다.
{
  const out = groupLatestUsageMaterials([
    row('p1', '2026-06', '옛날재료', 100),
    row('p1', '2026-08', '배추', 500),
    row('p1', '2026-08', '무', 300),
  ])
  assert.equal(out.p1.month, '2026-08')
  assert.deepEqual(out.p1.names, ['배추', '무'])
}

// 제품마다 최근 달이 다를 수 있다 — 하나로 뭉뚱그리면 안 된다
{
  const out = groupLatestUsageMaterials([
    row('p1', '2026-08', '배추', 10),
    row('p2', '2026-05', '갓', 10),
  ])
  assert.equal(out.p1.month, '2026-08')
  assert.equal(out.p2.month, '2026-05')
}

// 금액이 큰 재료가 앞에 온다 (제품 상세의 원재료비 상세와 같은 순서)
{
  const out = groupLatestUsageMaterials([
    row('p1', '2026-08', '싼것', 1),
    row('p1', '2026-08', '비싼것', 999),
  ])
  assert.deepEqual(out.p1.names, ['비싼것', '싼것'])
}

// 같은 재료가 두 줄로 들어와도 한 번만 (엑셀에 중복 행이 있을 수 있다)
{
  const out = groupLatestUsageMaterials([
    row('p1', '2026-08', '배추', 10),
    row('p1', '2026-08', '배추', 5),
  ])
  assert.deepEqual(out.p1.names, ['배추'])
}

// 재료명이 비면 버린다 — 이름 없는 칩을 그리지 않는다
{
  const out = groupLatestUsageMaterials([
    { product_id: 'p1', amount: 10, materials: null, cost_periods: { period: '2026-08-01' } },
  ])
  assert.deepEqual(out, {})
}

// 회차 조인이 비면 그 행은 무시한다 (달을 모르면 최근 달을 못 고른다)
assert.deepEqual(
  groupLatestUsageMaterials([
    { product_id: 'p1', amount: 10, materials: { name: '배추' }, cost_periods: null },
  ]),
  {},
)

assert.deepEqual(groupLatestUsageMaterials([]), {})

console.log('ok')
