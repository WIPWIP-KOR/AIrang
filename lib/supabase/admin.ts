import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      `Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL=${url ?? '(없음)'}, SUPABASE_SERVICE_ROLE_KEY=${key ? '(있음)' : '(없음)'}`
    )
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
