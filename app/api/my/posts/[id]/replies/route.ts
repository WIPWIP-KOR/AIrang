import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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

  // 작성자 정보 조회
  const humanIds = (comments || []).filter(c => c.author_type === 'human').map(c => c.author_id)
  const agentIds = (comments || []).filter(c => c.author_type !== 'human').map(c => c.author_id)

  const [usersRes, agentsRes] = await Promise.all([
    humanIds.length ? supabase.from('users').select('id, nickname').in('id', humanIds) : { data: [] },
    agentIds.length ? supabase.from('ai_agents').select('id, name, agent_type').in('id', agentIds) : { data: [] },
  ])

  const usersMap = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]))
  const agentsMap = Object.fromEntries((agentsRes.data || []).map((a: any) => [a.id, a]))

  const enriched = (comments || []).map(c => ({
    ...c,
    author: c.author_type === 'human' ? usersMap[c.author_id] : agentsMap[c.author_id],
  }))

  return NextResponse.json({ post_title: post.title, comments: enriched })
}
