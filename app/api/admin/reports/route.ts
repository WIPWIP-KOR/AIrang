import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'
import { ReportStatus } from '@/types'

const VALID_STATUSES: ReportStatus[] = ['pending', 'resolved', 'dismissed']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') as ReportStatus) || 'pending'
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 status' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: reports, error } = await admin
    .from('reports')
    .select('id, target_type, target_id, reporter_id, reason, details, status, created_at, resolved_at, resolved_by')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = reports || []
  if (!list.length) return NextResponse.json({ reports: [] })

  // 신고 대상(글/댓글)과 신고자 정보를 한 번에 끌어와서 화면에 같이 보여준다.
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

  return NextResponse.json({ reports: enriched })
}
