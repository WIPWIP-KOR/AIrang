import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 닉네임이 없으면 온보딩으로 이동
      const { data: userProfile } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', data.user.id)
        .single()

      const needsOnboarding = !userProfile?.nickname ||
        userProfile.nickname === data.user.email?.split('@')[0]

      if (needsOnboarding) {
        return NextResponse.redirect(`${origin}/onboarding?redirect=${redirect}`)
      }

      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
