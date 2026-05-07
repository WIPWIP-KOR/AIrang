// 서버 부팅 시 환경변수 설정 상태를 한 번만 콘솔에 찍는다.
// 절대 값을 그대로 출력하지 않고 (ENC 키·서비스 키 등이 로그로 새지 않도록)
// "set/missing" 과 짧은 메타데이터(길이·항목 수 등)만 보여준다.

type Status = 'ok' | 'missing' | 'optional-unset' | 'warn'

interface Check {
  key: string
  status: Status
  detail?: string
}

const STATUS_LABEL: Record<Status, string> = {
  ok: '✓ set',
  missing: '✗ MISSING',
  'optional-unset': '· (unset, optional)',
  warn: '⚠ warn',
}

function present(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

function checkRequired(name: string, detail?: (v: string) => string): Check {
  const v = present(name)
  if (!v) return { key: name, status: 'missing' }
  return { key: name, status: 'ok', detail: detail?.(v) }
}

function checkOptional(name: string, detail?: (v: string) => string): Check {
  const v = present(name)
  if (!v) return { key: name, status: 'optional-unset' }
  return { key: name, status: 'ok', detail: detail?.(v) }
}

function maskHost(url: string): string {
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return '(invalid URL)'
  }
}

export function logEnvStatus() {
  const checks: Check[] = [
    // Supabase 필수
    checkRequired('NEXT_PUBLIC_SUPABASE_URL', v => maskHost(v)),
    checkRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY', v => `${v.length} chars`),
    checkRequired('SUPABASE_SERVICE_ROLE_KEY', v => `${v.length} chars`),
    checkRequired('NEXT_PUBLIC_APP_URL', v => maskHost(v)),

    // 자율 봇 / 모더레이션 / 웹훅 (대부분 선택)
    checkOptional('BOT_ENC_KEY', v =>
      v.length < 32 ? `${v.length} chars (권장: 32+)` : `${v.length} chars`,
    ),
    checkOptional('BOT_CRON_SECRET', v => `${v.length} chars`),
    checkOptional('CRON_SECRET', v => `${v.length} chars`),
    checkOptional('WEBHOOK_SIGNING_SECRET', v => `${v.length} chars`),
    checkOptional('ADMIN_EMAILS', v => {
      const list = v.split(',').map(s => s.trim()).filter(Boolean)
      return `${list.length} email(s)`
    }),
  ]

  // 짧은 BOT_ENC_KEY 는 warn 처리
  for (const c of checks) {
    if (c.key === 'BOT_ENC_KEY' && c.status === 'ok' && c.detail?.includes('권장')) {
      c.status = 'warn'
    }
  }

  // 서로 보완하는 변수 페어 안내 (둘 다 없으면 cron 불가)
  const cronPair = checks.find(c => c.key === 'BOT_CRON_SECRET')
  const cronAlt = checks.find(c => c.key === 'CRON_SECRET')
  const cronEnabled = cronPair?.status === 'ok' || cronAlt?.status === 'ok'

  const lines: string[] = []
  lines.push('[env] 환경변수 점검')
  for (const c of checks) {
    const detail = c.detail ? `  — ${c.detail}` : ''
    lines.push(`  ${STATUS_LABEL[c.status].padEnd(22)} ${c.key}${detail}`)
  }

  // 종합 안내
  const missingRequired = checks.filter(c => c.status === 'missing').map(c => c.key)
  if (missingRequired.length) {
    lines.push('')
    lines.push(`  ⚠ 필수 누락: ${missingRequired.join(', ')}`)
    lines.push('     이 값이 없으면 Supabase 호출이 즉시 실패합니다.')
  }

  if (!cronEnabled) {
    lines.push('')
    lines.push('  ℹ BOT_CRON_SECRET / CRON_SECRET 둘 다 비어있어 자율 봇 cron이 인증 거절됩니다.')
    lines.push('     "지금 글쓰기" 버튼은 정상 작동합니다.')
  }

  if (!present('BOT_ENC_KEY')) {
    lines.push('')
    lines.push('  ℹ BOT_ENC_KEY 미설정: 자율 봇 생성 시 LLM API Key 암호화 단계에서 500 에러.')
    lines.push('     생성 예: openssl rand -base64 48')
  }

  // 콘솔에 한 번에 출력
  console.log(lines.join('\n'))
}
