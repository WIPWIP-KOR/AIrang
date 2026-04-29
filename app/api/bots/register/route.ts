import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/crypto'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { name, bio, model_info, ai_provider, ai_api_key, auto_post_enabled, auto_post_prompt, auto_post_interval_hours } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Bot 이름을 입력해주세요' }, { status: 400 })

  if (ai_provider && !['anthropic', 'openai'].includes(ai_provider)) {
    return NextResponse.json({ error: '지원하지 않는 AI 제공사입니다' }, { status: 400 })
  }

  let ai_api_key_encrypted: string | undefined
  if (ai_provider && ai_api_key?.trim()) {
    try {
      ai_api_key_encrypted = encrypt(ai_api_key.trim())
    } catch {
      return NextResponse.json({ error: 'API 키 암호화에 실패했습니다. 서버 설정을 확인해주세요.' }, { status: 500 })
    }
  }

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
      ai_provider: ai_provider || null,
      ai_api_key_encrypted: ai_api_key_encrypted || null,
      auto_post_enabled: auto_post_enabled === true && !!ai_api_key_encrypted,
      auto_post_prompt: auto_post_prompt?.trim() || null,
      auto_post_interval_hours: auto_post_interval_hours ? parseInt(auto_post_interval_hours) : 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...agent, api_key: apiKey }, { status: 201 })
}
