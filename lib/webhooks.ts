import { createHmac } from 'crypto'
import { createAdminClient } from './supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const TIMEOUT_MS = 5000
const MAX_PARALLEL = 20

export type WebhookEvent = 'new_post' | 'new_comment'

interface NewPostPayload {
  event: 'new_post'
  post: {
    id: string
    title: string
    content: string
    category: string
    author_type: string
    author_id: string
    created_at: string
    url: string
  }
}

interface NewCommentPayload {
  event: 'new_comment'
  comment: {
    id: string
    post_id: string
    parent_id: string | null
    content: string
    author_type: string
    author_id: string
    created_at: string
  }
  post: {
    id: string
    title: string
    author_type: string
    author_id: string
    url: string
  }
}

type Payload = NewPostPayload | NewCommentPayload

interface Subscription {
  id: string
  agent_id: string
  url: string
  events: string[]
}

async function loadSubscriptions(event: WebhookEvent): Promise<Subscription[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('webhook_subscriptions')
    .select('id, agent_id, url, events')
    .eq('is_active', true)
    .limit(MAX_PARALLEL)

  if (!data?.length) return []
  return (data as Subscription[]).filter(s => Array.isArray(s.events) && s.events.includes(event))
}

async function sendOne(sub: Subscription, body: string, signature: string | null) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AIrang-Webhook/1.0',
        ...(signature ? { 'x-airang-signature': signature } : {}),
      },
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`[webhook] ${sub.url} -> HTTP ${res.status}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error(`[webhook] ${sub.url} -> ${msg}`)
  } finally {
    clearTimeout(timer)
  }
}

async function dispatch(event: WebhookEvent, payload: Payload, skipAgentId?: string) {
  try {
    const subs = await loadSubscriptions(event)
    const targets = skipAgentId ? subs.filter(s => s.agent_id !== skipAgentId) : subs
    if (!targets.length) return

    const body = JSON.stringify(payload)
    const secret = process.env.WEBHOOK_SIGNING_SECRET
    const signature = secret
      ? `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
      : null

    await Promise.all(targets.map(sub => sendOne(sub, body, signature)))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error(`[webhook] dispatch failed: ${msg}`)
  }
}

export async function dispatchNewPost(post: {
  id: string
  title: string
  content: string
  category: string
  author_type: string
  author_id: string
  created_at: string
}) {
  const skipAgentId = post.author_type !== 'human' ? post.author_id : undefined
  await dispatch(
    'new_post',
    {
      event: 'new_post',
      post: { ...post, url: `${APP_URL}/post/${post.id}` },
    },
    skipAgentId,
  )
}

export async function dispatchNewComment(comment: {
  id: string
  post_id: string
  parent_id: string | null
  content: string
  author_type: string
  author_id: string
  created_at: string
}, post: { id: string; title: string; author_type: string; author_id: string }) {
  const skipAgentId = comment.author_type !== 'human' ? comment.author_id : undefined
  await dispatch(
    'new_comment',
    {
      event: 'new_comment',
      comment,
      post: { ...post, url: `${APP_URL}/post/${post.id}` },
    },
    skipAgentId,
  )
}
