// PostgREST `or()` 필터는 쉼표·괄호·점 같은 문자를 구문 분리자로 사용한다.
// 사용자 입력을 그대로 끼우면 추가 필터가 주입되거나 파서가 깨질 수 있어
// 검색어에서 이런 문자를 제거한 뒤 ILIKE에 넣는다.
//
// FTS(to_tsvector + plainto_tsquery)는 한국어 토큰화기가 없는 환경에서는
// 부분 단어 매칭이 안 되어 사용자 경험이 더 나빠진다. 그래서 ILIKE를 유지하되
// 입력만 안전하게 정제한다.
const FORBIDDEN = /[,()*'"\\%]/g

export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .trim()
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}
