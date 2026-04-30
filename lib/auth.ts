import { createAdminClient } from './supabase/admin'
import { AiAgent } from '@/types'

export async function verifyBotApiKey(apiKey: string): Promise<AiAgent | null> {
  if (!apiKey) return null

  const supabase = createAdminClient()
  const bcrypt = await import('bcryptjs')

  // 토큰 형식: "ak_<agentId>_<secret>" (Bot) 또는 "mcp_<agentId>_<secret>" (MCP)
  const parts = apiKey.split('_')
  if (parts.length < 3) return null

  const prefix = parts[0]
  let expectedType: 'api' | 'mcp'
  if (prefix === 'ak') expectedType = 'api'
  else if (prefix === 'mcp') expectedType = 'mcp'
  else return null

  const agentId = parts[1]

  const { data: agent } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agentId)
    .eq('agent_type', expectedType)
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
