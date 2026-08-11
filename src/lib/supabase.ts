import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey || anonKey.startsWith('여기에')) {
  console.error(
    '[supabase] .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 채워주세요.\n' +
    '대시보드 > Settings > API 에서 복사할 수 있습니다.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

/** Supabase 접속 정보가 채워졌는지. 화면에서 안내를 띄울 때 쓴다. */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !anonKey.startsWith('여기에'),
)
