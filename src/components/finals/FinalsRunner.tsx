'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutGrid, LogOut } from 'lucide-react';
import ProblemWorkspace from './ProblemWorkspace';
import type { CodePublic, TheoryPublic } from '@/lib/finals-content';
import type { ProblemSubmissions } from '@/lib/finals-store';
import { useEscape } from '@/lib/use-escape';

export interface InitialState {
  answers: Record<string, string>;
  code: Record<string, string>;
  submissions: Record<string, ProblemSubmissions>;
  switchCount: number;
  serverNow: number;
  startedAt: number;
  deadlineAt: number | null;
  /** 服务端当前的草稿版本号：页面内的自动保存从它继续递增，刷新页面也不会让旧请求盖掉新草稿 */
  rev: number;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}`;

export default function FinalsRunner({
  attemptId, mode, title, theory, problems, initial, pythonLabel, switchLimit,
}: {
  attemptId: number;
  mode: 'strict' | 'practice';
  title: string;
  theory: TheoryPublic[];
  problems: CodePublic[];
  initial: InitialState;
  pythonLabel: string;
  switchLimit: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initial.answers);
  const [code, setCode] = useState(initial.code);
  const [submissions, setSubmissions] = useState(initial.submissions);
  const [switchCount, setSwitchCount] = useState(initial.switchCount);
  const [view, setView] = useState<'paper' | 'code'>('paper');
  const [codeIdx, setCodeIdx] = useState(0);
  const [clockOffset] = useState(() => initial.serverNow - Date.now());
  const [now, setNow] = useState(initial.serverNow);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchNotice, setSwitchNotice] = useState<number | null>(null);
  const endedRef = useRef(false);
  const pendingJump = useRef<string | null>(null);
  const revision = useRef(initial.rev);
  const draft = useRef({ answers, code });
  useEscape(confirmOpen, () => setConfirmOpen(false));
  useEscape(sheetOpen, () => setSheetOpen(false));
  useEscape(switchNotice !== null, () => setSwitchNotice(null));

  // 事件回调里要拿到最新草稿：提交后同步到 ref，避免闭包里的旧值
  useEffect(() => { draft.current = { answers, code }; }, [answers, code]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => clearInterval(timer);
  }, [clockOffset]);

  const remaining = initial.deadlineAt === null ? null : Math.max(0, initial.deadlineAt - now);
  const elapsed = Math.max(0, now - initial.startedAt);

  const goResult = useCallback(() => router.replace(`/finals/result/${attemptId}`), [router, attemptId]);

  const save = useCallback(async (keepalive = false) => {
    const rev = ++revision.current;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/finals/attempt/${attemptId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, keepalive,
        body: JSON.stringify({ ...draft.current, rev }),
      });
      if (res.status === 409) { endedRef.current = true; goResult(); return; }
      if (!res.ok) throw new Error(String(res.status));
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [attemptId, goResult]);

  // 草稿改动后 1.5 秒自动保存
  useEffect(() => {
    const timer = setTimeout(() => { void save(); }, 1500);
    return () => clearTimeout(timer);
  }, [answers, code, save]);

  const finish = useCallback(async (reason: 'manual' | 'timeout') => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      await fetch(`/api/finals/attempt/${attemptId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ action: 'finish', reason, ...draft.current }),
      });
    } catch {
      // 请求没送达也没关系：全真模式下服务端按截止时间兜底收尾
    }
    goResult();
  }, [attemptId, goResult]);

  // 全真模式：时间到自动交卷
  useEffect(() => {
    if (remaining === 0 && !endedRef.current) void finish('timeout');
  }, [remaining, finish]);

  // 全真模式：离开页面记一次切屏，达到上限由服务端自动交卷
  useEffect(() => {
    if (mode !== 'strict') return;
    const onHidden = () => {
      if (document.visibilityState !== 'hidden' || endedRef.current) return;
      void fetch(`/api/finals/attempt/${attemptId}/switch`, { method: 'POST', keepalive: true })
        .then(async (res) => (res.ok ? res.json() : null))
        .then((data: { count?: number; finished?: boolean } | null) => {
          if (!data) return;
          if (data.finished) { endedRef.current = true; goResult(); return; }
          setSwitchCount(data.count ?? 0);
          setSwitchNotice(data.count ?? 0);
        })
        .catch(() => undefined);
    };
    const onLeave = () => { if (!endedRef.current) void save(true); };
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', guard);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', guard);
    };
  }, [mode, attemptId, save, goResult]);

  // 从编程题页回到卷面后，再滚动到答题卡选中的题目
  useEffect(() => {
    if (view !== 'paper' || !pendingJump.current) return;
    const key = pendingJump.current;
    pendingJump.current = null;
    scrollToQuestion(key);
  }, [view]);

  const answered = theory.filter((q) => answers[q.key]).length;
  const submitted = problems.filter((p) => (submissions[p.key]?.count ?? 0) > 0).length;
  const total = theory.length + problems.length;
  const progress = answered + submitted;
  const unsubmitted = problems.filter((p) => (submissions[p.key]?.count ?? 0) === 0);
  const lastPassed = (key: string) => submissions[key]?.history.at(-1)?.passed;
  const urgent = remaining !== null && remaining <= 5 * 60_000;

  // 瞬时滚动：不依赖平滑动画与 requestAnimationFrame，页面刚切回前台或系统「减弱动态效果」时同样可靠
  function scrollToQuestion(key: string) {
    document.getElementById(`q-${key}`)?.scrollIntoView({ block: 'center' });
  }

  function jumpTo(key: string) {
    setSheetOpen(false);
    // 已经在卷面时视图状态不变、下面的 effect 不会触发，直接滚动
    if (view === 'paper') { scrollToQuestion(key); return; }
    pendingJump.current = key;
    setView('paper');
  }

  function openProblem(index: number) {
    setCodeIdx(index);
    setSheetOpen(false);
    setView('code');
    window.scrollTo({ top: 0 });
  }

  const timerNode = (
    <p className={`font-mono text-xl font-bold tabular-nums md:text-2xl ${urgent ? 'pulse-soft text-rose-300' : 'text-indigo-300'}`}>
      {remaining === null ? clock(elapsed) : clock(remaining)}
    </p>
  );

  const toolbox = (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-zinc-500">{remaining === null ? '已用时间' : '剩余时间'}</p>
        {timerNode}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">进度</span>
        <span className="tabular-nums text-zinc-200">{progress}/{total}</span>
      </div>
      {mode === 'strict' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">屏幕切出数</span>
          <span className={`tabular-nums ${switchCount > 0 ? 'text-rose-300' : 'text-zinc-200'}`}>{switchCount}/{switchLimit}</span>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">单选题组</p>
        <div className="grid grid-cols-10 gap-1.5">
          {theory.map((q) => {
            const done = !!answers[q.key];
            return (
              <button key={q.key} onClick={() => jumpTo(q.key)} aria-label={`第 ${q.no} 题${done ? '，已答' : '，未答'}`}
                className={`rounded-md border py-1.5 text-xs tabular-nums transition-colors ${
                  done ? 'border-violet-400/60 bg-violet-500/25 font-medium text-white' : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-300'
                }`}>
                {q.no}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-300">实操题组</p>
        <div className="space-y-1.5">
          {problems.map((p, i) => {
            const count = submissions[p.key]?.count ?? 0;
            return (
              <button key={p.key} onClick={() => openProblem(i)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]">
                <span className="shrink-0 rounded border border-indigo-400/40 px-1.5 py-0.5 text-[10px] text-indigo-300">编程</span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{p.no} (10 分) {p.title}</span>
                <span className={`shrink-0 text-[11px] ${count ? 'text-emerald-300' : 'text-zinc-500'}`}>
                  {count ? `${lastPassed(p.key)}/10` : '未提交'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        {mode === 'strict'
          ? `切屏累计 ${switchLimit} 次将自动交卷；计时结束自动提交，中途不可暂停。`
          : '练习模式：不限时、切屏不判违规，提交后可看到运行错误信息。'}
      </p>
    </div>
  );

  const problem = problems[codeIdx];

  return (
    <div className="-mb-36 -mt-4 space-y-3 md:-mb-20 md:-mt-16">
      {/* 顶栏：赛事信息、倒计时、切屏、交卷 */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-white/8 bg-[#07070c]/85 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-zinc-200">{title}</p>
            <p className="truncate text-[11px] text-zinc-500">
              模拟考生 · 总分 100 · 题目数量 {total} · {mode === 'strict' ? '全真模式' : '练习模式'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              {timerNode}
              <p className="text-[10px] text-zinc-600">
                {saveState === 'saving' ? '保存中…' : saveState === 'error' ? '保存失败' : '已自动保存'}
              </p>
            </div>
            <button onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1 rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400">
              <LogOut size={13} className="-rotate-90" /> 交卷
            </button>
          </div>
        </div>
      </header>

      {view === 'paper' ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="lg:col-span-8">
            <h2 className="text-sm font-semibold text-zinc-100">单选题组</h2>
            <p className="mt-0.5 text-xs text-zinc-500">根据题干，从四个选项中选出唯一答案。</p>
            <div className="mt-3 space-y-3">
              {theory.map((q) => (
                <article key={q.key} id={`q-${q.key}`} className="card scroll-mt-24 p-4">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded border border-indigo-400/40 px-1.5 py-0.5 text-indigo-300">单选</span>
                    <span className="text-zinc-500">{q.no} (0.6 分)</span>
                    <span className="ml-auto text-zinc-600">{q.module}</span>
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-100">{q.stem}</p>
                  <div className="mt-2.5 space-y-1">
                    {q.options.map((opt, i) => {
                      const letter = LETTERS[i];
                      const on = answers[q.key] === letter;
                      return (
                        <button key={i} onClick={() => setAnswers((a) => ({ ...a, [q.key]: letter }))} aria-pressed={on}
                          className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
                          <span className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                            on ? 'border-violet-400 bg-violet-500' : 'border-zinc-600'
                          }`}>
                            {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className={`text-[13.5px] leading-relaxed ${on ? 'text-zinc-100' : 'text-zinc-300'}`}>
                            <span className="mr-1.5 text-zinc-500">{letter}.</span>{opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="card sticky top-20 p-4">
              <p className="mb-3 text-xs font-semibold text-zinc-400">工具箱</p>
              {toolbox}
            </div>
          </aside>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => openProblem(codeIdx - 1)} disabled={codeIdx === 0}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-white/10 px-2.5 py-2 text-xs text-zinc-300 disabled:opacity-30 sm:px-3">
              <ChevronLeft size={14} /> 上一题
            </button>
            <button onClick={() => openProblem(codeIdx + 1)} disabled={codeIdx === problems.length - 1}
              className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-white/10 px-2.5 py-2 text-xs text-zinc-300 disabled:opacity-30 sm:px-3">
              下一题 <ChevronRight size={14} />
            </button>
            <span className="hidden text-xs text-zinc-500 sm:inline">第 {problem.no} 题 · {codeIdx + 1}/{problems.length}</span>
            <button onClick={() => setView('paper')} className="ml-auto flex items-center gap-1 whitespace-nowrap rounded-xl border border-white/10 px-2.5 py-2 text-xs text-zinc-300 sm:px-3">
              <LayoutGrid size={14} /> 返回答题卡
            </button>
          </div>
          <ProblemWorkspace
            key={problem.key}
            problem={problem}
            initialCode={code[problem.key] ?? problem.starter}
            pythonLabel={pythonLabel}
            attemptId={attemptId}
            revealErrors={mode === 'practice'}
            submissions={submissions[problem.key]}
            onChange={(value) => setCode((c) => ({ ...c, [problem.key]: value }))}
            onSubmitted={(key, subs) => setSubmissions((s) => ({ ...s, [key]: subs ?? { count: 0, history: [] } }))}
            onNext={codeIdx < problems.length - 1 ? () => openProblem(codeIdx + 1) : undefined}
          />
        </div>
      )}

      {/* 窄屏底栏 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#0a0a12]/90 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3 py-2">
          {timerNode}
          <span className="text-xs text-zinc-500">进度 {progress}/{total}</span>
          <button onClick={() => setSheetOpen(true)} className="grad-btn flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white">
            <LayoutGrid size={14} /> 答题卡
          </button>
        </div>
      </div>

      {/* 答题卡抽屉（窄屏） */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)}>
          <div className="card drawer-in max-h-[82vh] w-full overflow-auto rounded-3xl bg-[#11111a] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-semibold">答题卡（已答 {answered}/{theory.length} · 已提交 {submitted}/{problems.length}）</p>
            {toolbox}
          </div>
        </div>
      )}

      {/* 切屏提醒 */}
      {switchNotice !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setSwitchNotice(null)}>
          <div role="alert" className="card drawer-in w-full max-w-sm rounded-3xl bg-[#11111a] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-amber-200">已切屏 {switchNotice} 次</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              比赛过程中离开当前页面会记为切屏，累计 {switchLimit} 次将自动交卷。正式比赛只有一次作答机会，请全程留在答题页面。
            </p>
            <button onClick={() => setSwitchNotice(null)} className="mt-5 w-full rounded-full bg-zinc-950 py-2.5 text-sm font-semibold text-white">
              知道了，继续答题
            </button>
          </div>
        </div>
      )}

      {/* 交卷确认 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div role="alertdialog" aria-modal="true" aria-label="确认交卷" className="card drawer-in w-full max-w-sm rounded-3xl bg-[#11111a] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-[15px] font-semibold">确认交卷？</p>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-zinc-400">
              <li>· 理论题已答 <span className="text-zinc-200">{answered}/{theory.length}</span>，还有 {theory.length - answered} 题未作答</li>
              <li>
                · 编程题已提交 <span className="text-zinc-200">{submitted}/{problems.length}</span>
                {unsubmitted.length > 0 && (
                  <span className="text-rose-300">，第 {unsubmitted.map((p) => p.no).join('、')} 题未提交（记 0 分）</span>
                )}
              </li>
              <li>· 剩余时间 {remaining === null ? '不限' : clock(remaining)}</li>
            </ul>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-white/12 py-2.5 text-sm text-zinc-300">
                继续答题
              </button>
              <button onClick={() => { setConfirmOpen(false); void finish('manual'); }}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white">
                确认交卷
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
