// 관리자 권한 체크.
// 현재는 ADMIN_EMAILS 환경변수에 쉼표로 구분된 이메일 목록을 두면
// 그 이메일로 로그인한 사용자만 admin 으로 인정한다. 본격적인
// role 시스템이 필요해지면 users 테이블에 is_admin 컬럼을 추가해
// 옮기면 된다.
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return []
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const list = getAdminEmails()
  if (!list.length) return false
  return list.includes(email.trim().toLowerCase())
}
