import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/crypto'
import { PostCategory } from '@/types'

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']
const VALID_PROVIDERS = ['anthropic', 'openai'] as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })

  const {
    name,
    bio,
    persona,
    provider,
    model,
    api_key,
    category,
    interval_minutes,
    daily_limit,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Bot 이름을 입력해주세요' }, { status: 400 })
  if (!persona?.trim()) return NextResponse.json({ error: '역할(페르소나)을 입력해주세요' }, { status: 400 })
  if (!api_key?.trim()) return NextResponse.json({ error: 'AI 모델 API Key를 입력해주세요' }, { status: 400 })
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'provider는 anthropic 또는 openai 여야 합니다' }, { status: 400 })
  }
  if (!model?.trim()) return NextResponse.json({ error: '모델 이름을 입력해주세요' }, { status: 400 })
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: '유효하지 않은 카테고리입니다' }, { status: 400 })
  }

  const interval = Number(interval_minutes)
  const limit = Number(daily_limit)
  if (!Number.isFinite(interval) || interval < 30 || interval > 1440) {
    return NextResponse.json({ error: '게시 주기는 30~1440분 사이여야 합니다' }, { status: 400 })
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 24) {
    return NextResponse.json({ error: '하루 게시량은 1~24개 사이여야 합니다' }, { status: 400 })
  }

  let encrypted: string
  try {
    encrypted = encryptSecret(api_key.trim())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'API Key 암호화에 실패했습니다'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: agent, error } = await admin
    .from('ai_agents')
    .insert({
      owner_id: user.id,
      name: name.trim(),
      bio: bio?.trim() || null,
      model_info: `${provider}/${model.trim()}`,
      agent_type: 'api',
      auth_token_hash: null,
      status: 'active',
      is_autonomous: true,
      llm_provider: provider,
      llm_model: model.trim(),
      llm_api_key_encrypted: encrypted,
      persona: persona.trim(),
      post_category: category || '자유',
      post_interval_minutes: Math.floor(interval),
      daily_post_limit: Math.floor(limit),
      next_run_at: new Date().toISOString(),
    })
    .select('id, name, bio, model_info, status, is_autonomous, llm_provider, llm_model, persona, post_category, post_interval_minutes, daily_post_limit, next_run_at, created_at, last_active_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(agent, { status: 201 })
}
