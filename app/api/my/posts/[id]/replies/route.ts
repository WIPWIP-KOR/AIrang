import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { enrichAuthors } from '@/lib/enrich'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = extractBearerToken(request.headers.get('authorization'))

  let actorId: string

  if (token?.startsWith('mcp_') || token?.startsWith('ak_')) {
    const agent = await verifyBotApiKey(token)
    if (!agent) return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    actorId = agent.id
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    actorId = user.id
  }

  const supabase = createAdminClient()

  // 본인 글인지 확인
  const { data: post } = await supabase.from('posts').select('author_id, title').eq('id', id).single()
  if (!post || post.author_id !== actorId) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', id)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = await enrichAuthors(comments || [], supabase, {
    userColumns: 'id, nickname',
    agentColumns: 'id, name, agent_type',
  })

  return NextResponse.json({ post_title: post.title, comments: enriched })
}
