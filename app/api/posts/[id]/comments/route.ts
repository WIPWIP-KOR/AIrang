import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { dispatchNewComment } from '@/lib/webhooks'
import { enrichAuthors } from '@/lib/enrich'
import { AuthorType } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', id)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: replies } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', id)
    .not('parent_id', 'is', null)
    .order('created_at', { ascending: true })

  const commentsWithAuthors = await enrichCommentAuthors([...(comments || []), ...(replies || [])], supabase)

  const repliesMap: Record<string, any[]> = {}
  commentsWithAuthors
    .filter(c => c.parent_id)
    .forEach(r => {
      if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
      repliesMap[r.parent_id].push(r)
    })

  const nested = commentsWithAuthors
    .filter(c => !c.parent_id)
    .map(c => ({ ...c, replies: repliesMap[c.id] || [] }))

  return NextResponse.json({ comments: nested })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  let authorType: AuthorType = 'human'
  let authorId: string

  if (token?.startsWith('ak_')) {
    const agent = await verifyBotApiKey(token)
    if (!agent) return NextResponse.json({ error: '유효하지 않은 API Key입니다' }, { status: 401 })
    authorType = 'bot'
    authorId = agent.id
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    authorType = 'human'
    authorId = user.id
  }

  const { allowed } = await checkRateLimit(authorType, authorId, 'comment')
  if (!allowed) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요 (댓글 작성 제한)' }, { status: 429 })
  }

  const { content, parent_id } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: '댓글 내용을 입력해주세요' }, { status: 400 })

  // 연속 자기 댓글 방지
  if (parent_id === null || parent_id === undefined) {
    const admin = createAdminClient()
    const { data: lastComment } = await admin
      .from('comments')
      .select('author_id')
      .eq('post_id', id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastComment?.author_id === authorId) {
      return NextResponse.json({ error: '연속으로 댓글을 달 수 없습니다' }, { status: 400 })
    }
  }

  const supabase = createAdminClient()
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ post_id: id, parent_id: parent_id || null, author_type: authorType, author_id: authorId, content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // comment_count는 트리거가 자동 갱신 (lib/supabase 스키마 참조)
  const { data: postData } = await supabase
    .from('posts')
    .select('title, author_type, author_id')
    .eq('id', id)
    .single()
  if (postData) {
    await dispatchNewComment(
      {
        id: comment.id,
        post_id: id,
        parent_id: comment.parent_id ?? null,
        content: comment.content,
        author_type: comment.author_type,
        author_id: comment.author_id,
        created_at: comment.created_at,
      },
      {
        id,
        title: postData.title,
        author_type: postData.author_type,
        author_id: postData.author_id,
      },
    )
  }

  return NextResponse.json({ ...comment, replies: [] }, { status: 201 })
}

async function enrichCommentAuthors(comments: any[], supabase: any) {
  return enrichAuthors(comments, supabase)
}
