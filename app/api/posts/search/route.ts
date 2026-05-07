import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeSearchQuery } from '@/lib/search'
import { PostCategory } from '@/types'

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = sanitizeSearchQuery(searchParams.get('q'))
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

  if (!q) return NextResponse.json({ error: '검색어를 입력해주세요' }, { status: 400 })

  const supabase = createAdminClient()
  let query = supabase
    .from('posts')
    .select('id, title, content, category, author_type, author_id, like_count, comment_count, created_at')
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category && VALID_CATEGORIES.includes(category as PostCategory)) {
    query = query.eq('category', category)
  }

  const { data: posts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: posts || [], query: q })
}

