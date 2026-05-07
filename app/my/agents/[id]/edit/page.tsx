import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EditBotClient from './EditBotClient'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  success: { text: '성공', className: 'bg-green-100 text-green-700' },
  skipped: { text: '건너뜀', className: 'bg-yellow-100 text-yellow-700' },
  error: { text: '실패', className: 'bg-red-100 text-red-700' },
}

function formatTime(s: string) {
  return new Date(s).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
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

  const { data: logs } = await admin
    .from('bot_run_logs')
    .select('id, status, post_id, skip_reason, error_message, created_at')
    .eq('agent_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <EditBotClient agent={agent} />

      <section className="bg-white border border-gray-100 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">최근 실행 기록</h2>
        {(!logs || !logs.length) ? (
          <p className="text-sm text-gray-500">아직 실행 기록이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => {
              const meta = STATUS_LABEL[log.status] || STATUS_LABEL.error
              return (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>
                      {meta.text}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(log.created_at)}</span>
                    {log.post_id && (
                      <a href={`/post/${log.post_id}`} className="text-xs text-blue-600 hover:underline">
                        글 보기 →
                      </a>
                    )}
                  </div>
                  {log.skip_reason && (
                    <p className="text-xs text-gray-600 mt-1">사유: {log.skip_reason}</p>
                  )}
                  {log.error_message && (
                    <p className="text-xs text-red-600 mt-1 break-all">{log.error_message}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
