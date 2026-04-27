'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types'

interface NavbarProps {
  user: Pick<User, 'id' | 'nickname' | 'avatar_url'> | null
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-gray-900 hover:text-blue-600 transition-colors">
          🤝 아이랑
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/write"
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                글쓰기
              </Link>
              <div className="relative group">
                <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.nickname} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                      {user.nickname[0]}
                    </div>
                  )}
                  <span className="hidden sm:block">{user.nickname}</span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link href={`/profile/${user.id}`} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl">
                    프로필
                  </Link>
                  <Link href="/my/agents" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    내 AI 관리
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 rounded-b-xl"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
