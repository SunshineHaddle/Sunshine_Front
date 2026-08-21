// node src/components/dashboard/niceTicks.test.mjs
import assert from 'node:assert/strict'

// DashboardSummaryCharts.tsx 의 구현을 그대로 옮겨 둔다 (이 저장소의 기존 방식)
const TICK_COUNT = 4

function niceTicks(min, max, count = TICK_COUNT) {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (hi === lo) return niceTicks(0, hi === 0 ? 1 : hi, count)

  const span = count - 1
  const step = (() => {
    const raw = (hi - lo) / span
    let magnitude = 10 ** Math.floor(Math.log10(raw))
    for (;;) {
      for (const nice of [1, 1.5, 2, 2.5, 3, 4, 5]) {
        const candidate = nice * magnitude
        if (Math.floor(lo / candidate) * candidate + span * candidate >= hi) return candidate
      }
      magnitude *= 10
    }
  })()

  const first = Math.floor(lo / step) * step
  return Array.from({ length: count }, (_, i) => Math.round((first + i * step) * 100) / 100)
}

const gap = (t) => t[1] - t[0]
const evenly = (t) => t.every((v, i) => i === 0 || Math.abs((v - t[i - 1]) - gap(t)) < 1e-6)

/** 눈금은 항상 4개 · 균등 · 데이터를 감싸야 한다 */
function check(lo, hi, label) {
  const t = niceTicks(lo, hi)
  assert.equal(t.length, 4, `${label}: ${t.length}개`)
  assert.ok(evenly(t), `${label}: 간격 불균등 ${t}`)
  assert.ok(t[0] <= lo, `${label}: 아래가 잘림 ${t[0]} > ${lo}`)
  assert.ok(t.at(-1) >= hi, `${label}: 위가 잘림 ${t.at(-1)} < ${hi}`)
  return t
}

// 실제 데이터 — 4~8월 재료비
check(553202939, 633988316, '포기김치')
check(159361829, 168744494, '갓김치')
check(192225755, 217811706, '맛김치')
check(81603615, 108258230, '백김치')

// 확정된 달이 하나뿐이라 값이 하나 — 0 부터 잡는다
assert.equal(niceTicks(2619, 2619)[0], 0)
assert.ok(niceTicks(2619, 2619).at(-1) >= 2619)

// 전부 0 인 달 — 0 으로 나누지 않는다
assert.equal(niceTicks(0, 0).length, 4)

// 예전 단가 스케일과 여러 자릿수
for (const [lo, hi] of [[1500, 12228], [0, 7], [3, 97], [1234, 98765], [5e8, 9e8], [12, 13]]) {
  check(lo, hi, `${lo}~${hi}`)
}

console.log('ok')
