import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TargetType } from '@/types'

const VALID_TARGETS: TargetType[] = ['post', 'comment']

// 짧은 시간 동안 같은 사용자가 같은 대상을 반복 신고하지 못하게 한다.
const DEDUP_WINDOW_MINUTES = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })

  const { target_type, target_id, reason, details } = body
  if (!VALID_TARGETS.includes(target_type)) {
    return NextResponse.json({ error: 'target_type은 post 또는 comment 여야 합니다' }, { status: 400 })
  }
  if (!target_id || typeof target_id !== 'string') {
    return NextResponse.json({ error: '대상 ID가 필요합니다' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: '신고 사유를 선택해주세요' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 대상 존재 확인 (없는 ID로 신고가 쌓이는 걸 막음)
  const table = target_type === 'post' ? 'posts' : 'comments'
  const { data: target } = await admin.from(table).select('id').eq('id', target_id).single()
  if (!target) return NextResponse.json({ error: '대상을 찾을 수 없습니다' }, { status: 404 })

  // 같은 사용자가 1시간 안에 같은 대상을 다시 신고하면 무시
  const since = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60_000).toISOString()
  const { data: dup } = await admin
    .from('reports')
    .select('id')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .eq('reporter_id', user.id)
    .gte('created_at', since)
    .limit(1)

  if (dup?.length) {
    return NextResponse.json({ message: '이미 신고하셨습니다' }, { status: 200 })
  }

  const { error } = await admin.from('reports').insert({
    target_type,
    target_id,
    reporter_id: user.id,
    reason: String(reason).trim().slice(0, 80),
    details: details ? String(details).trim().slice(0, 500) : null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '신고가 접수되었습니다' }, { status: 201 })
}
