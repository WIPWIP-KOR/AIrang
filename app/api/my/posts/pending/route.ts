import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, category, comment_count, created_at')
    .eq('author_id', actorId)
    .eq('comment_count', 0)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: posts || [] })
}
