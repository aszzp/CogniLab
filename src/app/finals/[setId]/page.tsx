import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import StartExam from '@/components/finals/StartExam';
import { listSets, loadBlueprint, loadPaper } from '@/lib/finals-content';
import { listAttempts } from '@/lib/finals-store';

export const dynamic = 'force-dynamic';

const END_LABEL = { manual: '主动交卷', timeout: '计时结束自动交卷', switch: '切屏达到上限自动交卷' } as const;

export default async function SetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const paper = loadPaper(setId);
  if (!paper) notFound();
  const { exam } = loadBlueprint();
  const attempts = listAttempts(200).filter((a) => a.setId === setId);
  const finished = attempts.filter((a) => a.status === 'finished');
  const best = finished.reduce((m, a) => Math.max(m, a.score ?? 0), 0);
  const others = listSets().filter((p) => p.id !== setId);
  const modules = new Map<string, number>();
  for (const q of paper.theory) modules.set(q.module, (modules.get(q.module) ?? 0) + 1);

  return (
    <div className="fade-up space-y-5">
      <Link href="/finals" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft size={13} /> 返回决赛模拟
      </Link>

      <div className="card p-5">
        <p className="text-xs text-zinc-500">{exam.title}</p>
        <h1 className="mt-1 text-xl font-bold text-zinc-100">{paper.title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {exam.theory.count} 道单选题（每题 {exam.theory.pointsEach} 分，共 {exam.theory.count * exam.theory.pointsEach} 分）+ {exam.code.count} 道编程题（每题 {exam.code.pointsEach} 分，共 {exam.code.count * exam.code.pointsEach} 分），共 {exam.theory.count + exam.code.count} 题、满分 {exam.totalScore} 分，考试时长 {exam.durationMin} 分钟。
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-5">
          {[
            ['总分', `${exam.totalScore} 分`],
            ['题目数量', String(exam.theory.count + exam.code.count)],
            ['时长', `${exam.durationMin} 分钟`],
            ['作答次数', String(attempts.length)],
            ['最高分', finished.length ? String(best) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.03] py-2.5">
              <dt className="text-sm font-semibold tabular-nums text-zinc-200">{value}</dt>
              <dd className="mt-0.5 text-[11px] text-zinc-500">{label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <StartExam setId={setId} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm font-semibold">试卷结构</p>
          <p className="mt-3 text-xs font-medium text-zinc-400">单选题组 · {[...modules.entries()].map(([m, n]) => `${m} ${n}`).join(' · ')}</p>
          <p className="mt-3 text-xs font-medium text-zinc-400">实操题组</p>
          <ul className="mt-1.5 space-y-1.5">
            {paper.code.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 text-zinc-500">第 {p.no} 题</span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">{p.title}</span>
                <span className="shrink-0 text-zinc-600">{p.ability}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold">本场作答记录</p>
          {attempts.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">还没有作答记录。建议先做一套全真模拟，再根据成绩回顾里的薄弱点到「编程题专项练习」补强。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attempts.map((a) => (
                <li key={a.id}>
                  <Link href={a.status === 'finished' ? `/finals/result/${a.id}` : `/finals/attempt/${a.id}`}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-xs transition-colors hover:bg-white/[0.06]">
                    <span className={`w-10 shrink-0 text-right text-lg font-bold tabular-nums ${a.status === 'finished' && (a.score ?? 0) >= 60 ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {a.status === 'finished' ? a.score : '进行中'}
                    </span>
                    <span className="min-w-0 flex-1 text-zinc-400">
                      {a.mode === 'strict' ? '全真模式' : '练习模式'}
                      <span className="ml-1.5 text-zinc-600">{a.status === 'finished' ? END_LABEL[a.endReason ?? 'manual'] : '可继续作答'}</span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-zinc-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="self-center text-zinc-500">其他套卷：</span>
          {others.map((p) => (
            <Link key={p.id} href={`/finals/${p.id}`} className="rounded-full border border-white/12 px-3 py-1 text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-200">
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
