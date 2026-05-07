import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/crypto'
import { PostCategory, AgentStatus } from '@/types'

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']
const VALID_STATUSES: AgentStatus[] = ['active', 'inactive']
const VALID_PROVIDERS = ['anthropic', 'openai'] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: agent, error } = await admin
    .from('ai_agents')
    .select('id, owner_id, name, bio, model_info, agent_type, status, last_active_at, created_at, is_autonomous, llm_provider, llm_model, persona, post_category, post_interval_minutes, daily_post_limit, posts_today, posts_today_date, next_run_at')
    .eq('id', id)
    .single()

  if (error || !agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
  if (agent.owner_id !== user.id) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  return NextResponse.json(agent)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: agent } = await admin
    .from('ai_agents')
    .select('id, owner_id, is_autonomous')
    .eq('id', id)
    .single()
  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
  if (agent.owner_id !== user.id) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })

  const update: Record<string, unknown> = {}

  // 상태 토글 (모든 agent 종류에 허용)
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'status는 active 또는 inactive 여야 합니다' }, { status: 400 })
    }
    update.status = body.status
    // 다시 활성화하면 즉시 다음 실행 가능 상태로 (자율 봇만)
    if (body.status === 'active' && agent.is_autonomous) {
      update.next_run_at = new Date().toISOString()
    }
  }

  // 일반 필드
  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    }
    update.name = String(body.name).trim().slice(0, 30)
  }
  if (body.bio !== undefined) {
    update.bio = body.bio ? String(body.bio).trim().slice(0, 100) : null
  }

  // 자율 봇 전용 필드
  if (agent.is_autonomous) {
    if (body.persona !== undefined) {
      if (!String(body.persona).trim()) {
        return NextResponse.json({ error: '역할(페르소나)을 입력해주세요' }, { status: 400 })
      }
      update.persona = String(body.persona).trim().slice(0, 1000)
    }
    if (body.provider !== undefined) {
      if (!VALID_PROVIDERS.includes(body.provider)) {
        return NextResponse.json({ error: 'provider는 anthropic 또는 openai 여야 합니다' }, { status: 400 })
      }
      update.llm_provider = body.provider
    }
    if (body.model !== undefined) {
      if (!String(body.model).trim()) {
        return NextResponse.json({ error: '모델 이름을 입력해주세요' }, { status: 400 })
      }
      update.llm_model = String(body.model).trim().slice(0, 80)
    }
    if (body.api_key !== undefined && String(body.api_key).trim()) {
      try {
        update.llm_api_key_encrypted = encryptSecret(String(body.api_key).trim())
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'API Key 암호화 실패'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }
    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: '유효하지 않은 카테고리입니다' }, { status: 400 })
      }
      update.post_category = body.category
    }
    if (body.interval_minutes !== undefined) {
      const n = Number(body.interval_minutes)
      if (!Number.isFinite(n) || n < 30 || n > 1440) {
        return NextResponse.json({ error: '게시 주기는 30~1440분 사이여야 합니다' }, { status: 400 })
      }
      update.post_interval_minutes = Math.floor(n)
    }
    if (body.daily_limit !== undefined) {
      const n = Number(body.daily_limit)
      if (!Number.isFinite(n) || n < 1 || n > 24) {
        return NextResponse.json({ error: '하루 게시량은 1~24개 사이여야 합니다' }, { status: 400 })
      }
      update.daily_post_limit = Math.floor(n)
    }

    // 모델 정보 표시용 텍스트도 같이 갱신
    if (update.llm_provider || update.llm_model) {
      const provider = update.llm_provider || body.provider
      const model = update.llm_model || body.model
      if (provider && model) update.model_info = `${provider}/${model}`
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('ai_agents')
    .update(update)
    .eq('id', id)
    .select('id, name, bio, model_info, agent_type, status, last_active_at, is_autonomous, llm_provider, llm_model, persona, post_category, post_interval_minutes, daily_post_limit, next_run_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
