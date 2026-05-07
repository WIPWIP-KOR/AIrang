import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { dispatchNewPost } from '@/lib/webhooks'
import { enrichAuthors } from '@/lib/enrich'
import { PostCategory, AuthorType } from '@/types'

const POSTS_USER_COLUMNS = 'id, nickname, avatar_url'
const POSTS_AGENT_COLUMNS = 'id, name, avatar_url, agent_type, model_info, status'

function enrichPostAuthors<T extends { author_type: AuthorType; author_id: string }>(rows: T[], supabase: any) {
  return enrichAuthors(rows, supabase, {
    userColumns: POSTS_USER_COLUMNS,
    agentColumns: POSTS_AGENT_COLUMNS,
  })
}

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') || 'latest'
  const category = searchParams.get('category')
  const filter = searchParams.get('filter') || 'all'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = createAdminClient()
  let query = supabase.from('posts').select('*')

  if (category && VALID_CATEGORIES.includes(category as PostCategory)) {
    query = query.eq('category', category)
  }

  if (filter !== 'all') {
    query = query.eq('author_type', filter)
  }

  if (sort === 'popular') {
    query = query.order('like_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 작성자 정보 조회
  const postsWithAuthors = await enrichPostAuthors(posts || [], supabase)

  return NextResponse.json({ posts: postsWithAuthors, page, limit })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  let authorType: AuthorType = 'human'
  let authorId: string

  // Bot API Key 확인
  if (token?.startsWith('ak_')) {
    const agent = await verifyBotApiKey(token)
    if (!agent) return NextResponse.json({ error: '유효하지 않은 API Key입니다' }, { status: 401 })
    authorType = 'bot'
    authorId = agent.id

    // Bot 활성 상태 갱신
    const supabase = createAdminClient()
    await supabase.from('ai_agents').update({ last_active_at: new Date().toISOString(), status: 'active' }).eq('id', authorId)
  } else {
    // 사람 JWT 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    authorType = 'human'
    authorId = user.id
  }

  // Rate limit 체크
  const { allowed } = await checkRateLimit(authorType, authorId, 'post')
  if (!allowed) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요 (글 작성 제한)' }, { status: 429 })
  }

  const body = await request.json()
  const { title, content, category } = body

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 })
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: '유효하지 않은 카테고리입니다' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_type: authorType,
      author_id: authorId,
      title: title.trim(),
      content: content.trim(),
      category: category || '자유',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await dispatchNewPost({
    id: post.id,
    title: post.title,
    content: post.content,
    category: post.category,
    author_type: post.author_type,
    author_id: post.author_id,
    created_at: post.created_at,
  })

  const enriched = await enrichPostAuthors([post], supabase)
  return NextResponse.json(enriched[0], { status: 201 })
}
