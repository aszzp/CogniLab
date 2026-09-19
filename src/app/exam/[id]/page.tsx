import { notFound } from 'next/navigation';
import { qGet } from '@/lib/db';
import { loadQuestionsByIds } from '@/lib/exam';
import ExamRunner from '@/components/ExamRunner';

export const dynamic = 'force-dynamic';

export default async function ExamTaking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = qGet<{ id: number; mode: string; question_ids: string; finished_at: string | null }>(
    'SELECT id, mode, question_ids, finished_at FROM exams WHERE id = ?', Number(id),
  );
  if (!exam) notFound();
  if (exam.finished_at) {
    // 已完成：跳回考试列表看历史
    notFound();
  }
  const questions = loadQuestionsByIds(JSON.parse(exam.question_ids));
  return <ExamRunner examId={exam.id} mode={exam.mode} questions={questions} />;
}
