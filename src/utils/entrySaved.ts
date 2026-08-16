/**
 * "이 회차의 데이터 입력을 저장 완료했는가" 를 브라우저에 기억한다.
 * DB 를 건드리지 않고 프론트에서만 처리한다.
 *
 * 규칙:
 *  - 로그아웃·창닫기·새로고침 후 "재접속" 하면, 이전에 저장 완료한 회차는 빈 폼으로 시작한다.
 *  - 같은 세션 안에서는 방금 저장한 값을 계속 보여준다 (재접속 전까지 이전 자료 유지).
 *
 * 이를 위해 화면 판정(isEntrySavedBeforeSession)은 "이번 세션이 시작되기 전"의
 * 스냅샷만 본다. 세션 중 markEntrySaved 는 localStorage 에만 쓰고 스냅샷은 바꾸지 않는다.
 * 스냅샷은 모듈이 처음 로드될 때(=앱 로드=세션 시작) 한 번 고정된다.
 */

const KEY = 'sunshine.entry-saved-periods.v1'

function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** 세션 시작(모듈 로드 또는 로그아웃) 시점의 저장 완료 목록. 세션 중에는 바뀌지 않는다. */
let sessionStartSnapshot = read()

/**
 * 이번 세션이 시작되기 전에 이미 저장 완료된 회차인지.
 * 화면을 빈 폼으로 시작할지 판정할 때 쓴다 — 세션 중 저장은 반영하지 않는다.
 */
export function isEntrySavedBeforeSession(periodId: string | null): boolean {
  if (!periodId) return false
  return sessionStartSnapshot.has(periodId)
}

/**
 * 스냅샷을 지금 시점으로 다시 찍는다. 로그아웃 시 호출한다 —
 * SPA 라 모듈이 재로드되지 않으므로, 로그아웃을 새 세션 경계로 삼아
 * 그동안 저장한 회차가 재로그인 후 빈 폼으로 시작되게 한다.
 */
export function refreshEntrySavedSnapshot() {
  sessionStartSnapshot = read()
}

/** 저장 성공 시 호출. 이 회차를 저장 완료로 표시한다 (다음 재접속부터 빈 폼). */
export function markEntrySaved(periodId: string | null) {
  if (!periodId) return
  const set = read()
  set.add(periodId)
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {
    // 저장 실패는 무시 — 이번에만 못 기억할 뿐이다
  }
}
