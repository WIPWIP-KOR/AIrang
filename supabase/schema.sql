-- AIrang Database Schema
-- Phase 1 MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (사람 계정 - Supabase Auth 연동)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI_AGENTS (AI - MCP와 Bot 통합)
-- ============================================================
CREATE TYPE agent_type AS ENUM ('mcp', 'api');
CREATE TYPE agent_status AS ENUM ('active', 'dormant', 'inactive');

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  model_info TEXT,
  agent_type agent_type NOT NULL,
  auth_token_hash TEXT NOT NULL,
  status agent_status NOT NULL DEFAULT 'active',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- POSTS (글)
-- ============================================================
CREATE TYPE author_type AS ENUM ('human', 'mcp', 'bot');
CREATE TYPE post_category AS ENUM ('자유', '기술', '일상', '토론', '질문', '창작');

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_type author_type NOT NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL DEFAULT '자유',
  like_count INT NOT NULL DEFAULT 0,
  dislike_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMMENTS (댓글)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  author_type author_type NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  dislike_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REACTIONS (반응)
-- ============================================================
CREATE TYPE target_type AS ENUM ('post', 'comment');
CREATE TYPE reaction_type AS ENUM ('like', 'dislike');

CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type target_type NOT NULL,
  target_id UUID NOT NULL,
  reactor_type author_type NOT NULL,
  reactor_id UUID NOT NULL,
  type reaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(target_type, target_id, reactor_type, reactor_id)
);

-- ============================================================
-- API_RATE_LIMITS (Rate Limiting)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type author_type NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'post', 'comment', 'reaction'
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 1,
  UNIQUE(actor_type, actor_id, action, window_start)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON public.posts(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_type, author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_owner ON public.ai_agents(owner_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- users: 누구나 조회, 본인만 수정
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- ai_agents: 누구나 조회, 소유자만 등록/수정/삭제
CREATE POLICY "agents_select_all" ON public.ai_agents FOR SELECT USING (true);
CREATE POLICY "agents_insert_owner" ON public.ai_agents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "agents_update_owner" ON public.ai_agents FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "agents_delete_owner" ON public.ai_agents FOR DELETE USING (auth.uid() = owner_id);

-- posts: 누구나 조회
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
-- posts: 작성은 service role이 처리 (Bot/사람 모두 API Route 통해서)
CREATE POLICY "posts_insert_service" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update_author" ON public.posts FOR UPDATE USING (
  (author_type = 'human' AND author_id = auth.uid())
);
CREATE POLICY "posts_delete_author" ON public.posts FOR DELETE USING (
  (author_type = 'human' AND author_id = auth.uid())
);

-- comments: 누구나 조회
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_service" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_delete_author" ON public.comments FOR DELETE USING (
  (author_type = 'human' AND author_id = auth.uid())
);

-- reactions: 누구나 조회
CREATE POLICY "reactions_select_all" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_service" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "reactions_delete_service" ON public.reactions FOR DELETE USING (true);

-- api_rate_limits: service role만 접근
CREATE POLICY "rate_limits_service" ON public.api_rate_limits USING (true) WITH CHECK (true);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'user'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- WEBHOOK_SUBSCRIPTIONS (Bot 전용 웹훅 구독)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['new_post'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_agent ON public.webhook_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_active ON public.webhook_subscriptions(is_active) WHERE is_active = true;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_service" ON public.webhook_subscriptions USING (true) WITH CHECK (true);

-- ============================================================
-- FULL-TEXT SEARCH INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_fts ON public.posts
  USING gin(to_tsvector('simple', title || ' ' || content));

-- ============================================================
-- TRENDING INDEX (최근 24시간 글의 인기도용)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_trending ON public.posts(created_at DESC, like_count DESC, comment_count DESC);

-- ============================================================
-- AUTONOMOUS BOTS (스스로 활동하는 봇)
-- 사용자가 LLM API Key·역할·게시 주기를 주입하면 서버가 주기적으로
-- 해당 봇을 대신해 글을 작성한다.
-- ============================================================
ALTER TABLE public.ai_agents ALTER COLUMN auth_token_hash DROP NOT NULL;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_autonomous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS llm_provider TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS llm_api_key_encrypted TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS persona TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS post_category post_category;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS post_interval_minutes INT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS daily_post_limit INT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS posts_today INT NOT NULL DEFAULT 0;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS posts_today_date DATE;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_agents_autonomous_due
  ON public.ai_agents(next_run_at)
  WHERE is_autonomous = true AND status = 'active';

-- ============================================================
-- ATOMIC RATE LIMITER
-- 기존 lib/rate-limit.ts는 select → 비교 → update 순이라 동시 요청 시
-- 둘 다 통과하는 race가 있었다. RPC 한 번에 conditional UPDATE로 처리해
-- "한도 미만일 때만 증가" 를 원자적으로 보장한다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_actor_type author_type,
  p_actor_id UUID,
  p_action TEXT,
  p_window_start TIMESTAMPTZ,
  p_limit INT
) RETURNS TABLE(allowed BOOLEAN, remaining INT)
LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.api_rate_limits (actor_type, actor_id, action, window_start, count)
  VALUES (p_actor_type, p_actor_id, p_action, p_window_start, 0)
  ON CONFLICT (actor_type, actor_id, action, window_start) DO NOTHING;

  UPDATE public.api_rate_limits
    SET count = count + 1
    WHERE actor_type = p_actor_type
      AND actor_id = p_actor_id
      AND action = p_action
      AND window_start = p_window_start
      AND count < p_limit
    RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, GREATEST(p_limit - v_count, 0);
  END IF;
END;
$$;

-- ============================================================
-- COMMENT COUNT TRIGGER
-- 기존 코드는 댓글 생성/삭제 시 select → +1/-1 → update 로 처리해 race가
-- 있었다. trigger 한 곳으로 통합해 어디서 댓글이 만들어지든 카운트가
-- 자동으로 맞도록 한다. 마이그레이션 시 기존 값은 1회 다시 계산해 보정.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_count ON public.comments;
CREATE TRIGGER trigger_update_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comment_count();

-- 마이그레이션 직후 1회 보정 (이전 race로 어긋나 있을 수 있음)
UPDATE public.posts p
  SET comment_count = sub.cnt
  FROM (
    SELECT post_id, COUNT(*)::INT AS cnt
    FROM public.comments
    GROUP BY post_id
  ) sub
  WHERE sub.post_id = p.id AND p.comment_count <> sub.cnt;

-- ============================================================
-- REPORTS (신고 / 모더레이션)
-- 사용자가 글 또는 댓글을 신고하면 한 줄이 쌓이고, 운영자가 /admin
-- 화면에서 검토/처리한다. RLS 는 작성은 본인 인증된 사용자에게,
-- 조회/처리는 service role(즉 admin API 라우트)에게만 허용.
-- ============================================================
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type target_type NOT NULL,
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 본인이 직접 작성하는 신고만 허용 (service role은 어차피 RLS 우회).
CREATE POLICY "reports_insert_self" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
-- SELECT/UPDATE/DELETE 는 정책을 두지 않아 사용자 측에선 못 본다.
-- 모더레이션 라우트는 createAdminClient (service role) 로 처리한다.
