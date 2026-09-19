import { redirect } from 'next/navigation';
import { dueReview } from '@/lib/quiz';
import QuestionSession from '@/components/QuestionSession';

export const dynamic = 'force-dynamic';

export default function ReviewSession() {
  const questions = dueReview(30);
  if (!questions.length) redirect('/wrong');
  return <QuestionSession questions={questions} mode="review" title="错题复习" />;
}
