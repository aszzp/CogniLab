'use client';

import { useState } from 'react';
import { ArrowDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { GymDemo } from '@/lib/gym/types';

export default function IdiomDemo({ demo }: { demo?: GymDemo }) {
  const [revealed, setRevealed] = useState(0);
  if (!demo) {
    return <div className="card p-4 text-sm text-zinc-500">这个惯用法还没有演示数据。</div>;
  }
  const total = demo.steps.length;
  const done = revealed >= total;

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{demo.inputLabel}</p>
        <pre className="code-area mt-1 overflow-x-auto rounded-lg border border-white/8 bg-[#0c0c14] p-2.5 text-[11px] text-zinc-300">{demo.input}</pre>
      </div>

      <div className="space-y-1.5">
        {demo.steps.map((step, i) => (
          <div key={i} className={`transition-opacity ${i < revealed ? 'opacity-100' : 'opacity-25'}`}>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <ArrowDown size={10} /> {step.label}
            </div>
            <div className="mt-0.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-cyan-200">
              {i < revealed ? step.value : '???'}
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border px-3 py-2 transition-colors ${done ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-white/8 bg-white/[0.02]'}`}>
        <p className="text-[9.5px] uppercase tracking-wider text-zinc-500">输出</p>
        <p className={`mt-0.5 font-mono text-[11.5px] ${done ? 'text-emerald-200' : 'text-zinc-600'}`}>{done ? demo.output : '继续下一步…'}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRevealed((n) => Math.min(total, n + 1))}
          disabled={done}
          className="flex items-center gap-1 rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-30"
        >
          下一步 <ChevronRight size={12} />
        </button>
        <button
          type="button"
          onClick={() => setRevealed(0)}
          className="flex items-center gap-1 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-white/[0.05]"
        >
          <RotateCcw size={11} /> 重置
        </button>
        <span className="ml-auto text-[10px] tabular-nums text-zinc-600">{revealed}/{total}</span>
      </div>
    </div>
  );
}
