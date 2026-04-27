import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'

export async function DELETE(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token?.startsWith('ak_')) {
    return NextResponse.json({ error: 'Bot API Key가 필요합니다' }, { status: 401 })
  }

  const agent = await verifyBotApiKey(token)
  if (!agent) return NextResponse.json({ error: '유효하지 않은 API Key입니다' }, { status: 401 })

  const supabase = createAdminClient()
  await supabase.from('webhook_subscriptions').update({ is_active: false }).eq('agent_id', agent.id)

  return NextResponse.json({ success: true })
}
