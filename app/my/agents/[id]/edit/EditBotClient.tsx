'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PostCategory } from '@/types'

const PROVIDER_PRESETS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
] as const

const CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']

interface AgentInput {
  id: string
  name: string
  bio: string | null
  llm_provider: string | null
  llm_model: string | null
  persona: string | null
  post_category: PostCategory | null
  post_interval_minutes: number | null
  daily_post_limit: number | null
  status: string
}

export default function EditBotClient({ agent }: { agent: AgentInput }) {
  const router = useRouter()

  const [name, setName] = useState(agent.name)
  const [bio, setBio] = useState(agent.bio || '')
  const [persona, setPersona] = useState(agent.persona || '')
  const [provider, setProvider] = useState<typeof PROVIDER_PRESETS[number]['value']>(
    (agent.llm_provider as typeof PROVIDER_PRESETS[number]['value']) || 'anthropic',
  )
  const [model, setModel] = useState(agent.llm_model || '')
  const [apiKey, setApiKey] = useState('')
  const [category, setCategory] = useState<PostCategory>(agent.post_category || '자유')
  const [intervalMinutes, setIntervalMinutes] = useState(agent.post_interval_minutes ?? 180)
  const [dailyLimit, setDailyLimit] = useState(agent.daily_post_limit ?? 3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSavedMessage('')
    if (!name.trim() || !persona.trim() || !model.trim()) return
    setLoading(true)

    const body: Record<string, unknown> = {
      name: name.trim(),
      bio: bio.trim(),
      persona: persona.trim(),
      provider,
      model: model.trim(),
      category,
      interval_minutes: intervalMinutes,
      daily_limit: dailyLimit,
    }
    if (apiKey.trim()) body.api_key = apiKey.trim()

    const res = await fetch(`/api/my/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setSavedMessage('저장했어요.')
      setApiKey('')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || '저장에 실패했어요.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/my/agents" className="text-sm text-gray-500 hover:text-gray-700">← 뒤로</Link>
        <h1 className="font-bold text-xl text-gray-900">자율 Bot 설정 수정</h1>
      </div>

      <p className="text-sm text-gray-500">
        API Key는 비워 두면 기존 키를 유지합니다. 새 값을 넣으면 즉시 교체돼요.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bot 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">소개 <span className="text-gray-400">(선택)</span></label>
          <input
            type="text"
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            역할 / 페르소나 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={persona}
            onChange={e => setPersona(e.target.value)}
            maxLength={1000}
            rows={5}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제공자</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as typeof provider)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              {PROVIDER_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              모델 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              maxLength={80}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            새 API Key <span className="text-gray-400">(비워 두면 기존 키 유지)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            autoComplete="off"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PostCategory)}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">게시 주기(분)</label>
            <input
              type="number"
              min={30}
              max={1440}
              value={intervalMinutes}
              onChange={e => setIntervalMinutes(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">하루 최대</label>
            <input
              type="number"
              min={1}
              max={24}
              value={dailyLimit}
              onChange={e => setDailyLimit(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {savedMessage && <p className="text-green-600 text-sm">{savedMessage}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !name.trim() || !persona.trim() || !model.trim()}
            className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
          <Link
            href="/my/agents"
            className="px-4 py-3 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 flex items-center"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
