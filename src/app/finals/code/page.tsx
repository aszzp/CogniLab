import Link from 'next/link';
import { CheckCircle2, ChevronRight, Code2 } from 'lucide-react';
import { listSets, loadBlueprint } from '@/lib/finals-content';
import { practiceProgress } from '@/lib/finals-store';

export const dynamic = 'force-dynamic';

export default function CodePracticePage() {
  const papers = listSets();
  const { themes, exam } = loadBlueprint();
  const progress = new Map(practiceProgress().map((p) => [p.problemKey, p]));
  const rows = themes.map((theme) => ({
    theme,
    items: papers
      .map((paper) => ({ paper, problem: paper.code.find((c) => c.theme === theme.key) }))
      .filter((row) => row.problem),
  }));
  const done = [...progress.values()].filter((p) => p.bestPassed === exam.code.testPoints).length;

  return (
    <div className="fade-up space-y-5">
      <div className="pt-1">
        <h1 className="text-lg font-bold">编程题专项练习</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          编程题每题 10 分、占决赛总分 70%。同一场景在五套卷里各有一道变体，逐题练熟比刷理论题提分更快。已拿满 {done} 题。
        </p>
      </div>
      <div className="space-y-4">
        {rows.map(({ theme, items }) => (
          <section key={theme.key} className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Code2 size={15} className="text-emerald-300" /> 第 {theme.no} 题 · {theme.label}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">归入 {theme.module} · 每题 10 个测试点</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {items.map(({ paper, problem }) => {
                if (!problem) return null;
                const p = progress.get(problem.key);
                const full = p?.bestPassed === exam.code.testPoints;
                return (
                  <Link key={problem.key} href={`/finals/code/${problem.key}`}
                    className="group rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
                    <p className="text-[11px] text-zinc-500">卷{paper.no}</p>
                    <p className="mt-1 text-[13px] font-medium leading-snug text-zinc-200">{problem.title}</p>
                    <p className={`mt-2 flex items-center gap-1 text-[11px] tabular-nums ${full ? 'text-emerald-300' : p ? 'text-amber-300' : 'text-zinc-600'}`}>
                      {full && <CheckCircle2 size={12} />}
                      {p ? `最佳 ${p.bestPassed}/10 · 练 ${p.attempts} 次` : '未练过'}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <Link href="/finals" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
        <ChevronRight size={13} className="rotate-180" /> 返回决赛模拟
      </Link>
    </div>
  );
}
