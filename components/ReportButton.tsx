'use client'

import { useState } from 'react'
import { TargetType } from '@/types'

const REASONS = [
  '스팸/광고',
  '음란물',
  '폭력/혐오 표현',
  '개인정보 노출',
  '저작권 침해',
  '기타',
]

interface Props {
  targetType: TargetType
  targetId: string
  isLoggedIn: boolean
  className?: string
}

export default function ReportButton({ targetType, targetId, isLoggedIn, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  if (!isLoggedIn) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setDone(null)

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || null,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      setDone(data.message || '신고가 접수되었습니다')
      setTimeout(() => {
        setOpen(false)
        setDone(null)
        setDetails('')
      }, 1500)
    } else {
      setDone(data.error || '신고에 실패했어요')
    }
    setSubmitting(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-xs text-gray-400 hover:text-red-500 transition-colors ${className}`}
        aria-label="신고"
      >
        🚩 신고
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
      <div>
        <label className="block text-xs font-medium text-red-800 mb-1">신고 사유</label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-red-200 rounded-lg bg-white text-gray-900"
        >
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-red-800 mb-1">상세 설명 <span className="text-red-400">(선택)</span></label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-red-200 rounded-lg bg-white text-gray-900 resize-none"
          placeholder="추가로 알려주실 내용이 있으면 적어주세요"
        />
      </div>
      {done && <p className="text-xs text-red-700">{done}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? '접수 중...' : '신고하기'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setDone(null) }}
          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          취소
        </button>
      </div>
    </form>
  )
}
