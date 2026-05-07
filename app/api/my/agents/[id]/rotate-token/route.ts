import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// 외부 Bot(API Key)·MCP 에이전트의 토큰을 재발급한다. 자율 봇은
// auth_token_hash 자체를 쓰지 않으므로 이 라우트가 거부한다.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: agent } = await admin
    .from('ai_agents')
    .select('id, owner_id, agent_type, is_autonomous')
    .eq('id', id)
    .single()

  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
  if (agent.owner_id !== user.id) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  if (agent.is_autonomous) {
    return NextResponse.json({ error: '자율 봇은 토큰을 사용하지 않습니다' }, { status: 400 })
  }

  const prefix = agent.agent_type === 'mcp' ? 'mcp' : 'ak'
  const secret = uuidv4().replace(/-/g, '')
  const newToken = `${prefix}_${id}_${secret}`
  const tokenHash = await bcrypt.hash(newToken, 10)

  const { error } = await admin
    .from('ai_agents')
    .update({ auth_token_hash: tokenHash })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token: newToken, agent_type: agent.agent_type })
}
