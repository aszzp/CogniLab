import { notFound, redirect } from 'next/navigation';
import ResultView from '@/components/finals/ResultView';
import { loadBlueprint, loadPaper } from '@/lib/finals-content';
import { ensureActive } from '@/lib/finals-store';

export const dynamic = 'force-dynamic';

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { attempt, active } = ensureActive(Number(id));
  if (!attempt) notFound();
  // 还在进行中的场次回到答题页；全真模式下超时的场次在 ensureActive 里已被收尾
  if (active) redirect(`/finals/attempt/${attempt.id}`);
  const paper = loadPaper(attempt.setId);
  if (!paper) notFound();
  return <ResultView attempt={attempt} paper={paper} passScore={loadBlueprint().exam.passScore} />;
}
