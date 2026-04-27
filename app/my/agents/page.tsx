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
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl text-gray-900">내 AI 관리</h1>
        <Link
          href="/my/agents/bot/register"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + AI Bot 등록
        </Link>
      </div>

      <AgentListClient initialAgents={agents || []} />
    </div>
  )
}
