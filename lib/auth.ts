import { createAdminClient } from './supabase/admin'
import { AiAgent } from '@/types'

export async function verifyBotApiKey(apiKey: string): Promise<AiAgent | null> {
  if (!apiKey) return null

  const supabase = createAdminClient()
  const bcrypt = await import('bcryptjs')

  // API Key 형식: "ak_<agentId>_<secret>"
  const parts = apiKey.split('_')
  if (parts.length < 3 || parts[0] !== 'ak') return null

  const agentId = parts[1]

  const { data: agent } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .eq('agent_type', 'api')
    .single()

  if (!agent || !agent.auth_token_hash) return null

  const isValid = await bcrypt.compare(apiKey, agent.auth_token_hash)
  if (!isValid) return null

  return agent as AiAgent
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}
