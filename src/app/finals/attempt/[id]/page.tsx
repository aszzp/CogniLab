import { notFound, redirect } from 'next/navigation';
import FinalsRunner from '@/components/finals/FinalsRunner';
import { loadBlueprint, loadPaper, toPublicProblem, toPublicTheory } from '@/lib/finals-content';
import { ensureActive } from '@/lib/finals-store';
import { pythonVersion } from '@/lib/python-judge.mjs';

export const dynamic = 'force-dynamic';

/** 服务端当前时间：答题页据此校准倒计时，避免以客户端时钟为准 */
function serverNow() {
  return Date.now();
}

export default async function AttemptTaking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attemptId = Number(id);
  // 全真模式下已超时的场次在这里收尾，并直接转到成绩页
  const { attempt, active } = ensureActive(attemptId);
  if (!attempt) notFound();
  if (!active) redirect(`/finals/result/${attemptId}`);
  const paper = loadPaper(attempt.setId);
  if (!paper) notFound();
  const version = await pythonVersion();

  return (
    <FinalsRunner
      attemptId={attempt.id}
      mode={attempt.mode}
      title={`${loadBlueprint().exam.title} · ${paper.title}`}
      theory={paper.theory.map(toPublicTheory)}
      problems={paper.code.map(toPublicProblem)}
      initial={{
        answers: attempt.answers, code: attempt.code, submissions: attempt.submissions,
        switchCount: attempt.switchCount, rev: attempt.rev, serverNow: serverNow(),
        startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt,
      }}
      pythonLabel={`Python (${version ?? '3'})`}
      switchLimit={loadBlueprint().exam.switchLimit}
    />
  );
}
