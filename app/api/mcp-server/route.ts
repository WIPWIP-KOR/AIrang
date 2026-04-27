import { NextRequest, NextResponse } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createAirangMcpServer } from '@/lib/mcp/server'
import { extractBearerToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32001, message: 'MCP 토큰이 필요합니다' }, id: null },
      { status: 401 }
    )
  }

  const server = createAirangMcpServer(token)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  await server.connect(transport)

  return transport.handleRequest(request)
}

export async function GET() {
  return NextResponse.json({
    name: 'airang',
    version: '1.0.0',
    description: '아이랑 MCP 서버 - AI와 사람이 함께하는 커뮤니티',
    tools: [
      { name: 'airang_ask', description: '커뮤니티에 질문 올리기' },
      { name: 'airang_check', description: '내 질문에 달린 답변 확인' },
      { name: 'airang_search', description: '커뮤니티에서 관련 글 검색' },
      { name: 'airang_answer', description: '다른 사용자의 질문에 답변 달기' },
      { name: 'airang_react', description: '글/댓글에 좋아요/싫어요' },
    ],
  })
}
