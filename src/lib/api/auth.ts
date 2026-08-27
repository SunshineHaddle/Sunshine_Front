/** §11 — 로그인 / 프로필 */
import { createClient } from '@supabase/supabase-js'
import { setAuthFailureHandler, supabase } from '../supabase'
import type { ProfileRow, UserRole } from '../types'

/**
 * Supabase Auth 는 이메일 기준이다.
 * 아이디 입력 UI 는 그대로 두고 뒤에 내부 도메인만 붙인다.
 */
const EMAIL_DOMAIN = '@sunshine.local'
export const toEmail = (loginId: string) => `${loginId.trim()}${EMAIL_DOMAIN}`

/** 화면 라우팅용 역할. reviewer 는 조회만 하므로 admin 화면을 그대로 쓴다 */
export type LoginRole = 'admin' | 'worker'
export const toLoginRole = (role: UserRole): LoginRole =>
  role === 'entry' ? 'worker' : 'admin'

export type SignInResult =
  | { ok: true; profile: ProfileRow; role: LoginRole }
  | { ok: false; message: string }

// ── §11-1 로그인 ────────────────────────────────────────────
export async function signIn(loginId: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(loginId),
    password,
  })
  if (error || !data.user) {
    return { ok: false, message: '아이디 또는 비밀번호를 확인해 주세요.' }
  }

  const profile = await fetchMyProfile(data.user.id)
  if (!profile) {
    // auth 계정은 있는데 profiles 행이 없으면 is_admin() 이 false 라
    // 모든 쓰기가 막힌다. 원인을 못 찾게 되므로 여기서 잡는다.
    await supabase.auth.signOut()
    return {
      ok: false,
      message: '계정에 연결된 프로필이 없습니다. 관리자에게 문의하세요.',
    }
  }
  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { ok: false, message: '비활성화된 계정입니다.' }
  }

  void touchLastActive()
  return { ok: true, profile, role: toLoginRole(profile.role) }
}

// ── §11-2 세션 ──────────────────────────────────────────────
export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function signOut() {
  await supabase.auth.signOut()
}

/**
 * 세션이 끊기면 알려준다. 다른 기기에서 로그아웃했거나 토큰 갱신에 실패한 경우다.
 *
 * 이게 없으면 앱은 세션이 죽은 줄 모르고 계속 조회한다. RLS 는 권한 없는 읽기에
 * **에러 대신 빈 배열**을 주므로(§7) 화면은 "데이터가 없다"처럼 보인다.
 * 장시간 켜두고 쓰는 업무 화면이라 실제로 만나는 상황이다.
 *
 * @returns 구독 해제 함수
 */
export function onSessionLost(handler: () => void): () => void {
  let fired = false
  /** 한 번만 알린다. 이벤트와 화면 복귀 확인이 겹쳐 두 번 불릴 수 있다 */
  const lost = () => {
    if (fired) return
    fired = true
    handler()
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // 다시 로그인하면 감지를 되살린다. 이 구독은 앱이 살아 있는 동안 유지되므로,
    // 되살리지 않으면 두 번째 만료부터는 알리지 못한다
    if (event === 'SIGNED_IN' && session) {
      fired = false
      return
    }
    // SIGNED_OUT : 로그아웃 · 다른 기기에서의 signOut · 토큰 무효화
    // TOKEN_REFRESHED 인데 세션이 없으면 갱신 실패다
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      lost()
    }
  })

  /**
   * 화면으로 돌아올 때 세션을 직접 확인한다.
   *
   * 이벤트만 기다리면 놓치는 경우가 있다 — 노트북을 덮어두거나 탭을 오래
   * 방치하면 그 사이 갱신 타이머가 멈춰 있어서, 다시 열었을 때 만료된 토큰을
   * 들고 조용히 조회를 계속한다. RLS 는 권한 없는 읽기에 에러 대신 빈 배열을
   * 주므로(§7) 화면은 '데이터가 없다' 처럼 보인다.
   *
   * getSession() 은 만료가 임박하면 스스로 갱신을 시도하고, 실패하면 null 을 준다.
   */
  const check = () => {
    if (document.visibilityState === 'hidden') return
    void supabase.auth.getSession().then(({ data: current }) => {
      if (!current.session) lost()
    })
  }

  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  // 만료된 토큰으로 나간 요청(401)도 세션이 끊긴 것으로 본다
  setAuthFailureHandler(lost)

  return () => {
    data.subscription.unsubscribe()
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    setAuthFailureHandler(null)
  }
}

// ── §11-3 내 프로필 ─────────────────────────────────────────
export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, login_id, name, role, is_active, last_active_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data as ProfileRow | null
}

// ── §11-6 마지막 접속 갱신 ──────────────────────────────────
/**
 * 직접 update 하지 않고 RPC 를 쓴다.
 * "자기 행은 수정 가능" 정책을 열어두면 RLS 로는 컬럼을 제한할 수 없어
 * 사용자가 자기 role 을 admin 으로 바꿀 수 있다(권한 상승).
 * touch_last_active() 는 security definer 로 last_active_at 만 건드린다.
 */
export async function touchLastActive() {
  await supabase.rpc('touch_last_active')
}

// ── §11-4 사용자 목록 조회 (관리자 전용 화면) ────────────────
export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, login_id, name, role, is_active, last_active_at')
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as ProfileRow[]
}

// ── §11-5 활성 토글 · 역할 변경 ─────────────────────────────
/**
 * RLS 의 "admin write" 를 통과해야 한다.
 * 관리자가 아니면 에러 없이 0행이 수정되므로, 반영 여부를 반환값으로 알린다.
 */
export async function setProfileActive(userId: string, isActive: boolean): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles').update({ is_active: isActive }).eq('id', userId).select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}

export async function setProfileRole(userId: string, role: UserRole): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles').update({ role }).eq('id', userId).select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}

// ── 비밀번호 변경 ────────────────────────────────────────────
export type ChangePasswordResult = 'ok' | 'wrong_password' | 'failed'

/**
 * 기존 비밀번호가 맞아야 새 비밀번호로 바뀐다. DB 함수 없이 Auth API 만 쓴다.
 *
 * 방법: 세션을 저장하지 않는 별도 클라이언트로 대상 계정에 기존 비밀번호로
 * 로그인해 본다 → 성공하면 그 임시 세션으로 updateUser({ password }) → 폐기.
 * 관리자 본인의 세션(메인 supabase 클라이언트)은 전혀 건드리지 않는다.
 *
 * 실무자·관리자 어느 계정이든 기존 비밀번호만 알면 바꿀 수 있다.
 */
export async function changePassword(
  loginId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) return 'failed'

  // 메인 클라이언트와 저장소·401 핸들러를 공유하지 않도록 완전히 분리한다
  const temp = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const signIn = await temp.auth.signInWithPassword({
      email: toEmail(loginId),
      password: currentPassword,
    })
    if (signIn.error || !signIn.data.session) return 'wrong_password'

    const update = await temp.auth.updateUser({ password: newPassword })
    if (update.error) throw new Error(update.error.message)
    return 'ok'
  } finally {
    await temp.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
}
