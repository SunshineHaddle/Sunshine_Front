/**
 * 대시보드 제품 원가 추이 그래프의 축 계산.
 *
 * 컴포넌트(.tsx)에서 떼어낸 이유는 **테스트가 이 코드를 직접 읽게** 하기 위해서다.
 * JSX 는 Node 의 타입 스트리핑으로 못 읽어서, 예전에는 테스트 파일에 구현을
 * 통째로 베껴 두고 검증했다. 원본만 고치고 사본을 안 고치면 테스트는 통과하는데
 * 실제는 깨진다 — 실제로 두 번 같이 고쳐야 했다.
 */

/** 'YYYY-MM' 한 달 뒤로 이동 */
export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 그래프 영역의 좌우 끝 (viewBox 900 기준).
 *
 * 왼쪽을 58 에서 넓혔다 — y축 금액 라벨('1.2만원')이 그만큼 자리를 못 잡고
 * 그래프 안까지 밀고 들어왔다. 라벨은 PLOT_LEFT 왼쪽에 오른쪽 정렬로 붙는다.
 */
export const PLOT_LEFT = 115
export const PLOT_RIGHT = 880

/** 그래프 위·아래 끝 (viewBox 300 기준) */
export const PLOT_TOP = 60
export const PLOT_BOTTOM = 250


/** 축 칸 수에 맞춘 x 좌표. 칸이 하나뿐이면 가운데 */
export const xForMonth = (monthIndex: number, count: number) =>
  count <= 1
    ? (PLOT_LEFT + PLOT_RIGHT) / 2
    : PLOT_LEFT + (monthIndex / (count - 1)) * (PLOT_RIGHT - PLOT_LEFT)

const MAX_MONTHS = 12

/**
 * 가로축을 만든다.
 *
 * 확정 데이터가 있으면 **그 데이터가 걸친 범위**만 축으로 쓴다.
 * 항상 12칸으로 벌리면, 두 달치 데이터가 오른쪽 끝 9% 안에 뭉쳐
 * 선이 거의 보이지 않는다. 데이터가 쌓일수록 축이 자연히 넓어진다.
 *
 * 어떤 제품에도 확정 데이터가 없으면 이번 달로 끝나는 12개월을 축으로 둔다.
 */
export function buildAxis(
  costTrends?: Record<string, { period: string; unitCost: number; materialCost: number }[]>,
  /** 오늘. 테스트가 날짜를 고정할 수 있도록 받는다 */
  today: Date = new Date(),
) {
  const months = new Set<string>()
  for (const series of Object.values(costTrends ?? {})) {
    for (const point of series) months.add(point.period.slice(0, 7))
  }

  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  let last: string
  let count: number

  if (months.size === 0) {
    last = thisMonth
    count = MAX_MONTHS
  } else {
    const sorted = [...months].sort()
    const first = sorted[0]
    last = sorted[sorted.length - 1]

    // first..last 사이의 개월 수. 중간에 빈 달이 있어도 자리를 남겨 간격을 유지한다
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    count = Math.min((ly - fy) * 12 + (lm - fm) + 1, MAX_MONTHS)
  }

  const keys: string[] = []
  const labels: string[] = []
  for (let back = count - 1; back >= 0; back -= 1) {
    const month = shiftMonth(last, -back)
    keys.push(month)
    labels.push(`${Number(month.slice(5, 7))}월`)
  }
  return { keys, labels }
}

/** y축 눈금 수. 제품마다 다르면 카드끼리 격자 높이가 안 맞는다 */
export const TICK_COUNT = 4

/**
 * y축 눈금을 '읽기 좋은 금액'으로 **정확히 TICK_COUNT 개** 끊는다.
 *
 * 예전에는 데이터의 최대·중간·최소를 그대로 찍어서 633,988,316 같은
 * 어중간한 값이 축에 올라왔다. 간격도 제각각이라 눈금 사이 거리로
 * 금액을 가늠할 수 없었다.
 *
 * 간격은 1 · 1.5 · 2 · 2.5 · 3 · 4 · 5 배수만 쓴다. 3 과 4 를 넣은 이유는
 * 이것들이 없으면 간격이 2.5 에서 5 로 건너뛰면서 범위가 필요 이상으로
 * 넓어지기 때문이다 (5.5억~6.3억 자료에 5.5억~7억 축이 잡혔다).
 */
export function niceTicks(min: number, max: number, count = TICK_COUNT): number[] {
  // 값이 하나뿐이거나 전부 같으면 0 부터 그 값까지를 범위로 잡는다
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  // 값이 하나뿐이거나 전부 같으면 0 부터 그 값까지를 범위로 잡는다
  if (hi === lo) return niceTicks(0, hi === 0 ? 1 : hi, count)

  const span = count - 1
  const step = (() => {
    const raw = (hi - lo) / span
    let magnitude = 10 ** Math.floor(Math.log10(raw))
    for (;;) {
      for (const nice of [1, 1.5, 2, 2.5, 3, 4, 5]) {
        const candidate = nice * magnitude
        // 아래로 눈금에 맞춰 내린 뒤에도 마지막 눈금이 최대값을 덮어야 한다
        if (Math.floor(lo / candidate) * candidate + span * candidate >= hi) return candidate
      }
      magnitude *= 10
    }
  })()

  const first = Math.floor(lo / step) * step
  // 부동소수 누적 오차를 피하려고 인덱스로 곱한다
  return Array.from({ length: count }, (_, i) => Math.round((first + i * step) * 100) / 100)
}
