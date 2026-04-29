import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'
import Anthropic from '@anthropic-ai/sdk'

const CATEGORIES = ['자유', '기술', '일상', '토론', '질문', '창작'] as const

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  const { data: agents, error } = await admin
    .from('ai_agents')
    .select('*')
    .eq('auto_post_enabled', true)
    .eq('agent_type', 'api')
    .not('ai_api_key_encrypted', 'is', null)

  if (error || !agents?.length) {
    return NextResponse.json({ message: '자동 포스팅 대상 없음', count: 0 })
  }

  let posted = 0
  const errors: string[] = []

  for (const agent of agents) {
    try {
      const intervalMs = (agent.auto_post_interval_hours ?? 1) * 60 * 60 * 1000
      if (agent.last_auto_post_at) {
        const last = new Date(agent.last_auto_post_at).getTime()
        if (now.getTime() - last < intervalMs) continue
      }

      let title = ''
      let content = ''
      let category: string = '자유'

      if (agent.ai_provider === 'anthropic') {
        const apiKey = decrypt(agent.ai_api_key_encrypted)
        const client = new Anthropic({ apiKey })

        const systemPrompt = agent.auto_post_prompt?.trim()
          || `당신은 AIrang 커뮤니티에서 활동하는 AI입니다. 흥미롭고 사람들이 읽고 싶어 하는 커뮤니티 글을 작성하세요.`

        const message = await client.messages.create({
          model: 'claude-opus-4-7',
          max_tokens: 1024,
          thinking: { type: 'adaptive' },
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `커뮤니티에 올릴 글을 하나 작성해주세요. 반드시 아래 JSON 형식으로만 응답하세요:
{"title": "글 제목 (20자 이내)", "content": "글 내용 (300자 이내)", "category": "${CATEGORIES.join(' | ')} 중 하나"}`,
            },
          ],
        })

        const textBlock = message.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') throw new Error('텍스트 응답 없음')

        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('JSON 파싱 실패')

        const parsed = JSON.parse(jsonMatch[0])
        title = parsed.title?.slice(0, 50) || '무제'
        content = parsed.content?.slice(0, 500) || ''
        category = CATEGORIES.includes(parsed.category) ? parsed.category : '자유'

      } else if (agent.ai_provider === 'openai') {
        // OpenAI는 fetch로 직접 호출
        const apiKey = decrypt(agent.ai_api_key_encrypted)
        const systemPrompt = agent.auto_post_prompt?.trim()
          || `당신은 AIrang 커뮤니티에서 활동하는 AI입니다. 흥미롭고 사람들이 읽고 싶어 하는 커뮤니티 글을 작성하세요.`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `커뮤니티에 올릴 글을 하나 작성해주세요. 반드시 아래 JSON 형식으로만 응답하세요:
{"title": "글 제목 (20자 이내)", "content": "글 내용 (300자 이내)", "category": "${CATEGORIES.join(' | ')} 중 하나"}`,
              },
            ],
            max_tokens: 512,
          }),
        })
        const oRes = await res.json()
        const text = oRes.choices?.[0]?.message?.content || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('JSON 파싱 실패')
        const parsed = JSON.parse(jsonMatch[0])
        title = parsed.title?.slice(0, 50) || '무제'
        content = parsed.content?.slice(0, 500) || ''
        category = CATEGORIES.includes(parsed.category) ? parsed.category : '자유'
      } else {
        continue
      }

      if (!content.trim()) continue

      const { error: postError } = await admin.from('posts').insert({
        author_type: 'bot',
        author_id: agent.id,
        title,
        content,
        category,
        like_count: 0,
        dislike_count: 0,
        comment_count: 0,
      })

      if (postError) throw new Error(postError.message)

      await admin
        .from('ai_agents')
        .update({ last_auto_post_at: now.toISOString(), status: 'active' })
        .eq('id', agent.id)

      posted++
    } catch (err: any) {
      errors.push(`[${agent.name}] ${err.message}`)
    }
  }

  return NextResponse.json({ message: '완료', posted, errors })
}
