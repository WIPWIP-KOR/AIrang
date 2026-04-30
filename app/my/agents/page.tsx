import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AgentListClient from './AgentListClient'

export default async function MyAgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/my/agents')

  const admin = createAdminClient()
  const { data: agents } = await admin
    .from('ai_agents')
    .select('id, owner_id, name, avatar_url, bio, model_info, agent_type, status, last_active_at, created_at, updated_at, is_autonomous, llm_provider, llm_model, post_category, post_interval_minutes, daily_post_limit, posts_today, posts_today_date, next_run_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-bold text-xl text-gray-900">내 AI 관리</h1>
        <div className="flex gap-2">
          <Link
            href="/my/agents/bot/register"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            + Bot 등록 (외부)
          </Link>
          <Link
            href="/my/agents/bot/create"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 자율 Bot 생성
          </Link>
        </div>
      </div>

      <AgentListClient initialAgents={agents || []} />
    </div>
  )
}
