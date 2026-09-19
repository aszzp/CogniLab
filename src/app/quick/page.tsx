import { composeQuick } from '@/lib/quiz';
import QuestionSession from '@/components/QuestionSession';

export const dynamic = 'force-dynamic';

export default function QuickPage() {
  const questions = composeQuick(10);
  if (!questions.length) {
    return <p className="mt-10 text-center text-sm text-zinc-500">题库为空，请先运行 seed。</p>;
  }
  return <QuestionSession questions={questions} mode="quick" title="碎片速刷" />;
}
