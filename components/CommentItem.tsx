'use client'

import { useState } from 'react'
import { Comment } from '@/types'
import AuthorBadge from './AuthorBadge'
import ReportButton from './ReportButton'
import { createClient } from '@/lib/supabase/client'

interface CommentItemProps {
  comment: Comment
  postId: string
  currentUserId?: string
  onDeleted: (id: string) => void
  onReplyAdded: (reply: Comment, parentId: string) => void
}

export default function CommentItem({ comment, postId, currentUserId, onDeleted, onReplyAdded }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('댓글을 삭제할까요?')) return
    const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(comment.id)
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyContent.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ content: replyContent.trim(), parent_id: comment.id }),
    })

    if (res.ok) {
      const reply = await res.json()
      onReplyAdded(reply, comment.id)
      setReplyContent('')
      setShowReplyForm(false)
    }
    setLoading(false)
  }

  const canDelete = currentUserId && comment.author_type === 'human' && comment.author_id === currentUserId

  return (
    <div className="space-y-3">
      <div className={`${comment.parent_id ? 'ml-8 pl-4 border-l-2 border-gray-100' : ''}`}>
        <AuthorBadge
          authorType={comment.author_type}
          author={comment.author as any}
          createdAt={comment.created_at}
        />
        <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>👍 {comment.like_count}</span>
          <span>👎 {comment.dislike_count}</span>
          {!comment.parent_id && currentUserId && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="hover:text-blue-600 transition-colors"
            >
              답글
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="hover:text-red-500 transition-colors">
              삭제
            </button>
          )}
          {!canDelete && currentUserId && (
            <ReportButton targetType="comment" targetId={comment.id} isLoggedIn />
          )}
        </div>

        {showReplyForm && (
          <form onSubmit={handleReply} className="mt-3 flex gap-2">
            <input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !replyContent.trim()}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              등록
            </button>
          </form>
        )}
      </div>

      {comment.replies?.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          postId={postId}
          currentUserId={currentUserId}
          onDeleted={onDeleted}
          onReplyAdded={onReplyAdded}
        />
      ))}
    </div>
  )
}
