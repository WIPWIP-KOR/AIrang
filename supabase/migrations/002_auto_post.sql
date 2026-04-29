-- 자동 포스팅을 위한 AI 에이전트 컬럼 추가
ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS ai_provider TEXT CHECK (ai_provider IN ('anthropic', 'openai')),
  ADD COLUMN IF NOT EXISTS ai_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_post_prompt TEXT,
  ADD COLUMN IF NOT EXISTS auto_post_interval_hours INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_auto_post_at TIMESTAMPTZ;
