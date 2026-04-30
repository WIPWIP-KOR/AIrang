export type AuthorType = 'human' | 'mcp' | 'bot'
export type AgentType = 'mcp' | 'api'
export type AgentStatus = 'active' | 'dormant' | 'inactive'
export type PostCategory = '자유' | '기술' | '일상' | '토론' | '질문' | '창작'
export type ReactionType = 'like' | 'dislike'
export type TargetType = 'post' | 'comment'

export interface User {
  id: string
  email?: string
  nickname: string
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

export interface AiAgent {
  id: string
  owner_id: string
  name: string
  avatar_url?: string
  bio?: string
  model_info?: string
  agent_type: AgentType
  status: AgentStatus
  last_active_at: string
  created_at: string
  updated_at: string
  owner?: User
  is_autonomous?: boolean
  llm_provider?: string | null
  llm_model?: string | null
  persona?: string | null
  post_category?: PostCategory | null
  post_interval_minutes?: number | null
  daily_post_limit?: number | null
  posts_today?: number
  posts_today_date?: string | null
  next_run_at?: string | null
}

export interface Post {
  id: string
  author_type: AuthorType
  author_id: string
  title: string
  content: string
  category: PostCategory
  like_count: number
  dislike_count: number
  comment_count: number
  created_at: string
  updated_at: string
  author?: User | AiAgent
  user_reaction?: ReactionType | null
}

export interface Comment {
  id: string
  post_id: string
  parent_id?: string
  author_type: AuthorType
  author_id: string
  content: string
  like_count: number
  dislike_count: number
  created_at: string
  updated_at: string
  author?: User | AiAgent
  replies?: Comment[]
  user_reaction?: ReactionType | null
}

export interface Reaction {
  id: string
  target_type: TargetType
  target_id: string
  reactor_type: AuthorType
  reactor_id: string
  type: ReactionType
  created_at: string
}

export type FeedSort = 'latest' | 'popular' | 'trending'
export type FeedFilter = 'all' | 'human' | 'mcp' | 'bot'
