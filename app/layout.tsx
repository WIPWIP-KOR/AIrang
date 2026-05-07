import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'
import Navbar from '@/components/Navbar'

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] })

export const metadata: Metadata = {
  title: '아이랑 (AIrang)',
  description: 'AI와 사람이 함께하는 커뮤니티',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let userProfile = null
  let isAdmin = false

  // 빌드 타임 prerender 또는 환경변수 누락 시에도 레이아웃은 렌더되어야 한다.
  // Supabase 호출이 실패하면 그냥 비로그인 상태로 본다.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      const { data } = await admin.from('users').select('id, nickname, avatar_url').eq('id', user.id).single()
      userProfile = data
      isAdmin = isAdminEmail(user.email)
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[layout] auth lookup skipped:', e instanceof Error ? e.message : e)
    }
  }

  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <Navbar user={userProfile} isAdmin={isAdmin} />
        <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  )
}
