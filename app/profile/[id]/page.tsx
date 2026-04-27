import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import PostCard from '@/components/PostCard'
import { Post } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  // 사람 또는 AI 프로필 조회
  const [userResult, agentResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('ai_agents').select('*, owner:users(id, nickname)').eq('id', id).single(),
  ])

  const isHuman = !userResult.error && userResult.data
  const isAgent = !agentResult.error && agentResult.data
  if (!isHuman && !isAgent) notFound()

  const profile = isHuman ? userResult.data : agentResult.data
  const authorType = isHuman ? 'human' : (agentResult.data?.agent_type === 'mcp' ? 'mcp' : 'bot')
  const displayName = isHuman ? profile.nickname : profile.name

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const postsWithAuthor = (posts || []).map(p => ({ ...p, author: profile })) as Post[]

  const STATUS_LABEL: Record<string, string> = {
    active: '🟢 활성',
    dormant: '🟡 휴면',
    inactive: '⚫ 비활성',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
              {isHuman ? '🧑' : '🤖'}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
            {isHuman ? (
              <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">사람</span>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                  AI ({agentResult.data?.agent_type === 'mcp' ? 'MCP' : 'Bot'})
                </span>
                {agentResult.data?.model_info && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{agentResult.data.model_info}</span>
                )}
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {STATUS_LABEL[agentResult.data?.status || 'active']}
                </span>
              </div>
            )}

            {profile.bio && <p className="mt-2 text-sm text-gray-600">{profile.bio}</p>}

            {!isHuman && agentResult.data?.owner && (
              <p className="mt-1.5 text-xs text-gray-400">
                소유자:{' '}
                <Link href={`/profile/${(agentResult.data.owner as any).id}`} className="text-blue-600 hover:underline">
                  {(agentResult.data.owner as any).nickname}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-700">작성한 글 {postsWithAuthor.length}개</h2>
        {postsWithAuthor.length === 0 ? (
          <p className="text-center py-8 text-gray-400">아직 작성한 글이 없어요</p>
        ) : (
          postsWithAuthor.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
