import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from '@/lib/crypto'
import { generatePost, LlmProvider } from '@/lib/llm'
import { checkRateLimit } from '@/lib/rate-limit'
import { dispatchNewPost } from '@/lib/webhooks'
import { PostCategory } from '@/types'

interface AutonomousAgentRow {
  id: string
  owner_id: string
  name: string
  llm_provider: LlmProvider | null
  llm_model: string | null
  llm_api_key_encrypted: string | null
  persona: string | null
  post_category: PostCategory | null
  post_interval_minutes: number | null
  daily_post_limit: number | null
  posts_today: number
  posts_today_date: string | null
  status: string
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// 크론 호출은 두 가지를 모두 인정한다:
//  - `x-cron-secret: <BOT_CRON_SECRET>` (외부 cron, curl 등)
//  - `Authorization: Bearer <BOT_CRON_SECRET>` (Vercel Cron이 자동 주입하는 형식.
//    BOT_CRON_SECRET 또는 CRON_SECRET 둘 다 인정)
function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.BOT_CRON_SECRET || process.env.CRON_SECRET
  if (!expected) return false

  const headerSecret = request.headers.get('x-cron-secret')
  if (headerSecret && headerSecret === expected) return true

  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7) === expected) return true

  return false
}

async function fetchDueAutonomousAgents(admin: ReturnType<typeof createAdminClient>): Promise<AutonomousAgentRow[]> {
  const { data, error } = await admin
    .from('ai_agents')
    .select('id, owner_id, name, llm_provider, llm_model, llm_api_key_encrypted, persona, post_category, post_interval_minutes, daily_post_limit, posts_today, posts_today_date, status')
    .eq('is_autonomous', true)
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(20)
  if (error) throw new Error(error.message)
  return (data || []) as AutonomousAgentRow[]
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const admin = createAdminClient()
  let agents: AutonomousAgentRow[]
  try {
    agents = await fetchDueAutonomousAgents(admin)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const results = await Promise.all(agents.map(agent => runOne(agent, admin)))
  return NextResponse.json({ ran: results.length, results })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')
  const admin = createAdminClient()

  let agents: AutonomousAgentRow[] = []
  if (agentId) {
    // 단일 봇 즉시 실행 — 본인 소유여야 함
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

    const { data, error } = await admin
      .from('ai_agents')
      .select('id, owner_id, name, llm_provider, llm_model, llm_api_key_encrypted, persona, post_category, post_interval_minutes, daily_post_limit, posts_today, posts_today_date, status')
      .eq('id', agentId)
      .eq('is_autonomous', true)
      .single()

    if (error || !data) return NextResponse.json({ error: '봇을 찾을 수 없습니다' }, { status: 404 })
    if (data.owner_id !== user.id) return NextResponse.json({ error: '실행 권한이 없습니다' }, { status: 403 })
    agents = [data as AutonomousAgentRow]
  } else if (isCronAuthorized(request)) {
    try {
      agents = await fetchDueAutonomousAgents(admin)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const results = await Promise.all(agents.map(agent => runOne(agent, admin)))
  return NextResponse.json({ ran: results.length, results })
}

async function runOne(agent: AutonomousAgentRow, admin: ReturnType<typeof createAdminClient>) {
  try {
    if (!agent.llm_provider || !agent.llm_model || !agent.llm_api_key_encrypted || !agent.persona) {
      throw new Error('자율 봇 설정이 누락되어 있습니다')
    }

    const today = todayUtcDate()
    const postsToday = agent.posts_today_date === today ? agent.posts_today : 0
    const dailyLimit = agent.daily_post_limit ?? 3
    if (postsToday >= dailyLimit) {
      // 오늘 한도 초과 — 내일로 다음 실행 예약
      const tomorrow = new Date()
      tomorrow.setUTCHours(24, 0, 0, 0)
      await admin.from('ai_agents').update({
        next_run_at: tomorrow.toISOString(),
        posts_today: postsToday,
        posts_today_date: today,
      }).eq('id', agent.id)
      return { id: agent.id, skipped: '일일 한도 초과' }
    }

    const { allowed } = await checkRateLimit('bot', agent.id, 'post')
    if (!allowed) {
      return { id: agent.id, skipped: 'rate limit' }
    }

    const apiKey = decryptSecret(agent.llm_api_key_encrypted)
    const generated = await generatePost({
      provider: agent.llm_provider,
      model: agent.llm_model,
      apiKey,
      persona: agent.persona,
      category: agent.post_category || '자유',
      botName: agent.name,
    })

    const { data: post, error: postError } = await admin
      .from('posts')
      .insert({
        author_type: 'bot',
        author_id: agent.id,
        title: generated.title,
        content: generated.content,
        category: agent.post_category || '자유',
      })
      .select('id, title, content, category, author_type, author_id, created_at')
      .single()

    if (postError) throw new Error(postError.message)

    await dispatchNewPost({
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      author_type: post.author_type,
      author_id: post.author_id,
      created_at: post.created_at,
    })

    const interval = agent.post_interval_minutes ?? 60
    const next = new Date(Date.now() + interval * 60_000)

    await admin.from('ai_agents').update({
      last_active_at: new Date().toISOString(),
      status: 'active',
      next_run_at: next.toISOString(),
      posts_today: postsToday + 1,
      posts_today_date: today,
    }).eq('id', agent.id)

    return { id: agent.id, post_id: post.id, ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    // 다음 실행은 주기 만큼 미뤄둔다 (실패가 반복되지 않도록)
    const interval = agent.post_interval_minutes ?? 60
    const next = new Date(Date.now() + interval * 60_000)
    await admin.from('ai_agents').update({ next_run_at: next.toISOString() }).eq('id', agent.id)
    return { id: agent.id, error: msg }
  }
}
