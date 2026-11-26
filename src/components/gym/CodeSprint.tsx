'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, CheckCircle2, Code2, Flame, Lightbulb, Loader2, Play, RotateCcw, Timer, Trophy, XCircle,
} from 'lucide-react';
import CodeEditor from '@/components/trainers/CodeEditor';
import { TRAP_LABEL, type GymCode, type GymItem, type GymProgress } from '@/lib/gym/types';

const TOTAL_ROUNDS = 5;
const SAMPLE_SIZE = 3;

const STATUS_DOT: Record<string, string> = {
  AC: 'bg-emerald-400',
  WA: 'bg-rose-400',
  TLE: 'bg-amber-400',
  MLE: 'bg-amber-400',
  RE: 'bg-rose-400',
  SE: 'bg-zinc-500',
};

interface SprintCase {
  status: string;
  ms: number;
  args?: unknown;
  expected?: unknown;
  actual?: unknown;
  error?: string;
}

interface SprintResponse {
  passed: number;
  total: number;
  status: string;
  label: string;
  results: SprintCase[];
  python?: string | null;
  explain?: string;
  progress?: GymProgress;
  error?: string;
}

interface SprintView extends SprintResponse {
  latencyMs: number;
}

/** 只保留 import/from 行和第一个 def 签名，函数体清空，强迫从零实现。 */
function zeroStarter(starter: string): string {
  const imports: string[] = [];
  let signature: string | null = null;
  for (const line of starter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(?:import|from)\s/.test(trimmed)) {
      imports.push(trimmed);
      continue;
    }
    if (/^def\s/.test(trimmed)) {
      signature = trimmed;
      break;
    }
  }
  if (!signature) return starter;
  return `${[...imports, signature].join('\n')}\n    # 从零实现：写出完整函数\n    pass\n`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
}

function formatSpan(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return formatClock(ms / 1000);
}

function formatJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
      <p className="text-[9.5px] tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-semibold tabular-nums ${accent ?? 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}

function StatusBars({ results }: { results: SprintCase[] }) {
  if (!results.length) return null;
  return (
    <div
      role="img"
      aria-label={`用例结果：${results.map((r) => r.status).join('，')}`}
      className="mt-2 flex items-center gap-1.5"
    >
      {results.map((r, i) => (
        <span
          key={i}
          title={`用例 ${i + 1} · ${r.status} · ${r.ms}ms`}
          className={`h-2.5 flex-1 rounded ${STATUS_DOT[r.status] ?? 'bg-zinc-500'}`}
        />
      ))}
    </div>
  );
}

