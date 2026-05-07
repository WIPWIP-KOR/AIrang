import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'
import AdminReportsClient from './AdminReportsClient'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')
  if (!isAdminEmail(user.email)) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-700 font-medium mb-1">관리자 전용 페이지입니다</p>
        <p className="text-sm text-gray-500">이 계정은 관리자로 등록되어 있지 않습니다.</p>
        <Link href="/" className="inline-block mt-4 text-sm text-blue-600 hover:underline">홈으로</Link>
      </div>
    )
  }

  const params = await searchParams
  const status = (params.status === 'resolved' || params.status === 'dismissed') ? params.status : 'pending'

  const admin = createAdminClient()
  const { data: reports } = await admin
    .from('reports')
    .select('id, target_type, target_id, reporter_id, reason, details, status, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)

  const list = reports || []
  const postIds = [...new Set(list.filter(r => r.target_type === 'post').map(r => r.target_id))]
  const commentIds = [...new Set(list.filter(r => r.target_type === 'comment').map(r => r.target_id))]
  const reporterIds = [...new Set(list.map(r => r.reporter_id))]

  const [postsRes, commentsRes, reportersRes] = await Promise.all([
    postIds.length
      ? admin.from('posts').select('id, title, content, author_type, author_id, created_at').in('id', postIds)
      : { data: [] },
    commentIds.length
      ? admin.from('comments').select('id, content, post_id, author_type, author_id, created_at').in('id', commentIds)
      : { data: [] },
    reporterIds.length
      ? admin.from('users').select('id, nickname, email').in('id', reporterIds)
      : { data: [] },
  ])

  const postsMap = Object.fromEntries((postsRes.data || []).map((p: any) => [p.id, p]))
  const commentsMap = Object.fromEntries((commentsRes.data || []).map((c: any) => [c.id, c]))
  const reportersMap = Object.fromEntries((reportersRes.data || []).map((u: any) => [u.id, u]))

  const enriched = list.map(r => ({
    ...r,
    target: r.target_type === 'post' ? postsMap[r.target_id] : commentsMap[r.target_id],
    reporter: reportersMap[r.reporter_id],
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-gray-900">신고 관리</h1>
        <div className="flex gap-2 text-sm">
          {(['pending', 'resolved', 'dismissed'] as const).map(s => (
            <Link
              key={s}
              href={`/admin?status=${s}`}
              className={`px-3 py-1.5 rounded-lg ${
                status === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'pending' ? '대기' : s === 'resolved' ? '처리' : '기각'}
            </Link>
          ))}
        </div>
      </div>

      <AdminReportsClient initialReports={enriched as any[]} status={status} />
    </div>
  )
}
