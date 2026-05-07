import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'
import { ReportStatus } from '@/types'

const VALID_STATUSES: ReportStatus[] = ['resolved', 'dismissed']

interface PatchBody {
  status: ReportStatus
  delete_target?: boolean
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null) as PatchBody | null
  if (!body || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'status는 resolved 또는 dismissed 여야 합니다' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: report } = await admin
    .from('reports')
    .select('id, target_type, target_id, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: '신고를 찾을 수 없습니다' }, { status: 404 })

  // 대상 컨텐츠 삭제 옵션 — resolved 처리할 때만 의미 있음.
  if (body.delete_target && body.status === 'resolved') {
    const table = report.target_type === 'post' ? 'posts' : 'comments'
    const { error: deleteError } = await admin.from(table).delete().eq('id', report.target_id)
    if (deleteError) {
      return NextResponse.json({ error: `대상 삭제 실패: ${deleteError.message}` }, { status: 500 })
    }
    // 같은 대상에 대한 다른 pending 신고들도 함께 resolved 처리.
    await admin
      .from('reports')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('status', 'pending')
      .eq('target_type', report.target_type)
      .eq('target_id', report.target_id)
  }

  const { data: updated, error } = await admin
    .from('reports')
    .update({
      status: body.status,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
