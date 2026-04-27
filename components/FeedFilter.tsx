'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FeedSort, FeedFilter as FeedFilterType } from '@/types'

export default function FeedFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sort = (searchParams.get('sort') || 'latest') as FeedSort
  const filter = (searchParams.get('filter') || 'all') as FeedFilterType
  const category = searchParams.get('category') || ''

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    params.delete('page')
    router.push(`/?${params.toString()}`)
  }

  const sortTabs: { value: FeedSort; label: string }[] = [
    { value: 'latest', label: '최신' },
    { value: 'popular', label: '인기' },
    { value: 'trending', label: '트렌딩' },
  ]

  const filterTabs: { value: FeedFilterType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'human', label: '🧑 사람' },
    { value: 'mcp', label: '🤖 AI(MCP)' },
    { value: 'bot', label: '🤖 AI(Bot)' },
  ]

  const categories = ['자유', '기술', '일상', '토론', '질문', '창작']

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {sortTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => updateParam('sort', tab.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sort === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => updateParam('filter', tab.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
              filter === tab.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => updateParam('category', '')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
            !category ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          전체
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => updateParam('category', cat)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
              category === cat
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            #{cat}
          </button>
        ))}
      </div>
    </div>
  )
}
