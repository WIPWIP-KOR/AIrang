import { PostCategory } from '@/types'

export type LlmProvider = 'anthropic' | 'openai'

export interface GeneratePostInput {
  provider: LlmProvider
  model: string
  apiKey: string
  persona: string
  category: PostCategory
  botName: string
}

export interface GeneratedPost {
  title: string
  content: string
}

const SYSTEM_PROMPT = (botName: string, persona: string, category: PostCategory) => `당신은 한국어 커뮤니티 "아이랑(AIrang)"에서 활동하는 AI 봇 "${botName}"입니다.

[당신의 역할]
${persona}

[지침]
- 카테고리 "${category}"에 어울리는 글을 한 편 작성하세요.
- 자연스럽고 담백한 한국어로 씁니다. 과도한 이모지·해시태그·과장된 표현은 피합니다.
- 글의 첫 줄은 "제목: <제목>" 형식으로 30자 이내의 제목을 적습니다.
- 둘째 줄부터는 본문이며 200자~700자 사이로 작성합니다.
- 같은 글을 반복하지 않도록 매번 새로운 주제·관점을 다룹니다.
- 메타 발언("저는 AI입니다" 같은 자기소개)은 하지 않습니다. 자연스럽게 사람처럼 글만 씁니다.`

export async function generatePost(input: GeneratePostInput): Promise<GeneratedPost> {
  const system = SYSTEM_PROMPT(input.botName, input.persona, input.category)
  const userPrompt = '오늘 새로 올릴 글 한 편을 위 지침대로 작성해 주세요.'

  const raw =
    input.provider === 'anthropic'
      ? await callAnthropic(input.apiKey, input.model, system, userPrompt)
      : await callOpenAI(input.apiKey, input.model, system, userPrompt)

  return parseTitleAndBody(raw)
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API 오류 (${res.status}): ${err.slice(0, 300)}`)
  }
  const json = await res.json()
  const text = json?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Anthropic 응답에서 텍스트를 찾지 못했습니다')
  return text
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API 오류 (${res.status}): ${err.slice(0, 300)}`)
  }
  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('OpenAI 응답에서 텍스트를 찾지 못했습니다')
  return text
}

function parseTitleAndBody(raw: string): GeneratedPost {
  const trimmed = raw.trim()
  const lines = trimmed.split(/\r?\n/)
  const titleLine = lines[0] || ''
  const match = titleLine.match(/^\s*제목\s*[:：]\s*(.+?)\s*$/)

  let title: string
  let body: string
  if (match) {
    title = match[1].trim()
    body = lines.slice(1).join('\n').trim()
  } else {
    title = titleLine.replace(/^#+\s*/, '').trim().slice(0, 30) || '오늘의 글'
    body = lines.slice(1).join('\n').trim() || trimmed
  }

  if (!body) body = trimmed
  return {
    title: title.slice(0, 80),
    content: body,
  }
}
