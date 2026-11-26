'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, ChevronRight, Code2, Lightbulb, Loader2, Play, RotateCcw, Sparkles, Terminal, XCircle,
} from 'lucide-react';
import CodeEditor from '@/components/trainers/CodeEditor';
import { normalizeFill } from '@/lib/gym/grade';
import { TRAP_LABEL, type GymDrill, type GymProgress } from '@/lib/gym/types';
import type { DrillEntry } from './GymDrillSession';

interface RunCase {
  status: string; ms: number; args?: unknown; expected?: unknown; actual?: unknown; error?: string; stdout?: string;
}
interface RunResult {
  passed: number; total: number; status: string; label: string; maxMs: number; maxMemMb: number; results: RunCase[];
}

const STATUS_DOT: Record<string, string> = {
  AC: 'bg-emerald-400', WA: 'bg-rose-400', TLE: 'bg-amber-400', MLE: 'bg-amber-400', RE: 'bg-rose-400', SE: 'bg-zinc-500',
};
const TYPE_LABEL: Record<GymDrill['type'], string> = { mcq: '单选', fill: '填空', code: '代码' };

function assemble(code: string, answers: string[]): string {
  const parts = code.split('___');
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) out += (answers[i - 1] ?? '') + parts[i];
  return out;
}

export default function DrillCard({
  entry, onDone, onNext, isLast,
}: {
  entry: DrillEntry;
  onDone: (correct: boolean, progress: GymProgress) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { drill } = entry;
  const blanks = drill.type === 'fill' || drill.type === 'code' ? drill.blanks : [];
  const [pick, setPick] = useState<number | null>(null);
  const [fills, setFills] = useState<string[]>(() => blanks.map(() => ''));
  const [mode, setMode] = useState<'blank' | 'free'>('blank');
  const [freeCode, setFreeCode] = useState(() => drill.type === 'code' ? drill.starter : '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; explain: string } | null>(null);
  const [codeResult, setCodeResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');
  const [ai, setAi] = useState({ open: false, loading: false, text: '', error: '' });
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const source = drill.type === 'fill' ? drill.code : drill.type === 'code' ? drill.starter : '';
  const segments = useMemo(() => source.split('___'), [source]);
  const codeSource = drill.type === 'code' ? (mode === 'free' ? freeCode : assemble(drill.starter, fills)) : '';

  function reset() {
    setPick(null);
    setFills(drill.type === 'fill' || drill.type === 'code' ? blanks.map(() => '') : []);
    setFeedback(null);
    setCodeResult(null);
    setError('');
    setAi({ open: false, loading: false, text: '', error: '' });
    if (drill.type === 'code') setFreeCode(drill.starter);
    startedAt.current = Date.now();
  }

  async function submitMcq() {
    if (pick === null || drill.type !== 'mcq') return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/gym/attempt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: entry.itemKey, drillId: drill.id, answer: pick,
          latencyMs: Date.now() - startedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '提交失败');
      setFeedback({ correct: Boolean(data.correct), explain: String(data.explain ?? '') });
      if (data.progress) onDone(Boolean(data.correct), data.progress);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitFill() {
    if (drill.type !== 'fill') return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/gym/attempt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: entry.itemKey, drillId: drill.id, answer: fills,
          latencyMs: Date.now() - startedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '提交失败');
      setFeedback({ correct: Boolean(data.correct), explain: String(data.explain ?? '') });
      if (data.progress) onDone(Boolean(data.correct), data.progress);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runCode() {
    if (drill.type !== 'code') return;
    if (mode === 'blank' && fills.some((v) => !v.trim())) {
      setError('还有空位没有填写。');
      return;
    }
    setBusy(true); setError(''); setCodeResult(null);
    try {
      const res = await fetch('/api/gym/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: entry.itemKey, drillId: drill.id, code: codeSource,
          latencyMs: Date.now() - startedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '判题失败');
      setCodeResult(data as RunResult);
      const correct = data.total > 0 && data.passed === data.total;
      setFeedback({ correct, explain: String(data.explain ?? '') });
      if (data.progress) onDone(correct, data.progress);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function askAI() {
    setAi({ open: true, loading: true, text: '', error: '' });
    try {
      const answer = drill.type === 'mcq' ? pick : drill.type === 'fill' ? fills : codeSource;
      const res = await fetch('/api/gym/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemKey: entry.itemKey, drillId: drill.id, answer,
          code: drill.type === 'code' ? codeSource : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI 点评失败');
      setAi({ open: true, loading: false, text: String(data.feedback ?? ''), error: '' });
    } catch (e) {
      setAi({ open: true, loading: false, text: '', error: String(e) });
    }
  }

  const answered = Boolean(feedback || codeResult);
  const blanksOk = drill.type === 'fill' || drill.type === 'code'
    ? blanks.map((b, i) => b.answers.some((a) => normalizeFill(a) === normalizeFill(fills[i] ?? '')))
    : [];

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] text-violet-200">
            <Code2 size={10} /> {TYPE_LABEL[drill.type]}
          </span>
          {drill.trap && (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] text-amber-200/90">
              考点：{TRAP_LABEL[drill.trap]}
            </span>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-zinc-600">{entry.itemTitle}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-200">{drill.prompt}</p>
        {drill.type !== 'code' && drill.type === 'mcq' && drill.code && (
          <pre className="code-area mt-2 overflow-x-auto rounded-xl border border-white/8 bg-[#0c0c14] p-3 text-[11.5px] leading-5 text-zinc-300">{drill.code}</pre>
        )}
      </div>

      {drill.type === 'mcq' && (
        <div className="space-y-2">
          {drill.options.map((option, i) => {
            const correct = feedback && i === drill.answer;
            const wrongPick = feedback && !feedback.correct && i === pick;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { if (!feedback) setPick(i); }}
                className={`card flex w-full items-start gap-2.5 p-3 text-left text-[12.5px] transition-colors ${
                  correct ? 'border-emerald-400/40 bg-emerald-400/[0.07]'
                    : wrongPick ? 'border-rose-400/40 bg-rose-400/[0.07]'
                      : pick === i ? 'border-violet-400/50 bg-violet-400/[0.08]'
                        : 'hover:border-white/20'
                }`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  pick === i ? 'border-violet-300 text-violet-200' : 'border-white/15 text-zinc-500'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="leading-relaxed text-zinc-300">{option}</span>
              </button>
            );
          })}
        </div>
      )}

      {(drill.type === 'fill' || drill.type === 'code') && (
        <div className="card space-y-2 p-4">
          {drill.type === 'code' && (
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1 text-[11px]">
              <button type="button" onClick={() => setMode('blank')} className={`rounded-md px-2 py-1 ${mode === 'blank' ? 'bg-violet-500/25 text-white' : 'text-zinc-500'}`}>填空</button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'blank') setFreeCode(assemble(drill.starter, fills));
                  setMode('free');
                }}
                className={`rounded-md px-2 py-1 ${mode === 'free' ? 'bg-violet-500/25 text-white' : 'text-zinc-500'}`}
              >
                自由编辑
              </button>
              <span className="ml-auto pr-1 text-[10px] text-zinc-600">{drill.fn}</span>
            </div>
          )}

          {drill.type === 'fill' || mode === 'blank' ? (
            <pre className="code-area overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/8 bg-[#0c0c14] p-3 text-[11.5px] leading-6 text-zinc-300">
              {segments.map((seg, i) => (
                <span key={i}>
                  {seg}
                  {i < blanks.length && (
                    <input
                      value={fills[i] ?? ''}
                      onChange={(e) => setFills((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                      disabled={Boolean(feedback)}
                      spellCheck={false}
                      aria-label={`空位 ${i + 1}`}
                      placeholder={blanks[i].hint ?? '…'}
                      style={{ width: `${blanks[i].width ?? 8}ch` }}
                      className={`mx-0.5 inline-block rounded border-b bg-white/[0.04] px-1 text-center font-mono text-[11.5px] leading-5 outline-none placeholder:text-zinc-700 disabled:opacity-80 ${
                        feedback
                          ? blanksOk[i] ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'
                          : 'border-cyan-400/40 text-cyan-200 focus:border-cyan-300'
                      }`}
                    />
                  )}
                </span>
              ))}
            </pre>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500">自由编辑代码（会直接提交整段代码）</p>
              <CodeEditor value={freeCode} onChange={setFreeCode} language="python" tabSize={4} autoIndent minHeight={260} />
            </div>
          )}

          {drill.type === 'code' && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={runCode} disabled={busy} className="grad-btn flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} 运行判题
              </button>
              <span className="text-[10.5px] text-zinc-500">{drill.cases.length} 个用例 · 5 秒 / 128MB</span>
            </div>
          )}
        </div>
      )}

      {error && <div className="card border-rose-400/30 bg-rose-400/[0.06] p-3 text-[11.5px] text-rose-200">{error}</div>}

      {feedback && (
        <div className={`card p-4 ${feedback.correct ? 'border-emerald-400/30 bg-emerald-400/[0.05]' : 'border-rose-400/30 bg-rose-400/[0.05]'}`}>
          <p className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${feedback.correct ? 'text-emerald-200' : 'text-rose-200'}`}>
            {feedback.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {feedback.correct ? '正确' : '再想一步'}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-300">{feedback.explain}</p>
          {codeResult && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                {codeResult.results.map((r, i) => (
                  <span key={i} title={`${r.status} · ${r.ms}ms`} className={`h-2.5 flex-1 rounded ${STATUS_DOT[r.status] ?? 'bg-zinc-500'}`} />
                ))}
              </div>
              <p className="text-[10.5px] text-zinc-500">
                通过 {codeResult.passed}/{codeResult.total} · 最慢 {codeResult.maxMs}ms · {codeResult.maxMemMb}MB
              </p>
              {codeResult.results.map((r, i) => (
                <details key={i} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] text-zinc-400">
                  <summary className="cursor-pointer">
                    用例 {i + 1} · {r.status} · {r.ms}ms
                  </summary>
                  <div className="mt-1 space-y-1">
                    <p>输入：<code className="break-all text-cyan-300">{JSON.stringify(r.args)}</code></p>
                    <p>期望：<code className="break-all text-emerald-300">{JSON.stringify(r.expected)}</code></p>
                    <p>实际：<code className="break-all text-zinc-300">{JSON.stringify(r.actual)}</code></p>
                    {r.error && <pre className="whitespace-pre-wrap text-rose-300">{r.error}</pre>}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {answered && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={askAI} disabled={ai.loading} className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-1.5 text-[11.5px] text-cyan-200 hover:bg-cyan-400/[0.1] disabled:opacity-50">
            {ai.loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI 教练点评
          </button>
          <button type="button" onClick={reset} className="flex items-center gap-1 rounded-full border border-white/12 px-3 py-1.5 text-[11.5px] text-zinc-400 hover:bg-white/[0.05]">
            <RotateCcw size={12} /> 重做
          </button>
          <button type="button" onClick={onNext} className="ml-auto flex items-center gap-1 rounded-full bg-violet-500 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-400">
            {isLast ? '完成本轮' : '下一题'} <ChevronRight size={13} />
          </button>
        </div>
      )}

      {ai.open && (
        <div className="card border-cyan-400/25 bg-cyan-400/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-cyan-200"><Sparkles size={13} /> AI 教练</p>
          {ai.loading && <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-zinc-500"><Loader2 size={12} className="animate-spin" /> 正在看你的答案…</p>}
          {ai.error && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-rose-200">
              {ai.error}
              {ai.error.includes('API Key') && <> · 去 <Link href="/me" className="underline">我的 → 模型配置</Link> 配一个</>}
            </p>
          )}
          {ai.text && <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">{ai.text}</p>}
        </div>
      )}

      {!answered && (
        <div className="flex items-center gap-2">
          {drill.type === 'mcq' && (
            <button type="button" onClick={submitMcq} disabled={pick === null || busy} className="grad-btn flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] font-semibold text-white disabled:opacity-45">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Lightbulb size={13} />} 提交答案
            </button>
          )}
          {drill.type === 'fill' && (
            <button type="button" onClick={submitFill} disabled={fills.some((v) => !v.trim()) || busy} className="grad-btn flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] font-semibold text-white disabled:opacity-45">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Terminal size={13} />} 检查填空
            </button>
          )}
          {drill.type === 'code' && mode === 'free' && (
            <p className="text-[10.5px] text-zinc-600">自由编辑模式：点上方「运行判题」提交。</p>
          )}
        </div>
      )}
    </div>
  );
}
