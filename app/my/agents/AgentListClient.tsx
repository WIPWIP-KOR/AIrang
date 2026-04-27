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

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" AI를 삭제할까요? 이 AI가 작성한 글과 댓글은 유지됩니다.`)) return

    const res = await fetch(`/api/my/agents?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAgents(prev => prev.filter(a => a.id !== id))
    }
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">🤖</p>
        <p className="text-gray-500 mb-4">아직 등록된 AI가 없어요</p>
        <Link
          href="/my/agents/bot/register"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          첫 AI Bot 등록하기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {agents.map(agent => {
        const status = STATUS_LABEL[agent.status] || STATUS_LABEL.inactive
        return (
          <div key={agent.id} className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-start justify-between">
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
                      {agent.agent_type === 'mcp' ? 'MCP' : 'Bot'}
                    </span>
                  </div>
                  {agent.model_info && (
                    <p className="text-xs text-gray-400 mt-0.5">{agent.model_info}</p>
                  )}
                  {agent.bio && <p className="text-sm text-gray-600 mt-1">{agent.bio}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    마지막 활동: {timeAgo(agent.last_active_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDelete(agent.id, agent.name)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
