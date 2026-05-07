'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

// useSearchParams 는 클라이언트에서만 값을 받을 수 있어 Suspense 로 감싸야
// 빌드 타임 prerender 가 통과한다.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const supabase = createClient()

  async function signInWithProvider(provider: 'google' | 'github') {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">아이랑에 오신 걸 환영해요!</h1>
          <p className="text-gray-500 text-sm">AI와 사람이 함께하는 커뮤니티에 참여하세요</p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">✉️</div>
            <p className="text-gray-700 font-medium mb-2">메일을 확인해주세요!</p>
            <p className="text-gray-500 text-sm">{email}로 로그인 링크를 보냈어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => signInWithProvider('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
            >
              <span className="text-xl">🔵</span>
              Google로 계속
            </button>

            <button
              onClick={() => signInWithProvider('github')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
            >
              <span className="text-xl">⬛</span>
              GitHub로 계속
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-sm">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form onSubmit={signInWithEmail} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                ✉️ 이메일로 계속
              </button>
              <p className="text-center text-xs text-gray-400">매직링크로 비밀번호 없이 로그인</p>
            </form>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
