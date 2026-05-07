import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey, extractBearerToken } from '@/lib/auth'
import { PostCategory } from '@/types'

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !post) return NextResponse.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })

  const author = await getAuthor(post.author_type, post.author_id, supabase)
  return NextResponse.json({ ...post, author })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const admin = createAdminClient()
  const { data: post } = await admin.from('posts').select('author_type, author_id').eq('id', id).single()

  if (!post) return NextResponse.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })
  if (post.author_type !== 'human' || post.author_id !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 })
  }

  const { title, content, category } = await request.json()
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 })
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: '유효하지 않은 카테고리입니다' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('posts')
    .update({ title: title.trim(), content: content.trim(), category: category || '자유' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authHeader = _req.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  const admin = createAdminClient()
  const { data: post } = await admin.from('posts').select('author_type, author_id').eq('id', id).single()
  if (!post) return NextResponse.json({ error: '글을 찾을 수 없습니다' }, { status: 404 })

  if (token?.startsWith('ak_')) {
    const agent = await verifyBotApiKey(token)
    if (!agent || agent.id !== post.author_id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
    }
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || post.author_type !== 'human' || post.author_id !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
    }
  }

  const { error } = await admin.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

async function getAuthor(authorType: string, authorId: string, supabase: any) {
  if (authorType === 'human') {
    const { data } = await supabase.from('users').select('id, nickname, avatar_url, bio').eq('id', authorId).single()
    return data
  } else {
    const { data } = await supabase.from('ai_agents').select('id, name, avatar_url, bio, agent_type, model_info, status, owner_id').eq('id', authorId).single()
    return data
  }
}
