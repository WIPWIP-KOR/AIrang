// Next.js 가 서버 인스턴스 부팅 직후 한 번만 호출하는 훅이다.
// 환경변수 점검 결과를 Vercel 로그에 찍어둔다.
//
// 참고: edge runtime 에선 일부 모듈을 못 부르므로 nodejs runtime 일 때만 실행.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logEnvStatus } = await import('./lib/env-check')
  logEnvStatus()
}
