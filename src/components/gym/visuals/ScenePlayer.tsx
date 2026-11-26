'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Eye, Lightbulb } from 'lucide-react';

export interface Scene {
  title: string;
  note: string;
  body: ReactNode;
  state?: { label: string; value: string }[];
  question?: { prompt: string; options: string[]; answer: number; explain: string };
}

export default function ScenePlayer({ scenes }: { scenes: Scene[] }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const scene = scenes[i];
  const last = i === scenes.length - 1;
  const needsAnswer = Boolean(scene.question) && picked === null && !skipped;
  const isRight = picked !== null && picked === scene.question?.answer;

  function go(next: number) {
    setI(Math.max(0, Math.min(scenes.length - 1, next)));
    setPicked(null);
    setSkipped(false);
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] text-violet-200">
          <Eye size={10} /> 第 {i + 1} / {scenes.length} 幕
        </span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-100">{scene.title}</p>
      </div>

      <p className="text-[11.5px] leading-relaxed text-zinc-400">{scene.note}</p>

      <div className="rounded-2xl border border-white/8 bg-[#0b0b13] p-3">{scene.body}</div>

      {scene.state && scene.state.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {scene.state.map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1 text-[10.5px]">
              <span className="text-zinc-500">{s.label}</span>
              <code className="font-mono text-cyan-200">{s.value}</code>
            </div>
          ))}
        </div>
      )}

      {scene.question && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-amber-100">
            <Lightbulb size={12} className="text-amber-300" /> 先预测：{scene.question.prompt}
          </p>
          <div className="mt-2 grid gap-1.5">
            {scene.question.options.map((option, idx) => {
              const chosen = picked === idx;
              const correct = picked !== null && idx === scene.question!.answer;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { if (picked === null) setPicked(idx); }}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                    correct ? 'border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-100'
                      : chosen ? 'border-rose-400/40 bg-rose-400/[0.08] text-rose-100'
                        : 'border-white/10 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className={`mt-2 text-[11px] leading-relaxed ${isRight ? 'text-emerald-200' : 'text-amber-200/90'}`}>
              {isRight ? '✓ 对了。' : '✗ 不对。'} {scene.question.explain}
            </p>
          )}
          {picked === null && !skipped && (
            <button type="button" onClick={() => setSkipped(true)} className="mt-2 text-[10px] text-zinc-500 underline">
              先跳过，直接看下一步
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="flex items-center gap-1 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-zinc-400 disabled:opacity-30">
          <ChevronLeft size={12} /> 上一幕
        </button>
        <div className="flex flex-1 justify-center gap-1">
          {scenes.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => go(idx)}
              disabled={needsAnswer && idx !== i}
              aria-label={`第 ${idx + 1} 幕`}
              aria-current={idx === i ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-all disabled:opacity-40 ${idx === i ? 'w-4 bg-violet-400' : 'w-1.5 bg-white/15'}`}
            />
          ))}
        </div>
        {last ? (
          <span className="px-2 text-[10px] text-zinc-600">已到最后一幕</span>
        ) : (
          <button
            type="button"
            onClick={() => go(i + 1)}
            disabled={needsAnswer}
            className="flex items-center gap-1 rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-30"
          >
            下一幕 <ChevronRight size={12} />
          </button>
        )}
      </div>
      {needsAnswer && <p className="text-center text-[10px] text-zinc-600">先选一个预测，再继续。</p>}
    </div>
  );
}
