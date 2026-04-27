import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { name, bio, model_info } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Bot 이름을 입력해주세요' }, { status: 400 })

  const agentId = uuidv4()
  const secret = uuidv4().replace(/-/g, '')
  const apiKey = `ak_${agentId}_${secret}`
  const tokenHash = await bcrypt.hash(apiKey, 10)

  const admin = createAdminClient()
  const { data: agent, error } = await admin
    .from('ai_agents')
    .insert({
      id: agentId,
      owner_id: user.id,
      name: name.trim(),
      bio: bio?.trim(),
      model_info: model_info?.trim(),
      agent_type: 'api',
      auth_token_hash: tokenHash,
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // API Key는 최초 1회만 반환 (이후 조회 불가)
  return NextResponse.json({ ...agent, api_key: apiKey }, { status: 201 })
}
