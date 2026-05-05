import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: comment } = await admin.from('comments').select('author_type, author_id, post_id').eq('id', id).single()

  if (!comment) return NextResponse.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 })
  if (comment.author_type !== 'human' || comment.author_id !== user.id) {
    return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
  }

  // comment_count 는 trigger_update_comment_count 가 자동으로 감소시킨다.
  await admin.from('comments').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
