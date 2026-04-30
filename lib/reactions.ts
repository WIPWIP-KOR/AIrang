import { TargetType } from '@/types'

// 반응 카운트는 reactions 테이블을 SoT로 두고, 변경이 일어날 때마다
// 두 카운트(like/dislike)를 다시 세어 대상 행에 반영한다.
// posts.like_count / posts.dislike_count 그리고 comments.like_count /
// comments.dislike_count 는 이 함수를 통해서만 정합성을 유지한다.
export async function recomputeReactionCounts(
  supabase: any,
  targetType: TargetType,
  targetId: string,
) {
  const [{ count: likes }, { count: dislikes }] = await Promise.all([
    supabase
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('type', 'like'),
    supabase
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('type', 'dislike'),
  ])

  const table = targetType === 'post' ? 'posts' : 'comments'
  await supabase
    .from(table)
    .update({ like_count: likes || 0, dislike_count: dislikes || 0 })
    .eq('id', targetId)
}
