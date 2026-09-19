'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X, ChevronLeft, ChevronRight, Flag, Home } from 'lucide-react';
import AIExplain from './AIExplain';
import type { Question } from '@/lib/types';

interface Result {
  correct: boolean;
  picked: string;
  timeMs: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const norm = (s: string) => String(s || '').split('').sort().join('');

export default function QuestionSession({
  questions,
  mode,
  title,
}: {
  questions: Question[];
  mode: string;
  title: string;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [finished, setFinished] = useState(false);
  const tRef = useRef(Date.now());
  const q = questions[idx];

  const done = useMemo(() => Object.keys(results).length, [results]);
  const correctCount = useMemo(
    () => Object.values(results).filter((r) => r.correct).length,
    [results],
  );

  function judge(ans: string) {
    if (locked) return;
    const correct = norm(ans) === norm(q.answer);
    const timeMs = Date.now() - tRef.current;
    setResults((r) => ({ ...r, [q.id]: { correct, picked: ans, timeMs } }));
    setLocked(true);
    fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: q.id,
        user_answer: ans,
        time_ms: timeMs,
        mode,
      }),
    }).catch(() => {});
  }

  function toggle(opt: string) {
    if (locked) return;
    setPicked((p) => (p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]));
  }

  function next() {
    if (idx + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setPicked([]);
    setLocked(false);
    tRef.current = Date.now();
  }

  function prev() {
    if (idx === 0) return;
    setIdx(idx - 1);
    const r = results[questions[idx - 1].id];
    setPicked(r ? r.picked.split('') : []);
    setLocked(!!r);
  }

  const result = results[q.id];

  /* ---------- 总结页 ---------- */
  if (finished) {
    const wrong = questions.filter((x) => results[x.id] && !results[x.id].correct);
    const totalMs = Object.values(results).reduce((a, b) => a + b.timeMs, 0);
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="fade-up space-y-5">
        <div className="card p-6 text-center">
          <p className="text-sm text-zinc-400">{title} · 完成</p>
          <p className="mt-2 text-5xl font-bold grad-text">{pct}%</p>
          <p className="mt-2 text-sm text-zinc-400">
            答对 {correctCount} / {questions.length} 题 · 用时 {Math.round(totalMs / 1000)} 秒
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/" className="flex-1 rounded-xl border border-white/10 py-2.5 text-center text-sm text-zinc-300">
              返回首页
            </Link>
            <Link href="/practice" className="grad-btn flex-1 rounded-xl py-2.5 text-center text-sm font-medium text-white">
              继续刷题
            </Link>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-rose-300">
              <Flag size={14} /> 错题回顾（已加入复习计划）
            </p>
            <div className="space-y-2">
              {wrong.map((w) => (
                <div key={w.id} className="rounded-xl bg-white/[0.03] p-3 text-[13px]">
                  <p className="text-zinc-300">{w.stem}</p>
                  <p className="mt-1.5 text-rose-400">
                    你的答案 {results[w.id].picked || '—'}
                    <span className="ml-3 text-emerald-400">正确 {w.answer}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- 答题页 ---------- */
  const isJudge = q.type === 'judge';
  return (
    <div className="fade-up space-y-4" key={q.id}>
      {/* 进度 */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {title} · 第 <span className="font-semibold text-zinc-300">{idx + 1}</span> / {questions.length} 题
          </span>
          <span>已答 {done}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${(done / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 题干 */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-300">{q.module}</span>
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-zinc-400">
            {isJudge ? '判断' : q.type === 'multi' ? '多选' : '单选'}
          </span>
          <span className="ml-auto text-zinc-600">{q.source}</span>
        </div>
        <p className="text-[15.5px] leading-relaxed text-zinc-100">{q.stem}</p>
      </div>

      {/* 选项 */}
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const L = LETTERS[i];
          const isPicked = isJudge ? picked.includes(L) : picked.includes(L);
          const isRight = locked && q.answer.includes(L);
          const isWrongPick = locked && isPicked && !q.answer.includes(L);
          return (
            <button
              key={i}
              onClick={() => (q.type === 'multi' ? toggle(L) : judge(L))}
              disabled={locked}
              className={[
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-[14.5px] leading-relaxed transition-all',
                isRight
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100'
                  : isWrongPick
                    ? 'border-rose-400/50 bg-rose-400/10 text-rose-100'
                    : isPicked
                      ? 'border-violet-400/60 bg-violet-500/10 text-zinc-100'
                      : 'border-white/10 bg-white/[0.03] text-zinc-300 active:scale-[0.99] disabled:opacity-70',
              ].join(' ')}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  isRight
                    ? 'border-emerald-400 bg-emerald-400/20'
                    : isWrongPick
                      ? 'border-rose-400 bg-rose-400/20'
                      : isPicked
                        ? 'border-violet-400 bg-violet-500/20'
                        : 'border-white/20'
                }`}
              >
                {isRight ? <Check size={13} /> : isWrongPick ? <X size={13} /> : isJudge ? '' : L}
              </span>
              <span className="flex-1">{isJudge ? opt : opt}</span>
            </button>
          );
        })}
      </div>

      {/* 多选确认 */}
      {q.type === 'multi' && !locked && (
        <button
          onClick={() => judge(picked.slice().sort().join(''))}
          disabled={picked.length === 0}
          className="grad-btn w-full rounded-xl py-3 text-[15px] font-semibold text-white"
        >
          确认答案（已选 {picked.length} 项）
        </button>
      )}

      {/* 判分反馈 */}
      {locked && (
        <div className="fade-up">
          <div
            className={`card p-4 ${result?.correct ? 'border-emerald-400/30' : 'border-rose-400/30'}`}
          >
            <p className={`flex items-center gap-2 text-sm font-semibold ${result?.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
              {result?.correct ? <Check size={16} /> : <X size={16} />}
              {result?.correct ? '回答正确' : `回答错误 · 正确答案 ${q.answer}`}
            </p>
            {q.explanation && (
              <p className="mt-2 whitespace-pre-wrap border-l-2 border-white/15 pl-3 text-[13px] leading-relaxed text-zinc-400">
                {q.explanation}
              </p>
            )}
          </div>
          <AIExplain question={q} />
        </div>
      )}

      {/* 底部导航 */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 disabled:opacity-30"
        >
          <ChevronLeft size={15} /> 上一题
        </button>
        <button
          onClick={next}
          className="grad-btn flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold text-white"
        >
          {idx + 1 >= questions.length ? (
            <>
              完成训练 <Home size={15} />
            </>
          ) : (
            <>
              下一题 <ChevronRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
