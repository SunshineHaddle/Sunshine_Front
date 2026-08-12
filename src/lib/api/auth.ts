/** docs/api/06-users.md §11 — 로그인 / 프로필 */
import { supabase } from '../supabase'
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

  void touchLastActive(profile.id)
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
export async function touchLastActive(userId: string) {
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
}
