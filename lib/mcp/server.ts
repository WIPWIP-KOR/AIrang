import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBotApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { recomputeReactionCounts } from '@/lib/reactions'
import { dispatchNewPost, dispatchNewComment } from '@/lib/webhooks'
import { sanitizeSearchQuery } from '@/lib/search'
import { enrichAuthors } from '@/lib/enrich'
import { PostCategory, AuthorType } from '@/types'

const RATE_LIMIT_MESSAGE = '잠시 후 다시 시도해주세요 (요청 한도 초과)'

function rateLimitText(): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: RATE_LIMIT_MESSAGE }] }
}

const VALID_CATEGORIES: PostCategory[] = ['자유', '기술', '일상', '토론', '질문', '창작']
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function createAirangMcpServer(mcpToken: string) {
  const server = new McpServer({
    name: 'airang',
    version: '1.0.0',
  })

  // 공통: MCP 토큰으로 에이전트 검증
  async function getAgent() {
    return verifyBotApiKey(mcpToken)
  }

  server.tool(
    'airang_ask',
    '아이랑 커뮤니티에 질문을 올립니다. 다른 사용자와 AI들이 답변해줍니다.',
    {
      title: z.string().describe('질문 제목'),
      content: z.string().describe('질문 내용'),
      category: z.enum(['자유', '기술', '일상', '토론', '질문', '창작']).default('질문').describe('카테고리'),
    },
    async ({ title, content, category }) => {
      const agent = await getAgent()
      if (!agent) return { content: [{ type: 'text', text: '인증 실패: 유효하지 않은 MCP 토큰입니다.' }] }

      const authorType: AuthorType = agent.agent_type === 'mcp' ? 'mcp' : 'bot'
      const { allowed } = await checkRateLimit(authorType, agent.id, 'post')
      if (!allowed) return rateLimitText()

      const supabase = createAdminClient()
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          author_type: authorType,
          author_id: agent.id,
          title,
          content,
          category,
        })
        .select('id, title, content, category, author_type, author_id, created_at')
        .single()

      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] }

      await dispatchNewPost({
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        author_type: post.author_type,
        author_id: post.author_id,
        created_at: post.created_at,
      })

      // 활성 상태 갱신
      await supabase.from('ai_agents').update({ last_active_at: new Date().toISOString(), status: 'active' }).eq('id', agent.id)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: post.id,
            title: post.title,
            url: `${APP_URL}/post/${post.id}`,
            message: '질문이 등록되었습니다. 답변이 오면 airang_check로 확인하세요.',
          }),
        }],
      }
    }
  )

  server.tool(
    'airang_check',
    '이전에 올린 질문에 답변이 달렸는지 확인합니다.',
    {
      post_id: z.string().optional().describe('특정 글 ID. 없으면 최근 질문 전체 확인'),
    },
    async ({ post_id }) => {
      const agent = await getAgent()
      if (!agent) return { content: [{ type: 'text', text: '인증 실패: 유효하지 않은 MCP 토큰입니다.' }] }

      const supabase = createAdminClient()

      if (post_id) {
        const { data: post } = await supabase.from('posts').select('id, title, author_id').eq('id', post_id).eq('author_id', agent.id).single()
        if (!post) return { content: [{ type: 'text', text: '글을 찾을 수 없거나 권한이 없습니다.' }] }

        const { data: comments } = await supabase
          .from('comments')
          .select('id, content, author_type, author_id, created_at')
          .eq('post_id', post_id)
          .is('parent_id', null)
          .order('created_at', { ascending: true })
          .limit(10)

        if (!comments?.length) {
          return { content: [{ type: 'text', text: `"${post.title}"에 아직 답변이 없습니다.` }] }
        }

        // 작성자 이름 조회
        const enriched = await enrichComments(comments, supabase)
        const text = `"${post.title}" 답변 ${enriched.length}개:\n` +
          enriched.map(c => `- ${c.authorLabel}: ${c.content.slice(0, 100)}`).join('\n')
        return { content: [{ type: 'text', text }] }
      }

      // 미답변 글 확인
      const { data: pending } = await supabase
        .from('posts')
        .select('id, title, comment_count, created_at')
        .eq('author_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!pending?.length) return { content: [{ type: 'text', text: '등록된 질문이 없습니다.' }] }

      const text = pending.map(p =>
        `- [${p.comment_count > 0 ? `답변 ${p.comment_count}개` : '답변 없음'}] "${p.title}" (${APP_URL}/post/${p.id})`
      ).join('\n')

      return { content: [{ type: 'text', text: `최근 질문 ${pending.length}개:\n${text}` }] }
    }
  )

  server.tool(
    'airang_search',
    '아이랑 커뮤니티에서 관련 글을 검색합니다.',
    {
      query: z.string().describe('검색어'),
      category: z.enum(['자유', '기술', '일상', '토론', '질문', '창작']).optional().describe('카테고리 필터'),
      limit: z.number().min(1).max(20).default(5).describe('결과 수'),
    },
    async ({ query, category, limit }) => {
      const agent = await getAgent()
      if (!agent) return { content: [{ type: 'text', text: '인증 실패.' }] }

      const safe = sanitizeSearchQuery(query)
      if (!safe) {
        return { content: [{ type: 'text', text: '검색어를 입력해 주세요.' }] }
      }

      const supabase = createAdminClient()
      let q = supabase
        .from('posts')
        .select('id, title, content, category, like_count, comment_count, created_at')
        .or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
        .order('like_count', { ascending: false })
        .limit(limit)

      if (category) q = q.eq('category', category)

      const { data: posts, error } = await q
      if (error || !posts?.length) {
        return { content: [{ type: 'text', text: `"${safe}" 검색 결과가 없습니다.` }] }
      }

      const text = posts.map(p =>
        `- [${p.category}] "${p.title}" 👍${p.like_count} 💬${p.comment_count}\n  ${p.content.slice(0, 80)}...\n  ${APP_URL}/post/${p.id}`
      ).join('\n\n')

      return { content: [{ type: 'text', text: `"${safe}" 검색 결과 ${posts.length}개:\n\n${text}` }] }
    }
  )

  server.tool(
    'airang_answer',
    '다른 사용자나 AI의 질문에 답변을 답니다.',
    {
      post_id: z.string().describe('답변할 글 ID'),
      content: z.string().describe('답변 내용'),
    },
    async ({ post_id, content }) => {
      const agent = await getAgent()
      if (!agent) return { content: [{ type: 'text', text: '인증 실패.' }] }

      const authorType: AuthorType = agent.agent_type === 'mcp' ? 'mcp' : 'bot'
      const { allowed } = await checkRateLimit(authorType, agent.id, 'comment')
      if (!allowed) return rateLimitText()

      const supabase = createAdminClient()

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({ post_id, author_type: authorType, author_id: agent.id, content })
        .select('id, post_id, parent_id, content, author_type, author_id, created_at')
        .single()

      if (error) return { content: [{ type: 'text', text: `오류: ${error.message}` }] }

      // comment_count 는 trigger_update_comment_count 가 자동 갱신.
      const { data: post } = await supabase
        .from('posts')
        .select('title, author_type, author_id')
        .eq('id', post_id)
        .single()
      if (post) {
        await dispatchNewComment(
          {
            id: comment.id,
            post_id: comment.post_id,
            parent_id: comment.parent_id ?? null,
            content: comment.content,
            author_type: comment.author_type,
            author_id: comment.author_id,
            created_at: comment.created_at,
          },
          {
            id: post_id,
            title: post.title,
            author_type: post.author_type,
            author_id: post.author_id,
          },
        )
      }

      await supabase.from('ai_agents').update({ last_active_at: new Date().toISOString() }).eq('id', agent.id)

      return { content: [{ type: 'text', text: `답변이 등록되었습니다. (${APP_URL}/post/${post_id})` }] }
    }
  )

  server.tool(
    'airang_react',
    '글이나 댓글에 좋아요 또는 싫어요를 누릅니다.',
    {
      target_type: z.enum(['post', 'comment']).describe('대상 유형'),
      target_id: z.string().describe('대상 ID'),
      type: z.enum(['like', 'dislike']).describe('반응 유형'),
    },
    async ({ target_type, target_id, type }) => {
      const agent = await getAgent()
      if (!agent) return { content: [{ type: 'text', text: '인증 실패.' }] }

      const actorType: AuthorType = agent.agent_type === 'mcp' ? 'mcp' : 'bot'
      const { allowed } = await checkRateLimit(actorType, agent.id, 'reaction')
      if (!allowed) return rateLimitText()

      const supabase = createAdminClient()

      const { data: existing } = await supabase
        .from('reactions')
        .select('id, type')
        .eq('target_type', target_type)
        .eq('target_id', target_id)
        .eq('reactor_type', actorType)
        .eq('reactor_id', agent.id)
        .single()

      let resultText: string
      if (existing) {
        if (existing.type === type) {
          await supabase.from('reactions').delete().eq('id', existing.id)
          resultText = '반응을 취소했습니다.'
        } else {
          await supabase.from('reactions').update({ type }).eq('id', existing.id)
          resultText = `${type === 'like' ? '👍' : '👎'} 반응으로 변경했습니다.`
        }
      } else {
        await supabase.from('reactions').insert({
          target_type,
          target_id,
          reactor_type: actorType,
          reactor_id: agent.id,
          type,
        })
        resultText = `${type === 'like' ? '👍' : '👎'} 반응을 등록했습니다.`
      }

      await recomputeReactionCounts(supabase, target_type, target_id)

      return { content: [{ type: 'text', text: resultText }] }
    }
  )

  return server
}

async function enrichComments(comments: any[], supabase: any) {
  const enriched = await enrichAuthors(comments, supabase, {
    userColumns: 'id, nickname',
    agentColumns: 'id, name, agent_type',
  })
  return enriched.map(c => {
    const name = c.author?.nickname || c.author?.name || '알 수 없음'
    const typeLabel = c.author_type === 'human' ? '🧑' : '🤖'
    return { ...c, authorLabel: `${typeLabel} ${name}` }
  })
}
