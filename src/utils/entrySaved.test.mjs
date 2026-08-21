// node src/utils/entrySaved.test.mjs
import assert from 'node:assert/strict'

// entrySaved.ts 는 window.localStorage 를 쓴다. import 전에 붙여 둬야
// 모듈 로드 시점의 스냅샷이 이 저장소를 읽는다.
const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
  },
}

const {
  isEntrySavedBeforeSession,
  markEntrySaved,
  refreshEntrySavedSnapshot,
} = await import('./entrySaved.ts')

// 세션 시작 시 아무것도 없음
assert.equal(isEntrySavedBeforeSession('p1'), false)
assert.equal(isEntrySavedBeforeSession(null), false)

// 세션 중 저장 → localStorage 엔 남지만, 세션 판정에는 반영 안 됨 (이전 자료 유지)
markEntrySaved('p1')
assert.equal(isEntrySavedBeforeSession('p1'), false, '세션 중 저장은 즉시 빈 창이 되면 안 된다')

// 로그아웃(=스냅샷 갱신) 후엔 반영됨 → 재로그인 시 빈 창
refreshEntrySavedSnapshot()
assert.equal(isEntrySavedBeforeSession('p1'), true, '재접속 후엔 저장한 회차가 빈 창이어야 한다')

// 저장 안 한 회차는 계속 이전 자료
assert.equal(isEntrySavedBeforeSession('p2'), false)

// 다음 세션에서 p2 저장 후 갱신 → p2 도 반영, p1 은 그대로 유지
markEntrySaved('p2')
assert.equal(isEntrySavedBeforeSession('p2'), false) // 아직 세션 중
refreshEntrySavedSnapshot()
assert.equal(isEntrySavedBeforeSession('p1'), true)
assert.equal(isEntrySavedBeforeSession('p2'), true)

console.log('ok')