export default function CodeSprint({
  item, drill, pythonLabel, onProgress,
}: {
  item: GymItem;
  drill: GymCode;
  pythonLabel: string;
  onProgress?: (p: GymProgress) => void;
}) {
  const initialCode = useMemo(() => zeroStarter(drill.starter), [drill.starter]);
  const [code, setCode] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SprintView | null>(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [now, setNow] = useState(0);

  const sessionStart = useRef(0);
  const roundStart = useRef(0);
  const runRef = useRef<() => void>(() => {});
  const runningRef = useRef(false);

  // 计时只由 1s 间隔驱动，卸载时清理；提交时用真实时间戳算毫秒。
  useEffect(() => {
    const started = Date.now();
    sessionStart.current = started;
    roundStart.current = started;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    runRef.current = () => { void run(); };
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const totalSec = sessionStart.current > 0 && now > 0
    ? Math.max(0, Math.floor((now - sessionStart.current) / 1000))
    : 0;
  const roundSec = roundStart.current > 0 && now > 0
    ? Math.max(0, Math.floor((now - roundStart.current) / 1000))
    : 0;

  async function run() {
    if (runningRef.current || sessionDone) return;
    if (!code.trim()) {
      setError('代码不能为空');
      return;
    }
    const latencyMs = roundStart.current > 0 ? Math.max(0, Date.now() - roundStart.current) : 0;
    runningRef.current = true;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/gym/sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: item.key, drillId: drill.id, code, latencyMs }),
      });
      const data = (await res.json()) as Partial<SprintResponse>;
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `请求失败（${res.status}）`);
      if (
        typeof data.passed !== 'number'
        || typeof data.total !== 'number'
        || !Array.isArray(data.results)
      ) {
        throw new Error('判题返回格式异常');
      }
      const view: SprintView = {
        passed: data.passed,
        total: data.total,
        status: String(data.status ?? ''),
        label: String(data.label ?? ''),
        results: data.results,
        python: data.python ?? null,
        explain: data.explain,
        progress: data.progress,
        latencyMs,
      };
      setResult(view);
      if (data.progress) onProgress?.(data.progress);
      const passedAll = view.total > 0 && view.passed === view.total;
      if (passedAll) {
        setStreak((s) => s + 1);
        setBestMs((prev) => (prev == null ? latencyMs : Math.min(prev, latencyMs)));
        if (round >= TOTAL_ROUNDS) setSessionDone(true);
      } else {
        setStreak(0);
        setShowHint(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  function nextRound() {
    if (round >= TOTAL_ROUNDS) return;
    setCode(initialCode);
    setResult(null);
    setError('');
    setShowHint(false);
    setRound((r) => Math.min(TOTAL_ROUNDS, r + 1));
    roundStart.current = Date.now();
    setNow(Date.now());
  }

  function restart() {
    const started = Date.now();
    sessionStart.current = started;
    roundStart.current = started;
    setNow(started);
    setCode(initialCode);
    runningRef.current = false;
    setRunning(false);
    setResult(null);
    setError('');
    setRound(1);
    setStreak(0);
    setBestMs(null);
    setShowHint(false);
    setSessionDone(false);
  }

  const passedAll = result ? result.total > 0 && result.passed === result.total : false;
  const firstFailureIndex = result ? result.results.findIndex((r) => r.status !== 'AC') : -1;
  const firstFailure = result && firstFailureIndex >= 0 ? result.results[firstFailureIndex] : null;
  // 冲刺模式从零实现；去掉原填空题的“补全 N 个空并运行”前缀，避免误导。
  const sprintPrompt = drill.prompt
    .replace(/^补全\s*\d+\s*个空(?:并运行)?[：:。]?\s*/, '')
    .trim() || drill.prompt;

  return (
    <section className="card space-y-3 p-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-violet-200">
            <Code2 size={10} /> 代码冲刺
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-400">{item.title}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] tabular-nums text-zinc-300">
            第 {round}/{TOTAL_ROUNDS} 轮
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="总计时" value={formatClock(totalSec)} />
          <Stat label="本轮" value={formatClock(roundSec)} />
          <Stat label="连续 AC" value={`${streak} 次`} accent={streak > 0 ? 'text-emerald-200' : undefined} />
          <Stat
            label="最佳本轮"
            value={bestMs == null ? '—' : formatSpan(bestMs)}
            accent={bestMs == null ? undefined : 'text-amber-200'}
          />
        </div>
      </header>

      <div className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <p className="text-[13px] leading-relaxed text-zinc-200">{sprintPrompt}</p>
        <p className="text-[10.5px] text-cyan-300/80">冲刺模式：不看空位，直接写出完整函数。</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded-full border border-violet-400/25 bg-violet-400/[0.06] px-2 py-0.5 text-violet-200">
            函数名 · {drill.fn}
          </span>
          {drill.trap && (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-2 py-0.5 text-amber-200/90">
              考点 · {TRAP_LABEL[drill.trap]}
            </span>
          )}
          <span className="rounded-full border border-white/8 px-2 py-0.5 text-zinc-500">
            每轮随机 {Math.min(SAMPLE_SIZE, drill.cases.length)} 个用例
          </span>
        </div>
        {drill.cases.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-white/8 bg-[#0c0c14] p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-zinc-500">样例输入</p>
              <pre className="mt-1 overflow-x-auto text-[11px] leading-5 text-cyan-200">
                {formatJson(drill.cases[0]?.args)}
              </pre>
            </div>
            <div className="min-w-0 rounded-lg border border-white/8 bg-[#0c0c14] p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-zinc-500">样例输出</p>
              <pre className="mt-1 overflow-x-auto text-[11px] leading-5 text-emerald-200">
                {formatJson(drill.cases[0]?.expected)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {!sessionDone && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-zinc-400">
              <Code2 size={11} /> 从零实现
            </span>
            <span className="text-[10px] text-zinc-600">{pythonLabel}</span>
            <span className="ml-auto hidden text-[10px] tabular-nums text-zinc-600 sm:inline">
              {formatClock(roundSec)} / 本轮
            </span>
          </div>
          <CodeEditor
            value={code}
            onChange={setCode}
            language="python"
            minHeight={280}
            tabSize={4}
            autoIndent
            placeholder={`def ${drill.fn}(...):\n    ...`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void run(); }}
              disabled={running}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="grad-btn flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {running ? '判题中…' : '运行判题'}
            </button>
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              aria-expanded={showHint}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2.5 text-[12px] text-amber-200 hover:bg-amber-400/[0.1]"
            >
              <Lightbulb size={13} /> {showHint ? '收起提示' : '提示'}
            </button>
            <span className="flex w-full items-center gap-1 text-[10px] text-zinc-600 sm:ml-auto sm:w-auto">
              <Timer size={10} /> Ctrl/Cmd + Enter 运行 · 手动提交
            </span>
          </div>

          {showHint && (
            <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-200">
                <Lightbulb size={12} /> 提示
              </p>
              {item.formula && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-200/60">{item.formula.label}</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-[#0c0c14] p-2.5 text-[11px] leading-5 text-amber-100/90">
                    {item.formula.code}
                  </pre>
                </div>
              )}
              {item.skeleton && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-200/60">参考骨架</p>
                  <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-[#0c0c14] p-2.5 text-[11px] leading-5 text-zinc-300">
                    {item.skeleton}
                  </pre>
                </div>
              )}
              {!item.formula && !item.skeleton && (
                <p className="text-[11px] text-zinc-400">暂无额外提示，按题面从零实现。</p>
              )}
            </div>
          )}
        </div>
      )}

      <div aria-live="polite" className="space-y-2">
        {error && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-[11.5px] leading-relaxed text-rose-200">
            {error}
          </div>
        )}

        {result && !sessionDone && passedAll && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-200">
                <CheckCircle2 size={14} /> 本轮 AC
              </p>
              <span className="text-[10.5px] tabular-nums text-emerald-200/70">
                {result.passed}/{result.total} 用例
              </span>
              <span className="ml-auto text-[10.5px] tabular-nums text-zinc-400">
                本轮 {formatSpan(result.latencyMs)}
              </span>
            </div>
            <StatusBars results={result.results} />
            {result.explain && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-300">{result.explain}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {round < TOTAL_ROUNDS && (
                <button
                  type="button"
                  onClick={nextRound}
                  className="grad-btn flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
                >
                  下一轮 <ArrowRight size={13} />
                </button>
              )}
              <span className="text-[10.5px] text-zinc-500">
                连续 AC {streak} 次 · 还剩 {TOTAL_ROUNDS - round} 轮
              </span>
            </div>
          </div>
        )}

        {result && !sessionDone && !passedAll && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-200">
                <XCircle size={14} /> 本轮未通过
              </p>
              <span className="text-[10.5px] tabular-nums text-rose-200/70">
                {result.passed}/{result.total} 用例 · {result.label}
              </span>
              <span className="ml-auto text-[10.5px] tabular-nums text-zinc-400">
                本轮 {formatSpan(result.latencyMs)}
              </span>
            </div>
            <StatusBars results={result.results} />

            {firstFailure ? (
              <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/25 p-2.5">
                <p className="text-[10px] text-rose-200/70">
                  第一个失败用例 {firstFailureIndex + 1} · {firstFailure.status} · {firstFailure.ms}ms
                </p>
                <dl className="mt-1 space-y-1 text-[11px] leading-5">
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 text-zinc-500">输入</dt>
                    <dd className="min-w-0 break-all text-cyan-200">{formatJson(firstFailure.args)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 text-zinc-500">期望</dt>
                    <dd className="min-w-0 break-all text-emerald-200">{formatJson(firstFailure.expected)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 text-zinc-500">实际</dt>
                    <dd className="min-w-0 break-all text-zinc-300">{formatJson(firstFailure.actual)}</dd>
                  </div>
                </dl>
                {firstFailure.error && (
                  <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/30 p-2 text-[10.5px] leading-5 text-rose-300">
                    {firstFailure.error}
                  </pre>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-400">这次没有拿到有效用例结果，检查代码后重新运行。</p>
            )}

            {result.results.length > 1 && (
              <details className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] text-zinc-400">
                <summary className="cursor-pointer">展开全部 {result.results.length} 个用例</summary>
                <div className="mt-1.5 space-y-2">
                  {result.results.map((c, i) => (
                    <div key={i} className="rounded-md border border-white/8 bg-black/20 p-2">
                      <p className="text-zinc-500">用例 {i + 1} · {c.status} · {c.ms}ms</p>
                      <p className="mt-1 break-all">输入：<code className="text-cyan-200">{formatJson(c.args)}</code></p>
                      <p className="break-all">期望：<code className="text-emerald-200">{formatJson(c.expected)}</code></p>
                      <p className="break-all">实际：<code className="text-zinc-300">{formatJson(c.actual)}</code></p>
                      {c.error && (
                        <pre className="mt-1 whitespace-pre-wrap break-all text-rose-300">{c.error}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {result.explain && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-300">{result.explain}</p>
            )}
            <p className="mt-2 text-[10.5px] text-zinc-500">修改代码后再次运行；本轮通过后进入下一轮。</p>
          </div>
        )}

        {sessionDone && (
          <div className="rounded-xl border border-violet-400/30 bg-violet-400/[0.07] p-4">
            <div className="flex items-center gap-1.5 text-violet-200">
              <Trophy size={15} />
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-violet-300/80">冲刺结算</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-50">5 轮完成</p>
            <p className="mt-0.5 text-[11.5px] text-zinc-400">
              每轮随机 {SAMPLE_SIZE} 个用例，5 轮全部通过后结算。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2">
                <p className="flex items-center gap-1 text-[9.5px] text-emerald-200/70">
                  <Flame size={10} /> 连续 AC
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-200">
                  {streak}<span className="text-[11px] font-normal text-zinc-500"> 次</span>
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2">
                <p className="flex items-center gap-1 text-[9.5px] text-amber-200/70">
                  <Trophy size={10} /> 最佳本轮
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-200">
                  {bestMs == null ? '—' : formatSpan(bestMs)}
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-[10.5px] tabular-nums text-zinc-500">
              总计时 {formatClock(totalSec)} · 最后一轮 {formatSpan(result?.latencyMs ?? 0)}
            </p>
            <button
              type="button"
              onClick={restart}
              className="grad-btn mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold text-white"
            >
              <RotateCcw size={13} /> 再来 5 轮
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
