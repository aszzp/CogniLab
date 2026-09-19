'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Grid3x3, Send, Check, X } from 'lucide-react';
import AIExplain from './AIExplain';
import type { Question } from '@/lib/types';

interface PerResult {
  id: number; module: string; stem: string; userAnswer: string;
  answer: string; explanation: string; correct: boolean;
}
interface SubmitResult {
  score: number; total: number; correct: number;
  byModule: Record<string, { c: number; n: number }>;
  per: PerResult[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PLAN_SEC: Record<string, number> = { sample45: 5400, quick20: 2400, sprint10: 900 };

export default function ExamRunner({
  examId, mode, questions,
}: {
  examId: number; mode: string; questions: Question[];
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(PLAN_SEC[mode] ?? 2400);
  const submittedRef = useRef(false);

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    setPicked(answers[q?.id] ? answers[q.id].split('') : []);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  function record(ans: string) {
    setAnswers((a) => ({ ...a, [q.id]: ans }));
    setPicked(ans.split(''));
  }
  function toggle(opt: string) {
    const next = picked.includes(opt) ? picked.filter((x) => x !== opt) : [...picked, opt];
    setPicked(next);
    setAnswers((a) => ({ ...a, [q.id]: next.slice().sort().join('') }));
  }

  async function submit(auto = false) {
    if (submittedRef.current) return;
    if (!auto && !confirming) {
      setConfirming(true);
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    setConfirming(false);
    try {
      const res = await fetch(`/api/exam/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, durationSec: (PLAN_SEC[mode] ?? 2400) - timeLeft }),
      });
      setResult(await res.json());
    } finally {
      setSubmitting(false);
    }
  }

  const mmss = useMemo(() => {
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [timeLeft]);

  /* ---------- 结果页 ---------- */
  if (result) {
    const pass = result.score >= 60;
    return (
      <div className="fade-up space-y-4">
        <div className="card relative overflow-hidden p-6 text-center">
          <div className={`pointer-events-none absolute -top-14 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl ${pass ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
          <p className="text-xs text-zinc-400">{auto0(result.score)}模拟考成绩</p>
          <p className={`mt-1 text-6xl font-bold ${pass ? 'text-emerald-300' : 'text-rose-300'}`}>{result.score}</p>
          <p className="mt-1 text-sm text-zinc-400">
            答对 {result.correct} / {result.total} · {pass ? '恭喜及格 🎉' : '继续加油，重点补弱项'}
          </p>
        </div>

        <div className="card p-5">
          <p className="mb-3 text-sm font-semibold">模块分布</p>
          <div className="space-y-2.5">
            {Object.entries(result.byModule).map(([mod, v]) => {
              const pct = Math.round((v.c / v.n) * 100);
              return (
                <div key={mod} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 text-zinc-300">{mod}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={`h-full rounded-full ${pct >= 60 ? 'bg-gradient-to-r from-violet-500 to-cyan-400' : 'bg-gradient-to-r from-amber-500 to-rose-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-zinc-500">{v.c}/{v.n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">逐题回顾</p>
          {result.per.map((p, i) => (
            <div key={p.id} className={`card p-4 ${p.correct ? '' : 'border-rose-400/25'}`}>
              <div className="flex items-start gap-2">
                {p.correct
                  ? <Check size={15} className="mt-1 shrink-0 text-emerald-400" />
                  : <X size={15} className="mt-1 shrink-0 text-rose-400" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] leading-relaxed text-zinc-200">
                    <span className="mr-1 text-zinc-500">{i + 1}.</span>{p.stem}
                  </p>
                  <p className="mt-1.5 text-xs">
                    <span className="text-rose-300">你的答案 {p.userAnswer || '—'}</span>
                    <span className="ml-3 text-emerald-300">正确 {p.answer}</span>
                  </p>
                  {p.explanation && (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">{p.explanation}</p>
                  )}
                  <AIExplain question={{
                    id: p.id, type: 'single', module: p.module, stem: p.stem,
                    options: [], answer: p.answer, explanation: p.explanation, difficulty: 2, source: '考试回顾',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- 答题页 ---------- */
  return (
    <div className="fade-up space-y-4">
      {/* 计时 & 进度 */}
      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-[11px] text-zinc-500">第 {idx + 1} / {questions.length} 题 · 已答 {answeredCount}</p>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono text-2xl font-bold tabular-nums ${timeLeft < 300 ? 'pulse-soft text-rose-300' : 'text-cyan-300'}`}>
            {mmss}
          </p>
          <button onClick={() => setShowSheet(true)} className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
            <Grid3x3 size={12} /> 答题卡
          </button>
        </div>
      </div>

      {/* 题干 */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-300">{q.module}</span>
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-zinc-400">
            {q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '单选'}
          </span>
        </div>
        <p className="text-[15.5px] leading-relaxed text-zinc-100">{q.stem}</p>
      </div>

      {/* 选项（考试模式：不即时判分） */}
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const L = LETTERS[i];
          const on = picked.includes(L);
          return (
            <button
              key={i}
              onClick={() => (q.type === 'multi' ? toggle(L) : record(L))}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-[14.5px] leading-relaxed transition-all active:scale-[0.99] ${
                on
                  ? 'border-violet-400/60 bg-violet-500/10 text-zinc-100'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300'
              }`}
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${on ? 'border-violet-400 bg-violet-500/25' : 'border-white/20'}`}>
                {L}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 disabled:opacity-30">
          <ChevronLeft size={15} /> 上一题
        </button>
        {idx + 1 < questions.length ? (
          <button onClick={() => setIdx(idx + 1)}
            className="grad-btn flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold text-white">
            下一题 <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={() => submit(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white active:scale-[0.98]">
            <Send size={14} /> 交卷
          </button>
        )}
      </div>

      {/* 答题卡抽屉 */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setShowSheet(false)}>
          <div className="card mx-auto mb-4 w-full max-w-2xl rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm font-semibold">答题卡（已答 {answeredCount}/{questions.length}）</p>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  onClick={() => { setIdx(i); setShowSheet(false); }}
                  className={`flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                    i === idx
                      ? 'border-violet-400 bg-violet-500/25 text-white'
                      : answers[qq.id]
                        ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                        : 'border-white/12 bg-white/[0.03] text-zinc-500'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowSheet(false); submit(false); }}
              className="mt-5 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              交卷并查看成绩
            </button>
          </div>
        </div>
      )}

      {/* 交卷确认 */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div className="card w-full max-w-sm rounded-3xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-semibold">确认交卷？</p>
            <p className="mt-2 text-xs text-zinc-400">
              还有 {questions.length - answeredCount} 题未作答，剩余时间 {mmss}
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-white/12 py-2.5 text-sm text-zinc-300">
                继续答题
              </button>
              <button
                onClick={() => submit(true)}
                disabled={submitting}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? '判分中…' : '确认交卷'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function auto0(n: number) {
  return n >= 90 ? '🏆 ' : n >= 60 ? '✅ ' : '💪 ';
}
