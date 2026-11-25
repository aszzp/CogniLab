import Link from 'next/link';
import { ChevronRight, Code2, Play, Trophy } from 'lucide-react';
import { listSets, loadBlueprint } from '@/lib/finals-content';
import { listAttempts, type Attempt } from '@/lib/finals-store';

export const dynamic = 'force-dynamic';

const MODE_LABEL = { strict: '全真', practice: '练习' } as const;
const END_LABEL = { manual: '主动交卷', timeout: '计时结束自动交卷', switch: '切屏达到上限自动交卷' } as const;

function fmtTime(ms: number) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const fmtDuration = (sec: number) => `${Math.floor(sec / 60)} 分 ${String(sec % 60).padStart(2, '0')} 秒`;

function AttemptRow({ attempt, paperTitle }: { attempt: Attempt; paperTitle: string }) {
  const score = attempt.score ?? 0;
  const seconds = attempt.finishedAt ? Math.max(0, Math.round((attempt.finishedAt - attempt.startedAt) / 1000)) : 0;
  return (
    <Link href={`/finals/result/${attempt.id}`}
      className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]">
      <span className={`w-12 shrink-0 text-right text-xl font-bold tabular-nums ${score >= 60 ? 'text-emerald-300' : 'text-rose-300'}`}>
        {score}<span className="ml-0.5 text-[10px] font-medium">分</span>
      </span>
      <span className="min-w-0 flex-1 text-xs">
        <span className="block font-medium text-zinc-300">{paperTitle} · {MODE_LABEL[attempt.mode]}模式</span>
        <span className="mt-0.5 block text-zinc-500">
          {attempt.finishedAt ? `${fmtTime(attempt.finishedAt)} · 用时 ${fmtDuration(seconds)} · ${END_LABEL[attempt.endReason ?? 'manual']}` : '进行中'}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-zinc-500" />
    </Link>
  );
}

export default function FinalsPage() {
  const papers = listSets();
  const { exam, modules, themes, standardWeights } = loadBlueprint();
  const attempts = listAttempts(12);
  const finished = attempts.filter((a) => a.status === 'finished');
  const ongoing = attempts.find((a) => a.status === 'ongoing');
  const titleOf = (setId: string) => papers.find((p) => p.id === setId)?.title ?? setId;
  const stats = (setId: string) => {
    const mine = finished.filter((a) => a.setId === setId);
    return { count: mine.length, best: mine.reduce((m, a) => Math.max(m, a.score ?? 0), 0) };
  };

  return (
    <div className="fade-up space-y-5">
      <div className="pt-1">
        <h1 className="text-lg font-bold">决赛模拟</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          对标全国总决赛：{exam.theory.count} 道单选 × {exam.theory.pointsEach} 分 + {exam.code.count} 道编程题 × {exam.code.pointsEach} 分，满分 {exam.totalScore} 分，{exam.durationMin} 分钟
        </p>
      </div>

      {ongoing && (
        <Link href={`/finals/attempt/${ongoing.id}`}
          className="card flex items-center gap-3 border-amber-400/25 bg-amber-400/[0.06] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
            <Play size={16} className="text-amber-300" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold text-amber-200">{titleOf(ongoing.setId)}</span>
            <span className="ml-1 text-zinc-400">有一场作答尚未结束</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-amber-200">继续答题</span>
        </Link>
      )}

      {papers.length === 0 ? (
        <div className="card p-6 text-center text-xs text-zinc-500">
          还没有生成套卷。运行 <code className="rounded bg-white/10 px-1.5 py-0.5">python3 scripts/finals/build.py</code> 生成 data/finals/sets。
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {papers.map((paper) => {
            const s = stats(paper.id);
            return (
              <Link key={paper.id} href={`/finals/${paper.id}`} className="card flex items-center gap-4 p-5 transition-transform active:scale-[0.99]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500">
                  <span className="text-base font-bold text-white">{paper.no}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-zinc-100">{paper.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    理论 {paper.theory.length} 题 · 编程 {paper.code.length} 题 · 已作答 {s.count} 次
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-xl font-bold tabular-nums ${s.best >= 60 ? 'text-emerald-300' : s.best > 0 ? 'text-rose-300' : 'text-zinc-600'}`}>
                    {s.count ? s.best : '—'}
                  </span>
                  <span className="text-[10px] text-zinc-500">最高分</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/finals/code" className="card flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/12">
          <Code2 size={18} className="text-emerald-300" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-zinc-100">编程题专项练习</span>
          <span className="ml-1.5 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-zinc-400">占 70 分</span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">35 道题逐题专练，不限时，提交后可查看未通过的测试点</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
      </Link>

      {attempts.length > 0 && (
        <div className="card p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy size={15} className="text-amber-300" /> 历史成绩
          </p>
          <div className="space-y-2">
            {attempts.map((a) => <AttemptRow key={a.id} attempt={a} paperTitle={titleOf(a.setId)} />)}
          </div>
        </div>
      )}

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-200">命题蓝图与依据</summary>
        <div className="mt-4 space-y-4 text-xs leading-relaxed text-zinc-400">
          <p>
            结构取自《全国总决赛平台操作手册（测试比赛）》；命题依据《人工智能训练师国家职业技能标准（2021 年版）》三级/高级工及以上，题干风格参照初赛试题与官方样题。
            每套 {exam.theory.count} 道单选按下列模块配额组卷，7 道编程题各对应一个工作场景。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="border-b border-white/8 py-1.5 pr-4 font-medium">模块</th>
                  <th className="border-b border-white/8 py-1.5 pr-4 font-medium">题数</th>
                  <th className="border-b border-white/8 py-1.5 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.key}>
                    <td className="border-b border-white/6 py-1.5 pr-4 text-zinc-300">{m.key}</td>
                    <td className="border-b border-white/6 py-1.5 pr-4 tabular-nums">{m.count}</td>
                    <td className="border-b border-white/6 py-1.5">{m.note}</td>
                  </tr>
                ))}
                {themes.map((t) => (
                  <tr key={t.key}>
                    <td className="border-b border-white/6 py-1.5 pr-4 text-zinc-300">编程 · {t.label}</td>
                    <td className="border-b border-white/6 py-1.5 pr-4 tabular-nums">1 题 × 5 套</td>
                    <td className="border-b border-white/6 py-1.5">归入 {t.module}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-500">{String(standardWeights.note)}（职业道德 5、基础知识 10、业务分析 20、智能训练 30、智能系统设计 30、培训与指导 5）</p>
        </div>
      </details>
    </div>
  );
}
