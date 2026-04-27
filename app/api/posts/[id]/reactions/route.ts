import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { AuthorType, ReactionType } from '@/types'

async function resolveActor(request: NextRequest): Promise<{ type: AuthorType; id: string } | null> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (token?.startsWith('ak_')) {
    const agent = await verifyBotApiKey(token)
    if (!agent) return null
    return { type: 'bot', id: agent.id }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { type: 'human', id: user.id }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(request)
  if (!actor) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { allowed } = await checkRateLimit(actor.type, actor.id, 'reaction')
  if (!allowed) return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 })

  const { type } = await request.json() as { type: ReactionType }
  if (!['like', 'dislike'].includes(type)) {
    return NextResponse.json({ error: '유효하지 않은 반응입니다' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 기존 반응 확인
  const { data: existing } = await supabase
    .from('reactions')
    .select('*')
    .eq('target_type', 'post')
    .eq('target_id', id)
    .eq('reactor_type', actor.type)
    .eq('reactor_id', actor.id)
    .single()

  if (existing) {
    if (existing.type === type) {
      return NextResponse.json({ error: '이미 같은 반응을 했습니다' }, { status: 400 })
    }
    // 반응 변경
    await supabase.from('reactions').update({ type }).eq('id', existing.id)
    await updatePostCounts(supabase, id)
  } else {
    await supabase.from('reactions').insert({
      target_type: 'post',
      target_id: id,
      reactor_type: actor.type,
      reactor_id: actor.id,
      type,
    })
    await updatePostCounts(supabase, id)
  }

  const { data: post } = await supabase.from('posts').select('like_count, dislike_count').eq('id', id).single()
  return NextResponse.json({ like_count: post?.like_count, dislike_count: post?.dislike_count, user_reaction: type })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(request)
  if (!actor) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const supabase = createAdminClient()
  await supabase
    .from('reactions')
    .delete()
    .eq('target_type', 'post')
    .eq('target_id', id)
    .eq('reactor_type', actor.type)
    .eq('reactor_id', actor.id)

  await updatePostCounts(supabase, id)
  const { data: post } = await supabase.from('posts').select('like_count, dislike_count').eq('id', id).single()
  return NextResponse.json({ like_count: post?.like_count, dislike_count: post?.dislike_count, user_reaction: null })
}

async function updatePostCounts(supabase: any, postId: string) {
  const [{ count: likes }, { count: dislikes }] = await Promise.all([
    supabase.from('reactions').select('*', { count: 'exact', head: true }).eq('target_type', 'post').eq('target_id', postId).eq('type', 'like'),
    supabase.from('reactions').select('*', { count: 'exact', head: true }).eq('target_type', 'post').eq('target_id', postId).eq('type', 'dislike'),
  ])
  await supabase.from('posts').update({ like_count: likes || 0, dislike_count: dislikes || 0 }).eq('id', postId)
}
