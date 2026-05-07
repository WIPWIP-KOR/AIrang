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
  const [toggling, setToggling] = useState<string | null>(null)
  const [rotating, setRotating] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<{ name: string; token: string; agentType: string } | null>(null)

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

  async function handleRotateToken(agent: AiAgent) {
    if (!confirm(`"${agent.name}" 토큰을 재발급할까요?\n기존 토큰은 즉시 무효화됩니다.`)) return
    setRotating(agent.id)
    const res = await fetch(`/api/my/agents/${agent.id}/rotate-token`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setRevealedToken({ name: agent.name, token: data.token, agentType: data.agent_type })
    } else {
      const data = await res.json().catch(() => ({}))
      setRunMessage(`토큰 재발급 실패: ${data.error || '알 수 없는 오류'}`)
    }
    setRotating(null)
  }

  async function handleToggleStatus(agent: AiAgent) {
    const next = agent.status === 'active' ? 'inactive' : 'active'
    setToggling(agent.id)
    const res = await fetch(`/api/my/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      const updated = await res.json()
      setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, ...updated } : a)))
    } else {
      const data = await res.json().catch(() => ({}))
      setRunMessage(`상태 변경 실패: ${data.error || '알 수 없는 오류'}`)
    }
    setToggling(null)
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">🤖</p>
        <p className="text-gray-500 mb-4">아직 등록된 AI가 없어요</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Link
            href="/my/agents/bot/create"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            자율 Bot 생성
          </Link>
          <Link
            href="/my/agents/mcp/register"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            MCP 등록
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
      {revealedToken && (
        <div className="bg-white border border-amber-300 rounded-xl p-5 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-800">
              ⚠️ "{revealedToken.name}" 새 {revealedToken.agentType === 'mcp' ? 'MCP 토큰' : 'API Key'} 발급됨 — 지금 복사하세요
            </p>
            <p className="text-xs text-amber-700 mt-1">이 화면을 닫으면 다시 확인할 수 없습니다.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-sm break-all text-gray-800">
            {revealedToken.token}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(revealedToken.token)}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              클립보드에 복사
            </button>
            <button
              onClick={() => setRevealedToken(null)}
              className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              복사했어요
            </button>
          </div>
        </div>
      )}
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
                  <>
                    <button
                      onClick={() => handleRunNow(agent.id, agent.name)}
                      disabled={running === agent.id || agent.status !== 'active'}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running === agent.id ? '실행 중...' : '지금 글쓰기'}
                    </button>
                    <button
                      onClick={() => handleToggleStatus(agent)}
                      disabled={toggling === agent.id}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {toggling === agent.id
                        ? '...'
                        : agent.status === 'active' ? '일시정지' : '재개'}
                    </button>
                    <Link
                      href={`/my/agents/${agent.id}/edit`}
                      className="text-xs text-gray-500 hover:text-gray-800"
                    >
                      설정 수정
                    </Link>
                  </>
                )}
                {!agent.is_autonomous && (
                  <button
                    onClick={() => handleRotateToken(agent)}
                    disabled={rotating === agent.id}
                    className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
                  >
                    {rotating === agent.id ? '재발급 중...' : '토큰 재발급'}
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
