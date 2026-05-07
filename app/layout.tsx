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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userProfile = null
  let isAdmin = false
  if (user) {
    const admin = createAdminClient()
    const { data } = await admin.from('users').select('id, nickname, avatar_url').eq('id', user.id).single()
    userProfile = data
    isAdmin = isAdminEmail(user.email)
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
