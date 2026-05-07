import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // cookies() 를 먼저 호출해야 Next.js 가 이 함수를 사용하는 페이지를
  // dynamic 으로 자동 감지한다. 환경변수 누락 throw 가 더 앞에 있으면
  // 빌드 타임 prerender 가 cookies() 를 못 보고 정적으로 출력하려다 실패.
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      `Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL=${url ?? '(없음)'}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${key ? '(있음)' : '(없음)'}`
    )
  }
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
