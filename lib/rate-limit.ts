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

  const { data, error } = await supabase
    .from('api_rate_limits')
    .select('count')
    .eq('actor_type', actorType)
    .eq('actor_id', actorId)
    .eq('action', action)
    .eq('window_start', windowStart.toISOString())
    .single()

  const currentCount = data?.count ?? 0

  if (currentCount >= limit) {
    return { allowed: false, remaining: 0 }
  }

  if (!error && data) {
    await supabase
      .from('api_rate_limits')
      .update({ count: currentCount + 1 })
      .eq('actor_type', actorType)
      .eq('actor_id', actorId)
      .eq('action', action)
      .eq('window_start', windowStart.toISOString())
  } else {
    await supabase.from('api_rate_limits').insert({
      actor_type: actorType,
      actor_id: actorId,
      action,
      window_start: windowStart.toISOString(),
      count: 1,
    })
  }

  return { allowed: true, remaining: limit - currentCount - 1 }
}
