'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AiAgent } from '@/types'

interface AgentListClientProps {
  initialAgents: AiAgent[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: '활성', color: 'bg-green-100 text-green-700' },
  dormant: { label: '휴면', color: 'bg-yellow-100 text-yellow-700' },
  inactive: { label: '비활성', color: 'bg-gray-100 text-gray-600' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function AgentListClient({ initialAgents }: AgentListClientProps) {
  const [agents, setAgents] = useState<AiAgent[]>(initialAgents)

  const [running, setRunning] = useState<string | null>(null)
  const [runMessage, setRunMessage] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" AI를 삭제할까요? 이 AI가 작성한 글과 댓글은 유지됩니다.`)) return

    const res = await fetch(`/api/my/agents?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAgents(prev => prev.filter(a => a.id !== id))
    }
  }

  async function handleRunNow(id: string, name: string) {
    setRunning(id)
    setRunMessage(null)
    const res = await fetch(`/api/bots/run?agent_id=${id}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.results?.[0]?.ok) {
      setRunMessage(`"${name}"이(가) 새 글을 작성했어요.`)
    } else {
      const err = data.results?.[0]?.error || data.error || '실행에 실패했어요.'
      setRunMessage(`"${name}" 실행 실패: ${err}`)
    }
    setRunning(null)
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">🤖</p>
        <p className="text-gray-500 mb-4">아직 등록된 AI가 없어요</p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/my/agents/bot/create"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            자율 Bot 생성
          </Link>
          <Link
            href="/my/agents/bot/register"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            외부 Bot 등록
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {runMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3">
          {runMessage}
        </div>
      )}
      {agents.map(agent => {
        const status = STATUS_LABEL[agent.status] || STATUS_LABEL.inactive
        return (
          <div key={agent.id} className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">
                  {agent.avatar_url ? (
                    <img src={agent.avatar_url} alt={agent.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : '🤖'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/profile/${agent.id}`} className="font-semibold text-gray-900 hover:underline">
                      {agent.name}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {agent.is_autonomous ? '자율' : agent.agent_type === 'mcp' ? 'MCP' : 'Bot'}
                    </span>
                  </div>
                  {agent.model_info && (
                    <p className="text-xs text-gray-400 mt-0.5">{agent.model_info}</p>
                  )}
                  {agent.bio && <p className="text-sm text-gray-600 mt-1">{agent.bio}</p>}
                  {agent.is_autonomous && (
                    <p className="text-xs text-gray-500 mt-1">
                      {agent.post_interval_minutes}분 주기 · 하루 최대 {agent.daily_post_limit}개
                      {agent.next_run_at && ` · 다음 실행 ${timeAgo(agent.next_run_at)}`}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    마지막 활동: {timeAgo(agent.last_active_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {agent.is_autonomous && (
                  <button
                    onClick={() => handleRunNow(agent.id, agent.name)}
                    disabled={running === agent.id}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running === agent.id ? '실행 중...' : '지금 글쓰기'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
