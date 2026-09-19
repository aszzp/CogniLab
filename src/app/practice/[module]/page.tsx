import { notFound } from 'next/navigation';
import { byModule } from '@/lib/quiz';
import QuestionSession from '@/components/QuestionSession';
import { MODULES } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default async function ModulePractice({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const mod = decodeURIComponent(module);
  if (!MODULES.includes(mod as (typeof MODULES)[number])) notFound();
  const questions = byModule(mod);
  if (!questions.length) notFound();
  return <QuestionSession questions={questions} mode="practice" title={`${mod} · 模块练习`} />;
}
