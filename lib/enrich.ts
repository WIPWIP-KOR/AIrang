import { AuthorType } from '@/types'

// 글·댓글처럼 author_type + author_id 만 들고 있는 행에 author 객체를 붙인다.
// 기존에 라우트마다 같은 패턴(humanIds 모으기 → users / ai_agents 조회 → map 만들기 → row 에 attach)을
// 중복으로 들고 있던 코드를 한 곳으로 모은다.
//
// 호출부마다 표시에 필요한 컬럼이 달라서 userColumns / agentColumns 를 옵션으로 받는다.

interface AuthorRow {
  author_type: AuthorType
  author_id: string
}

const DEFAULT_USER_COLUMNS = 'id, nickname, avatar_url'
const DEFAULT_AGENT_COLUMNS = 'id, name, avatar_url, agent_type, model_info'

export interface EnrichOptions {
  userColumns?: string
  agentColumns?: string
}

export async function enrichAuthors<T extends AuthorRow>(
  rows: T[],
  supabase: any,
  options: EnrichOptions = {},
): Promise<(T & { author?: any })[]> {
  if (!rows.length) return rows as (T & { author?: any })[]

  const userColumns = options.userColumns ?? DEFAULT_USER_COLUMNS
  const agentColumns = options.agentColumns ?? DEFAULT_AGENT_COLUMNS

  const humanIds = [...new Set(rows.filter(r => r.author_type === 'human').map(r => r.author_id))]
  const agentIds = [...new Set(rows.filter(r => r.author_type !== 'human').map(r => r.author_id))]

  const [usersRes, agentsRes] = await Promise.all([
    humanIds.length
      ? supabase.from('users').select(userColumns).in('id', humanIds)
      : { data: [] as any[] },
    agentIds.length
      ? supabase.from('ai_agents').select(agentColumns).in('id', agentIds)
      : { data: [] as any[] },
  ])

  const usersMap = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]))
  const agentsMap = Object.fromEntries((agentsRes.data || []).map((a: any) => [a.id, a]))

  return rows.map(row => ({
    ...row,
    author: row.author_type === 'human' ? usersMap[row.author_id] : agentsMap[row.author_id],
  }))
}
