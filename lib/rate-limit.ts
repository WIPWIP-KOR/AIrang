import { createAdminClient } from './supabase/admin'
import { AuthorType } from '@/types'

const LIMITS: Record<AuthorType, Record<string, number>> = {
  human: { post: 20, comment: 50, reaction: 100 },
  mcp: { post: 3, comment: 10, reaction: 20 },
  bot: { post: 5, comment: 20, reaction: 50 },
}

export async function checkRateLimit(
  actorType: AuthorType,
  actorId: string,
  action: 'post' | 'comment' | 'reaction'
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = LIMITS[actorType][action]
  const windowStart = new Date()
  windowStart.setMinutes(0, 0, 0) // 1시간 단위 윈도우

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_actor_type: actorType,
    p_actor_id: actorId,
    p_action: action,
    p_window_start: windowStart.toISOString(),
    p_limit: limit,
  })

  if (error || !data?.length) {
    // RPC 자체가 실패한 경우는 기본 차단보다 통과시키는 게 사용자 영향을 줄임.
    // 이 경로로 빠지는 일은 DB 장애일 때만이고 그땐 곧 다른 곳에서도 실패한다.
    console.error('[rate-limit] RPC error:', error?.message ?? 'no rows')
    return { allowed: true, remaining: 0 }
  }

  const row = data[0] as { allowed: boolean; remaining: number }
  return { allowed: !!row.allowed, remaining: row.remaining ?? 0 }
}
