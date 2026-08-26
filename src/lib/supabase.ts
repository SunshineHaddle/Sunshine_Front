import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey || anonKey.startsWith('여기에')) {
  console.error(
    '[supabase] .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 채워주세요.\n' +
    '대시보드 > Settings > API 에서 복사할 수 있습니다.',
  )
}

/**
 * 토큰이 만료된 뒤의 요청을 잡는 자리.
 *
 * 세션이 죽어도 앱은 조회를 계속하는데, PostgREST 는 만료 토큰에 401 을 준다.
 * 화면 쪽에서는 그저 조회 실패로 보여서 "데이터가 없다" 와 구분이 안 된다.
 * fetch 한 곳에서 잡으면 API 함수 수십 개를 손대지 않아도 된다.
 */
let authFailureHandler: (() => void) | null = null

/** auth.ts 의 onSessionLost 가 등록한다. 화면에서 직접 부르지 않는다 */
export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  global: {
    fetch: async (input, init) => {
      const response = await fetch(input as RequestInfo, init)
      // 401 = 토큰 만료·무효. 로그인 실패는 400 이라 여기 걸리지 않는다
      if (response.status === 401) authFailureHandler?.()
      return response
    },
  },
})

/** Supabase 접속 정보가 채워졌는지. 화면에서 안내를 띄울 때 쓴다. */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !anonKey.startsWith('여기에'),
)
