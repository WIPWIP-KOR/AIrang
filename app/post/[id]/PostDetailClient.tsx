'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Post, Comment, ReactionType } from '@/types'
import AuthorBadge from '@/components/AuthorBadge'
import CommentItem from '@/components/CommentItem'
import { createClient } from '@/lib/supabase/client'

interface PostDetailClientProps {
  post: Post
  initialComments: Comment[]
  currentUser: { id: string; nickname: string } | null
}

export default function PostDetailClient({ post, initialComments, currentUser }: PostDetailClientProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [commentContent, setCommentContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [dislikeCount, setDislikeCount] = useState(post.dislike_count)
  const [userReaction, setUserReaction] = useState<ReactionType | null>(post.user_reaction || null)
  const router = useRouter()

  async function handleReaction(type: ReactionType) {
    if (!currentUser) {
      router.push(`/login?redirect=/post/${post.id}`)
      return
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (userReaction === type) {
      const res = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setLikeCount(data.like_count)
        setDislikeCount(data.dislike_count)
        setUserReaction(null)
      }
    } else {
      const res = await fetch(`/api/posts/${post.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const data = await res.json()
        setLikeCount(data.like_count)
        setDislikeCount(data.dislike_count)
        setUserReaction(type)
      }
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) {
      router.push(`/login?redirect=/post/${post.id}`)
      return
    }
    if (!commentContent.trim()) return
    setPosting(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ content: commentContent.trim() }),
    })

    if (res.ok) {
      const comment = await res.json()
      comment.author = { id: currentUser.id, nickname: currentUser.nickname }
      setComments(prev => [...prev, comment])
      setCommentContent('')
    }
    setPosting(false)
  }

  function handleCommentDeleted(id: string) {
    setComments(prev => prev.filter(c => c.id !== id))
  }

  function handleReplyAdded(reply: Comment, parentId: string) {
    setComments(prev => prev.map(c =>
      c.id === parentId ? { ...c, replies: [...(c.replies || []), reply] } : c
    ))
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← 뒤로
      </Link>

      <article className="bg-white border border-gray-100 rounded-xl p-6">
        <AuthorBadge
          authorType={post.author_type}
          author={post.author as any}
          createdAt={post.created_at}
          category={post.category}
        />

        <h1 className="mt-4 text-xl font-bold text-gray-900">{post.title}</h1>
        <div className="mt-4 text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => handleReaction('like')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              userReaction === 'like' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👍 {likeCount}
          </button>
          <button
            onClick={() => handleReaction('dislike')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              userReaction === 'dislike' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👎 {dislikeCount}
          </button>
        </div>
      </article>

      <section className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">댓글 {comments.length}개</h2>

        <div className="space-y-4">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={post.id}
              currentUserId={currentUser?.id}
              onDeleted={handleCommentDeleted}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>

        <form onSubmit={handleCommentSubmit} className="mt-6 flex gap-2">
          <input
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder={currentUser ? '댓글을 입력하세요...' : '로그인 후 댓글을 달 수 있어요'}
            disabled={!currentUser}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={posting || !commentContent.trim() || !currentUser}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {posting ? '...' : '등록'}
          </button>
        </form>

        {!currentUser && (
          <p className="mt-2 text-xs text-center text-gray-400">
            <Link href={`/login?redirect=/post/${post.id}`} className="text-blue-600 hover:underline">
              로그인
            </Link>
            하면 댓글을 달 수 있어요
          </p>
        )}
      </section>
    </div>
  )
}
