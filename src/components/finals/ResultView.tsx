import Link from 'next/link';
import { ArrowLeft, Check, Code2, X } from 'lucide-react';
import Markdown from '@/components/Markdown';
import type { Paper } from '@/lib/finals-content';
import { scoreAttempt, type Attempt } from '@/lib/finals-store';

const LETTERS = ['A', 'B', 'C', 'D'];
const VERDICT: Record<string, string> = {
  AC: '通过', WA: '答案错误', TLE: '运行超时', MLE: '内存超限', RE: '运行出错', SE: '判题异常',
};
const VERDICT_TONE: Record<string, string> = {
  AC: 'text-emerald-300', WA: 'text-rose-300', TLE: 'text-amber-300', MLE: 'text-amber-300', RE: 'text-rose-300', SE: 'text-zinc-400',
};
const CODE_BLOCK = 'code-area max-h-80 overflow-auto whitespace-pre rounded-xl border border-white/10 bg-[#0c0c14] p-3 text-xs leading-5 text-zinc-300';

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h} 小时 ${m} 分` : `${m} 分 ${s} 秒`;
}
const compact = (value: unknown, limit = 420) => {
  const text = JSON.stringify(value) ?? '';
  return text.length > limit ? `${text.slice(0, limit)} …（已截断，展开查看全部）` : text;
};

export default function ResultView({ attempt, paper, passScore }: { attempt: Attempt; paper: Paper; passScore: number }) {
  const breakdown = scoreAttempt(attempt, paper);
  const passed = breakdown.score >= passScore;
  const seconds = attempt.finishedAt ? Math.max(0, Math.round((attempt.finishedAt - attempt.startedAt) / 1000)) : 0;
  const theoryMax = Math.round(paper.theory.length * 0.6 * 10) / 10;
  const codeMax = paper.code.length * 10;

  const byModule = new Map<string, { correct: number; total: number }>();
  for (const q of paper.theory) {
    const row = byModule.get(q.module) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (attempt.answers[q.key] === q.answer) row.correct += 1;
    byModule.set(q.module, row);
  }
  const codeRows = paper.code.map((p) => {
    const history = attempt.submissions[p.key]?.history ?? [];
    return { problem: p, count: attempt.submissions[p.key]?.count ?? 0, first: history[0], last: history.at(-1), code: attempt.code[p.key] ?? '' };
  });
  const weakModules = [...byModule].filter(([, v]) => v.correct / v.total < 0.6).map(([m]) => m);
  const weakCode = codeRows.filter((r) => (r.last?.passed ?? 0) < 10);

  return (
    <div className="fade-up space-y-5">
      <Link href="/finals" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft size={13} /> 返回决赛模拟
      </Link>

      {attempt.endReason === 'switch' && (
        <div role="alert" className="card border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm">
          <p className="font-semibold text-amber-200">切屏达到上限，答案已自动提交</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">全真模式累计切屏 3 次即自动交卷。正式比赛只有一次作答机会，答题期间请全程留在答题页面。</p>
        </div>
      )}
      {attempt.endReason === 'timeout' && (
        <div role="status" className="card border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm">
          <p className="font-semibold text-amber-200">计时结束，已自动交卷</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">到时前未提交的编程题不计分，下次请预留点「提交」的时间。</p>
        </div>
      )}

      {/* 成绩总览 */}
      <div className="card relative overflow-hidden p-6 text-center">
        <div className={`pointer-events-none absolute -top-14 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl ${passed ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
        <p className="text-xs text-zinc-400">{paper.title} · {attempt.mode === 'strict' ? '全真模式' : '练习模式'}</p>
        <p className={`mt-1 text-6xl font-bold ${passed ? 'text-emerald-300' : 'text-rose-300'}`}>{breakdown.score}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {passed ? '达到 60 分合格线' : '未达 60 分合格线'} · 用时 {duration(seconds)} · 切屏 {attempt.switchCount} 次
        </p>
        <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-3 text-left text-xs">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-zinc-500">理论题 <span className="text-zinc-400">（单选 50 × 0.6）</span></p>
            <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">{breakdown.theoryScore}<span className="text-xs font-normal text-zinc-500"> / {theoryMax} 分</span></p>
            <p className="mt-0.5 text-zinc-500">答对 {breakdown.theoryCorrect} / {paper.theory.length}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-zinc-500">编程题 <span className="text-zinc-400">（7 × 10 个测试点）</span></p>
            <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">{breakdown.codeScore}<span className="text-xs font-normal text-zinc-500"> / {codeMax} 分</span></p>
            <p className="mt-0.5 text-zinc-500">提交 {codeRows.filter((r) => r.count > 0).length} / {paper.code.length} 题</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <Link href={`/finals/${paper.id}`} className="rounded-full bg-violet-600 px-4 py-2 font-semibold text-white">再考一次本卷</Link>
          <Link href="/finals/code" className="flex items-center gap-1 rounded-full border border-white/12 px-4 py-2 text-zinc-300">
            <Code2 size={13} /> 编程题专项练习
          </Link>
        </div>
      </div>

      {/* 得分分析 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm font-semibold">理论题 · 模块得分率</p>
          <div className="mt-3 space-y-3">
            {[...byModule].map(([mod, v]) => {
              const pct = Math.round((v.correct / v.total) * 100);
              return (
                <div key={mod} className="text-xs">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-zinc-300">{mod}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500">{v.correct}/{v.total} · {pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div className={`h-full rounded-full ${pct >= 60 ? 'bg-gradient-to-r from-violet-500 to-cyan-400' : 'bg-gradient-to-r from-amber-500 to-rose-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold">编程题 · 测试点通过情况</p>
          <ul className="mt-3 space-y-2">
            {codeRows.map(({ problem, count, last }) => (
              <li key={problem.key} className="text-xs">
                <a href={`#code-${problem.key}`} className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.04]">
                  <span className="w-12 shrink-0 text-zinc-500">第 {problem.no} 题</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{problem.title}</span>
                  <span className={`shrink-0 tabular-nums ${!count ? 'text-zinc-500' : (last?.passed ?? 0) === 10 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {count ? `${last?.passed}/10` : '未提交'}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-600">{count > 1 ? `提交 ${count} 次` : ''}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(weakModules.length > 0 || weakCode.length > 0) && (
        <div className="card p-5">
          <p className="text-sm font-semibold">薄弱点</p>
          <p className="mt-1 text-xs text-zinc-500">得分率低于 60% 的理论模块，以及未拿满测试点的编程题：</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {weakModules.map((m) => (
              <span key={m} className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">{m}</span>
            ))}
            {weakCode.map(({ problem }) => (
              <Link key={problem.key} href={`/finals/code/${problem.key}`} className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200">
                第 {problem.no} 题 {problem.title} · 去练习
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 理论题回顾 */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-200">理论题回顾（答错的默认展开）</h2>
        <div className="mt-3 space-y-2">
          {paper.theory.map((q) => {
            const yours = attempt.answers[q.key] ?? '';
            const correct = yours === q.answer;
            return (
              <details key={q.key} open={!correct} className={`card p-4 ${correct ? '' : 'border-rose-400/20'}`}>
                <summary className="flex cursor-pointer list-none items-start gap-2 text-[13.5px] leading-relaxed text-zinc-200 [&::-webkit-details-marker]:hidden">
                  {correct ? <Check size={15} className="mt-1 shrink-0 text-emerald-400" /> : <X size={15} className="mt-1 shrink-0 text-rose-400" />}
                  <span className="min-w-0 flex-1"><span className="mr-1 text-zinc-500">{q.no}.</span>{q.stem}</span>
                  <span className="shrink-0 text-xs">
                    <span className="text-rose-300">你的答案 {yours || '—'}</span>
                    <span className="ml-2 text-emerald-300">正确 {q.answer}</span>
                  </span>
                </summary>
                <ol className="mt-3 space-y-1.5">
                  {q.options.map((opt, i) => {
                    const letter = LETTERS[i];
                    const isAnswer = letter === q.answer, isYours = letter === yours;
                    return (
                      <li key={letter} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-relaxed ${
                        isAnswer ? 'bg-emerald-400/10 text-emerald-200' : isYours ? 'bg-rose-400/10 text-rose-200' : 'text-zinc-400'
                      }`}>
                        <span className="shrink-0 font-medium">{letter}.</span><span>{opt}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">{q.explanation}</p>
                <p className="mt-2 text-[11px] text-zinc-600">
                  {q.module} · {q.topic} · 难度 {'★'.repeat(q.difficulty)} · {q.basis}
                  {q.origin === 'prelim' && ' · 初赛真题'}
                  {q.origin === 'prelim_adapted' && ' · 据初赛题改编'}
                </p>
              </details>
            );
          })}
        </div>
      </section>

      {/* 编程题回顾 */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-200">编程题回顾</h2>
        <div className="mt-3 space-y-3">
          {codeRows.map(({ problem, count, first, last, code }) => {
            const statuses = last?.statuses ?? [];
            return (
              <details key={problem.key} id={`code-${problem.key}`} className="card scroll-mt-24 p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] [&::-webkit-details-marker]:hidden">
                  <span className="w-12 shrink-0 text-zinc-500">第 {problem.no} 题</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{problem.title}</span>
                  <span className={`shrink-0 text-xs ${count === 0 ? 'text-zinc-500' : (last?.passed ?? 0) === 10 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {count ? `${last?.passed} / 10 分` : '未提交 · 0 分'}
                  </span>
                </summary>

                <p className="mt-3 text-xs text-zinc-500">
                  能力项：{problem.ability} · 知识点：{problem.knowledge}
                  {count > 0 && <> · 首次提交 {first?.passed}/10 · 最终 {last?.passed}/10 · 共提交 {count} 次</>}
                </p>
                <div className="mt-3 text-[13px] text-zinc-300">
                  <Markdown>{problem.description}</Markdown>
                </div>

                <p className="mt-3 text-xs font-medium text-zinc-400">测试点（{statuses.filter((s) => s === 'AC').length} / 10 通过）</p>
                <ol className="mt-1.5 space-y-1">
                  {problem.cases.map((c, i) => {
                    const status = statuses[i];
                    return (
                      <li key={i} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                        <details>
                          <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                            <span className={`w-14 shrink-0 font-medium ${status ? VERDICT_TONE[status] : 'text-zinc-500'}`}>{status ? VERDICT[status] : '未判'}</span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500">测试点 {i + 1}：{compact(c.args)}</span>
                          </summary>
                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            <div><p className="text-zinc-500">输入</p><pre className={CODE_BLOCK}>{JSON.stringify(c.args, null, 1)}</pre></div>
                            <div><p className="text-zinc-500">期望输出</p><pre className={CODE_BLOCK}>{JSON.stringify(c.expected, null, 1)}</pre></div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-400">你的最终代码</p>
                    <pre className={`${CODE_BLOCK} mt-1`}>{code.trim() ? code : '（未作答）'}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-400">参考代码</p>
                    <pre className={`${CODE_BLOCK} mt-1`}>{problem.reference}</pre>
                  </div>
                </div>
                <div className="mt-3 text-[13px] text-zinc-300">
                  <Markdown>{problem.explanation}</Markdown>
                </div>
                <Link href={`/finals/code/${problem.key}`} className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 underline underline-offset-2">
                  <Code2 size={13} /> 在专项练习中重做本题
                </Link>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
