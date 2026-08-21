// node src/components/dashboard/monthAxis.test.mjs
import assert from 'node:assert/strict'
import {
  buildAxis,
  shiftMonth,
  xForMonth,
  PLOT_LEFT,
  PLOT_RIGHT,
} from './chartAxis.ts'

// 날짜를 고정한다. buildAxis 가 today 를 인자로 받게 바꾼 이유이기도 하다 —
// new Date() 를 안에서 부르면 이 검증들이 달이 바뀔 때마다 깨진다.
const TODAY = new Date(2026, 7, 1) // 2026-08

// 실제 상황: 8월·9월 두 달만 확정 → 축도 두 칸
// 예전에는 12칸이라 두 점이 오른쪽 끝 9% 안에 뭉쳤다
{
  const { keys, labels } = buildAxis(
    { p1: [{ period: '2026-08-01' }, { period: '2026-09-01' }] },
    TODAY,
  )
  assert.deepEqual(keys, ['2026-08', '2026-09'])
  assert.deepEqual(labels, ['8월', '9월'])
  // 두 점이 그래프 양 끝에 놓인다
  assert.equal(xForMonth(0, 2), PLOT_LEFT)
  assert.equal(xForMonth(1, 2), PLOT_RIGHT)
}

// 한 달뿐이면 한 칸, 점은 가운데
{
  const { keys } = buildAxis({ p: [{ period: '2026-09-01' }] }, TODAY)
  assert.deepEqual(keys, ['2026-09'])
  assert.equal(xForMonth(0, 1), (PLOT_LEFT + PLOT_RIGHT) / 2)
}

// 중간에 빈 달이 있어도 자리를 남겨 간격을 유지한다
{
  const { keys } = buildAxis(
    { p: [{ period: '2026-01-01' }, { period: '2026-04-01' }] },
    TODAY,
  )
  assert.deepEqual(keys, ['2026-01', '2026-02', '2026-03', '2026-04'])
}

// 12개월을 넘으면 최근 12칸만
{
  const { keys } = buildAxis(
    { p: [{ period: '2024-01-01' }, { period: '2026-09-01' }] },
    TODAY,
  )
  assert.equal(keys.length, 12)
  assert.equal(keys.at(-1), '2026-09')
  assert.equal(keys[0], '2025-10')
}

// 연도를 넘어가는 범위
{
  const { keys } = buildAxis(
    { p: [{ period: '2025-11-01' }, { period: '2026-02-01' }] },
    TODAY,
  )
  assert.deepEqual(keys, ['2025-11', '2025-12', '2026-01', '2026-02'])
}

// 제품별로 달이 다르면 전체를 아우른다
{
  const { keys } = buildAxis(
    { a: [{ period: '2026-06-01' }], b: [{ period: '2026-09-01' }] },
    TODAY,
  )
  assert.deepEqual(keys, ['2026-06', '2026-07', '2026-08', '2026-09'])
}

console.log('ok')
