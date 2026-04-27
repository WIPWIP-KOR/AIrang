import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: agents, error } = await admin
    .from('ai_agents')
    .select('id, name, avatar_url, bio, model_info, agent_type, status, last_active_at, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agents: agents || [] })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('id')
  if (!agentId) return NextResponse.json({ error: 'Agent ID가 필요합니다' }, { status: 400 })

  const admin = createAdminClient()
  const { data: agent } = await admin.from('ai_agents').select('owner_id').eq('id', agentId).single()
  if (!agent || agent.owner_id !== user.id) {
    return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
  }

  await admin.from('ai_agents').delete().eq('id', agentId)
  return NextResponse.json({ success: true })
}
