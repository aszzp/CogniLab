import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Code2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import PracticeSession from '@/components/finals/PracticeSession';
import { findProblem, toPublicProblem } from '@/lib/finals-content';
import { practiceCode } from '@/lib/finals-store';
import { pythonVersion } from '@/lib/python-judge.mjs';

export const dynamic = 'force-dynamic';

const NAV = 'flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-30';

export default async function CodePracticeProblemPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = findProblem(key);
  if (!found) notFound();
  const { paper, problem } = found;
  const index = paper.code.indexOf(problem);
  const saved = practiceCode(key);
  const version = await pythonVersion();

  return (
    <div className="fade-up space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/finals/code" className={`${NAV} text-zinc-400`}>
          <ArrowLeft size={14} /> 专项练习
        </Link>
        <h1 className="min-w-0 flex-1 text-sm font-semibold text-zinc-200">
          <span className="text-zinc-500">{paper.title} · 第 {problem.no} 题</span> {problem.title}
        </h1>
        <span className="text-xs text-zinc-500">{problem.ability}</span>
      </div>
      <div className="flex gap-2">
        {index > 0 ? (
          <Link href={`/finals/code/${paper.code[index - 1].key}`} className={NAV}><ChevronLeft size={14} /> 上一题</Link>
        ) : (
          <button className={NAV} disabled><ChevronLeft size={14} /> 上一题</button>
        )}
        {index < paper.code.length - 1 ? (
          <Link href={`/finals/code/${paper.code[index + 1].key}`} className={NAV}>下一题 <ChevronRight size={14} /></Link>
        ) : (
          <button className={NAV} disabled>下一题 <ChevronRight size={14} /></button>
        )}
        <Link href={`/finals/${paper.id}`} className={`${NAV} ml-auto`}><Code2 size={13} /> 用这套卷做全真模拟</Link>
      </div>
      <p className="text-xs text-zinc-500">
        专项练习不限时；提交后可以展开未通过的测试点查看输入与期望输出。草稿自动保存。
      </p>
      <PracticeSession
        key={problem.key}
        problem={toPublicProblem(problem)}
        initialCode={saved.trim() ? saved : problem.starter}
        pythonLabel={`Python (${version ?? '3'})`}
      />
    </div>
  );
}
