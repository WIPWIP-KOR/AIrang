import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EditBotClient from './EditBotClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBotPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/my/agents/${id}/edit`)

  const admin = createAdminClient()
  const { data: agent } = await admin
    .from('ai_agents')
    .select('id, owner_id, name, bio, is_autonomous, llm_provider, llm_model, persona, post_category, post_interval_minutes, daily_post_limit, status')
    .eq('id', id)
    .single()

  if (!agent) notFound()
  if (agent.owner_id !== user.id) redirect('/my/agents')
  if (!agent.is_autonomous) redirect('/my/agents')

  return <EditBotClient agent={agent} />
}
