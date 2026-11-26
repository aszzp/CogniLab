'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Code2, Flag, Loader2, RotateCcw, Sparkles, Timer, XCircle } from 'lucide-react';
import DrillCard from './DrillCard';
import type { GymDrill, GymProgress } from '@/lib/gym/types';

export interface DrillEntry {
  itemKey: string;
  drillId: string;
  itemTitle: string;
  kind: 'pattern' | 'idiom';
  drill: GymDrill;
}

function formatSeconds(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function GymDrillSession({
  entries, pythonLabel, onProgress, finishHref, finishLabel,
}: {
  entries: DrillEntry[];
  pythonLabel: string;
  onProgress?: (progress: GymProgress) => void;
  finishHref: string;
  finishLabel: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<Map<string, boolean>>(new Map());
  const [review, setReview] = useState({ loading: false, text: '', error: '' });
  const [elapsed, setElapsed] = useState(0);
  const [finishedElapsed, setFinishedElapsed] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const done = idx >= entries.length;
  const current = entries[idx];
  const correctCount = useMemo(() => [...results.values()].filter(Boolean).length, [results]);
  const wrong = entries.filter((e) => results.get(e.drillId) === false);
  const samePattern = entries.length > 0 && entries.every((e) => e.kind === 'pattern' && e.itemKey === entries[0].itemKey);

  function handleDone(correct: boolean, progress: GymProgress) {
    setResults((prev) => new Map(prev).set(current.drillId, correct));
    onProgress?.(progress);
  }

  function next() {
    if (idx + 1 >= entries.length) setFinishedElapsed(elapsed);
    setIdx((i) => Math.min(entries.length, i + 1));
  }

  function restart() {
    setIdx(0);
    setRound((r) => r + 1);
    setResults(new Map());
    setReview({ loading: false, text: '', error: '' });
    setElapsed(0);
    setFinishedElapsed(null);
  }

  function jumpTo(drillId: string) {
    const at = entries.findIndex((e) => e.drillId === drillId);
    if (at < 0) return;
    setIdx(at);
    setRound((r) => r + 1);
    setReview({ loading: false, text: '', error: '' });
    setElapsed(0);
    setFinishedElapsed(null);
  }

  async function aiReview() {
    setReview({ loading: true, text: '', error: '' });
    try {
      const res = await fetch('/api/gym/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'summary',
          itemKey: entries[0].itemKey,
          title: samePattern ? entries[0].itemTitle : '今日速练',
          results: entries.map((e) => ({
            drillId: e.drillId, prompt: e.drill.prompt, correct: results.get(e.drillId) ?? false,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI 复盘失败');
      setReview({ loading: false, text: String(data.feedback ?? ''), error: '' });
    } catch (e) {
      setReview({ loading: false, text: '', error: String(e) });
    }
  }

  function finish() {
    router.push(finishHref);
    router.refresh();
  }

  if (!entries.length) {
    return <div className="card p-6 text-center text-sm text-zinc-500">这一轮没有题目，先去道场学一张卡。</div>;
  }

  if (done) {
    const percent = Math.round((correctCount / entries.length) * 100);
    return (
      <div className="space-y-3">
        <div className="card p-5 text-center">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">本轮完成</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-50">
            {correctCount}<span className="text-base font-normal text-zinc-500"> / {entries.length}</span>
          </p>
          <p className={`mt-1 text-[12px] ${percent >= 80 ? 'text-emerald-300' : percent >= 60 ? 'text-amber-300' : 'text-rose-300'}`}>
            {percent >= 80 ? '手感不错，下一轮可以提速。' : percent >= 60 ? '基本成型，重点补错题里的边界。' : '先回到卡片，把三个坑再看一遍。'}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-zinc-500">
            <Timer size={11} /> 本轮用时 {formatSeconds(finishedElapsed ?? elapsed)}
          </p>
        </div>

        {wrong.length > 0 && (
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-rose-200"><XCircle size={13} /> 需要回看的题</p>
            <div className="mt-2 space-y-1.5">
              {wrong.map((e) => (
                <button
                  key={e.drillId}
                  type="button"
                  onClick={() => jumpTo(e.drillId)}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2 text-left text-[11.5px] text-zinc-400 hover:border-white/20"
                >
                  <span className="shrink-0 text-[10px] text-zinc-600">{e.itemTitle}</span>
                  <span className="min-w-0 flex-1 truncate">{e.drill.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card border-cyan-400/25 bg-cyan-400/[0.04] p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={aiReview} disabled={review.loading} className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-1.5 text-[11.5px] text-cyan-200 hover:bg-cyan-400/[0.1] disabled:opacity-50">
              {review.loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI 复盘本轮
            </button>
            <span className="text-[10px] text-zinc-500">看错题，给出下一轮的两个动作</span>
          </div>
          {review.error && <p className="mt-2 text-[11.5px] leading-relaxed text-rose-200">{review.error}</p>}
          {review.text && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">{review.text}</p>}
        </div>

        {samePattern && (
          <Link href="/finals/code" className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] py-2.5 text-[12px] text-cyan-200 hover:bg-cyan-400/[0.1]">
            <Code2 size={13} /> 去决赛题库练同主题的 5 道变式
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={restart} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/12 py-2.5 text-[12px] text-zinc-300 hover:bg-white/[0.05]">
            <RotateCcw size={13} /> 再来一轮
          </button>
          <button type="button" onClick={finish} className="grad-btn flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold text-white">
            <Flag size={13} /> {finishLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={finish} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={12} /> 退出
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11.5px] font-medium text-zinc-300">{current.itemTitle}</p>
            <p className="shrink-0 text-[10.5px] tabular-nums text-zinc-500">{idx + 1} / {entries.length}</p>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all" style={{ width: `${((idx) / entries.length) * 100}%` }} />
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-zinc-500">
          <Timer size={10} /> {formatSeconds(elapsed)}
        </span>
        <span className="hidden shrink-0 text-[10px] text-zinc-600 sm:block">
          <CheckCircle2 size={11} className="mr-0.5 inline text-emerald-400" />{correctCount} 对
          <span className="ml-1.5 text-zinc-600">{pythonLabel}</span>
        </span>
      </div>

      <DrillCard
        key={`${current.drillId}-${round}`}
        entry={current}
        onDone={handleDone}
        onNext={next}
        isLast={idx === entries.length - 1}
      />
    </div>
  );
}
