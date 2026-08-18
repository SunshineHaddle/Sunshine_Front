// node src/components/dashboard/monthAxis.test.mjs
// DashboardSummaryCharts 의 축 계산(buildAxis / xForMonth) self-check
import assert from 'node:assert/strict'

function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const MAX_MONTHS = 12

// 오늘 대신 고정 값을 받도록만 바꾼 사본
function buildAxis(costTrends, thisMonth) {
  const months = new Set()
  for (const series of Object.values(costTrends ?? {})) {
    for (const point of series) months.add(point.period.slice(0, 7))
  }

  let last, count
  if (months.size === 0) {
    last = thisMonth
    count = MAX_MONTHS
  } else {
    const sorted = [...months].sort()
    const first = sorted[0]
    last = sorted[sorted.length - 1]
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    count = Math.min((ly - fy) * 12 + (lm - fm) + 1, MAX_MONTHS)
  }

  const keys = []
  const labels = []
  for (let back = count - 1; back >= 0; back -= 1) {
    const month = shiftMonth(last, -back)
    keys.push(month)
    labels.push(`${Number(month.slice(5, 7))}월`)
  }
  return { keys, labels }
}

const xForMonth = (monthIndex, count) =>
  count <= 1 ? 469 : 58 + (monthIndex / (count - 1)) * 822

const TODAY = '2026-08'

// 데이터 없음 → 이번 달로 끝나는 12칸 (참고용 곡선용 축)
{
  const { keys } = buildAxis(undefined, TODAY)
  assert.equal(keys.length, 12)
  assert.equal(keys[0], '2025-09')
  assert.equal(keys.at(-1), '2026-08')
}

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
  assert.equal(xForMonth(0, 2), 58)
  assert.equal(xForMonth(1, 2), 880)
}

// 한 달뿐이면 한 칸, 점은 가운데
{
  const { keys } = buildAxis({ p: [{ period: '2026-09-01' }] }, TODAY)
  assert.deepEqual(keys, ['2026-09'])
  assert.equal(xForMonth(0, 1), 469)
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
