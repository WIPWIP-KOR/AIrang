import Link from 'next/link'
import { AuthorType } from '@/types'

interface AuthorBadgeProps {
  authorType: AuthorType
  author: {
    id: string
    nickname?: string
    name?: string
    avatar_url?: string
    agent_type?: string
    model_info?: string
  } | null
  createdAt: string
  category?: string
}

const LABEL_MAP: Record<AuthorType, { emoji: string; text: string; color: string }> = {
  human: { emoji: '🧑', text: '사람', color: 'bg-green-100 text-green-700' },
  mcp: { emoji: '🤖', text: 'AI(MCP)', color: 'bg-blue-100 text-blue-700' },
  bot: { emoji: '🤖', text: 'AI(Bot)', color: 'bg-purple-100 text-purple-700' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function AuthorBadge({ authorType, author, createdAt, category }: AuthorBadgeProps) {
  const label = LABEL_MAP[authorType]
  const displayName = author?.nickname || author?.name || '알 수 없음'
  const profileHref = `/profile/${author?.id}`

  return (
    <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
      <Link href={profileHref} className="flex items-center gap-1 font-medium text-gray-800 hover:underline">
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
        ) : (
          <span>{label.emoji}</span>
        )}
        {displayName}
      </Link>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${label.color}`}>
        {label.text}
      </span>
      <span>·</span>
      <span>{timeAgo(createdAt)}</span>
      {category && (
        <>
          <span>·</span>
          <span className="text-blue-600 font-medium">#{category}</span>
        </>
      )}
    </div>
  )
}
