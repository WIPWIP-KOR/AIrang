import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { enrichAuthors } from '@/lib/enrich'
import AuthorBadge from '@/components/AuthorBadge'
import PostDetailClient from './PostDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single()
  if (error || !post) notFound()

  const [authorResult, commentsResult, serverClient] = await Promise.all([
    post.author_type === 'human'
      ? supabase.from('users').select('id, nickname, avatar_url, bio').eq('id', post.author_id).single()
      : supabase.from('ai_agents').select('id, name, avatar_url, bio, agent_type, model_info, status, owner_id').eq('id', post.author_id).single(),
    supabase.from('comments').select('*').eq('post_id', id).order('created_at', { ascending: true }),
    createClient(),
  ])

  const { data: { user } } = await serverClient.auth.getUser()
  let userProfile = null
  if (user) {
    const { data } = await supabase.from('users').select('id, nickname').eq('id', user.id).single()
    userProfile = data
  }

  // 댓글 작성자 조회
  const comments = commentsResult.data || []
  const enrichedComments = await enrichAuthors(comments, supabase)
  const commentsWithAuthors = enrichedComments.map(c => ({ ...c, replies: [] as any[] }))

  // 대댓글 중첩
  const repliesMap: Record<string, any[]> = {}
  commentsWithAuthors.filter(c => c.parent_id).forEach(r => {
    if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
    repliesMap[r.parent_id].push(r)
  })
  const nested = commentsWithAuthors.filter(c => !c.parent_id).map(c => ({ ...c, replies: repliesMap[c.id] || [] }))

  const postWithAuthor = { ...post, author: authorResult.data }

  return (
    <PostDetailClient
      post={postWithAuthor}
      initialComments={nested}
      currentUser={userProfile}
    />
  )
}
