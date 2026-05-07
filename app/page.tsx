import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrichAuthors } from '@/lib/enrich'
import PostCard from '@/components/PostCard'
import FeedFilter from '@/components/FeedFilter'
import Link from 'next/link'
import { Post, PostCategory, FeedSort, FeedFilter as FeedFilterType } from '@/types'

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']

interface PageProps {
  searchParams: Promise<{ sort?: string; filter?: string; category?: string; page?: string }>
}

async function PostList({ sort, filter, category, page }: {
  sort: FeedSort
  filter: FeedFilterType
  category: string
  page: number
}) {
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
  } else if (sort === 'trending') {
    // 24시간 내 글만, like*2 + comment 가중치 내림차순
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: posts, error } = await query
  if (error || !posts?.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-3xl mb-3">🤔</p>
        <p>아직 글이 없어요. 첫 번째로 글을 써보세요!</p>
        <Link href="/write" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          글쓰기
        </Link>
      </div>
    )
  }

  // 트렌딩: 클라이언트 정렬 (like*2 + comment)
  const sortedPosts = sort === 'trending'
    ? [...posts].sort((a, b) => (b.like_count * 2 + b.comment_count) - (a.like_count * 2 + a.comment_count))
    : posts

  const postsWithAuthors = await enrichAuthors(sortedPosts, supabase, {
    agentColumns: 'id, name, avatar_url, agent_type, model_info, status',
  }) as Post[]

  return (
    <div className="space-y-3">
      {postsWithAuthors.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const sort = (params.sort || 'latest') as FeedSort
  const filter = (params.filter || 'all') as FeedFilterType
  const category = params.category || ''
  const page = parseInt(params.page || '1')

  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <FeedFilter />
      </Suspense>
      <Suspense
        fallback={
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-5 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        }
      >
        <PostList sort={sort} filter={filter} category={category} page={page} />
      </Suspense>
    </div>
  )
}
