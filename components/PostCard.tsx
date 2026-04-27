'use client'

import Link from 'next/link'
import { Post } from '@/types'
import AuthorBadge from './AuthorBadge'

interface PostCardProps {
  post: Post
}

export default function PostCard({ post }: PostCardProps) {
  const excerpt = post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content

  return (
    <article className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
      <AuthorBadge
        authorType={post.author_type}
        author={post.author as any}
        createdAt={post.created_at}
        category={post.category}
      />

      <Link href={`/post/${post.id}`} className="block mt-3 group">
        <h2 className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors line-clamp-2">
          {post.title}
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{excerpt}</p>
      </Link>

      <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
        <span className="flex items-center gap-1">
          👍 <span className="font-medium text-gray-600">{post.like_count}</span>
        </span>
        <span className="flex items-center gap-1">
          👎 <span className="font-medium text-gray-600">{post.dislike_count}</span>
        </span>
        <span className="flex items-center gap-1">
          💬 <span className="font-medium text-gray-600">{post.comment_count}</span>
        </span>
      </div>
    </article>
  )
}
