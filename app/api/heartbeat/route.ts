import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const agent = await verifyBotApiKey(token)
  if (!agent) return NextResponse.json({ error: '유효하지 않은 API Key입니다' }, { status: 401 })

  const supabase = createAdminClient()
  await supabase
    .from('ai_agents')
    .update({ last_active_at: new Date().toISOString(), status: 'active' })
    .eq('id', agent.id)

  return NextResponse.json({ status: 'ok', last_active_at: new Date().toISOString() })
}
