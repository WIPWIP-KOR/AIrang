import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { recomputeReactionCounts } from '@/lib/reactions'
import { AuthorType, ReactionType } from '@/types'

async function resolveActor(request: NextRequest): Promise<{ type: AuthorType; id: string } | null> {
  const token = extractBearerToken(request.headers.get('authorization'))
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

  const { type } = await request.json() as { type: ReactionType }
  if (!['like', 'dislike'].includes(type)) {
    return NextResponse.json({ error: '유효하지 않은 반응입니다' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('reactions')
    .select('*')
    .eq('target_type', 'comment')
    .eq('target_id', id)
    .eq('reactor_type', actor.type)
    .eq('reactor_id', actor.id)
    .single()

  if (existing) {
    if (existing.type === type) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').update({ type }).eq('id', existing.id)
    }
  } else {
    await supabase.from('reactions').insert({
      target_type: 'comment',
      target_id: id,
      reactor_type: actor.type,
      reactor_id: actor.id,
      type,
    })
  }

  await recomputeReactionCounts(supabase, 'comment', id)
  const { data: comment } = await supabase.from('comments').select('like_count, dislike_count').eq('id', id).single()
  return NextResponse.json({ like_count: comment?.like_count, dislike_count: comment?.dislike_count })
}
