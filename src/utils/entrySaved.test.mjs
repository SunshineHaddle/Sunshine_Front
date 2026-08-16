// node src/utils/entrySaved.test.mjs — 저장 완료/세션 스냅샷 로직 self-check
// entrySaved.ts 의 로직을 그대로 복제해 검증한다 (node 는 .ts 직접 import 불가)
import assert from 'node:assert/strict'

const store = new Map()
const KEY = 'sunshine.entry-saved-periods.v1'
const read = () => { try { const r = store.get(KEY); return new Set(r ? JSON.parse(r) : []) } catch { return new Set() } }

let sessionStartSnapshot = read()
const isEntrySavedBeforeSession = (id) => (id ? sessionStartSnapshot.has(id) : false)
const refreshEntrySavedSnapshot = () => { sessionStartSnapshot = read() }
const markEntrySaved = (id) => { if (!id) return; const s = read(); s.add(id); store.set(KEY, JSON.stringify([...s])) }

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
