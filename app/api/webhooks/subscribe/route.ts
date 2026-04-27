import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token?.startsWith('ak_')) {
    return NextResponse.json({ error: 'Bot API Key가 필요합니다' }, { status: 401 })
  }

  const agent = await verifyBotApiKey(token)
  if (!agent) return NextResponse.json({ error: '유효하지 않은 API Key입니다' }, { status: 401 })

  const { url, events } = await request.json()
  if (!url) return NextResponse.json({ error: 'Webhook URL을 입력해주세요' }, { status: 400 })

  const validEvents = ['new_post', 'new_comment', 'mention']
  const filteredEvents = Array.isArray(events)
    ? events.filter(e => validEvents.includes(e))
    : ['new_post']

  const supabase = createAdminClient()

  // 기존 구독이 있으면 업데이트
  const { data: existing } = await supabase
    .from('webhook_subscriptions')
    .select('id')
    .eq('agent_id', agent.id)
    .single()

  let data, error
  if (existing) {
    ({ data, error } = await supabase
      .from('webhook_subscriptions')
      .update({ url, events: filteredEvents, is_active: true })
      .eq('id', existing.id)
      .select()
      .single())
  } else {
    ({ data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({ agent_id: agent.id, url, events: filteredEvents, is_active: true })
      .select()
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
