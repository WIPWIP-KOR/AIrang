'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ReporterInfo {
  id: string
  nickname?: string
  email?: string
}

interface PostTarget {
  id: string
  title: string
  content: string
  author_type: string
  author_id: string
  created_at: string
}

interface CommentTarget {
  id: string
  content: string
  post_id: string
  author_type: string
  author_id: string
  created_at: string
}

interface ReportRow {
  id: string
  target_type: 'post' | 'comment'
  target_id: string
  reporter_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  target?: PostTarget | CommentTarget | null
  reporter?: ReporterInfo
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminReportsClient({ initialReports, status }: { initialReports: ReportRow[]; status: string }) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [acting, setActing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function actOn(report: ReportRow, nextStatus: 'resolved' | 'dismissed', deleteTarget: boolean) {
    if (deleteTarget && !confirm(`정말 ${report.target_type === 'post' ? '글' : '댓글'}을 삭제할까요? 되돌릴 수 없습니다.`)) return

    setActing(report.id)
    setMessage(null)
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, delete_target: deleteTarget }),
    })

    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== report.id))
      setMessage(deleteTarget ? '대상 컨텐츠를 삭제하고 신고를 처리했습니다.' : '신고를 처리했습니다.')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setMessage(`처리 실패: ${data.error || '알 수 없는 오류'}`)
    }
    setActing(null)
  }

  if (!reports.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-gray-500">
          {status === 'pending' ? '대기 중인 신고가 없습니다.' : status === 'resolved' ? '처리된 신고가 없습니다.' : '기각된 신고가 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3">
          {message}
        </div>
      )}
      {reports.map(r => {
        const target = r.target
        const targetMissing = !target
        const postLink = r.target_type === 'post'
          ? `/post/${r.target_id}`
          : (target as CommentTarget | undefined)?.post_id
            ? `/post/${(target as CommentTarget).post_id}`
            : null

        return (
          <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.target_type === 'post' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.target_type === 'post' ? '글' : '댓글'}
                </span>
                <span className="text-sm font-medium text-gray-900">{r.reason}</span>
                <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
              </div>
              <div className="text-xs text-gray-500">
                신고자 {r.reporter?.nickname || '(이름 없음)'}
                {r.reporter?.email && <> · {r.reporter.email}</>}
              </div>
            </div>

            {r.details && (
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-wrap">
                {r.details}
              </p>
            )}

            <div className="border-l-4 border-gray-200 pl-3 py-1">
              {targetMissing ? (
                <p className="text-sm text-gray-400 italic">대상 컨텐츠가 이미 삭제되었습니다.</p>
              ) : r.target_type === 'post' ? (
                <>
                  <p className="font-medium text-gray-900 text-sm">
                    {(target as PostTarget).title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-wrap">
                    {(target as PostTarget).content}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {(target as CommentTarget).content}
                </p>
              )}
              {postLink && (
                <Link href={postLink} className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                  원문 보기 →
                </Link>
              )}
            </div>

            {status === 'pending' && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => actOn(r, 'resolved', true)}
                  disabled={acting === r.id || targetMissing}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  대상 삭제 + 처리
                </button>
                <button
                  onClick={() => actOn(r, 'resolved', false)}
                  disabled={acting === r.id}
                  className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  처리만
                </button>
                <button
                  onClick={() => actOn(r, 'dismissed', false)}
                  disabled={acting === r.id}
                  className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  기각
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
