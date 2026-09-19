'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, GitBranch } from 'lucide-react';
import type { Task } from '@/lib/types';

// 流程主干渲染顺序（依据 edges 的"是"主链）
const ORDER = ['start', 'j1', 'j2', 'a1', 'j3', 'a2', 'j4', 'a3', 'j5', 'a4', 'save', 'end'];

export default function FlowTrainer({ task }: { task: Task }) {
  const nodes = task.meta.nodes ?? [];
  const choices = task.meta.choices ?? [];
  const answers = task.meta.answers ?? [];
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const blankCount = answers.length;
  const [sel, setSel] = useState<string[]>(Array(blankCount).fill(''));
  const [checked, setChecked] = useState(false);

  const selCls =
    'mt-1.5 w-full rounded-xl border border-violet-400/40 bg-[#12101e] px-3 py-2.5 text-[13px] text-violet-200 focus:border-violet-400 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <GitBranch size={13} className="text-violet-300" /> 补全 ①~⑤ 判定条件，构成最优采集流程
        </p>
        <div className="mx-auto flex max-w-sm flex-col items-center">
          {ORDER.map((id, i) => {
            const n = nodeMap.get(id);
            if (!n) return null;
            const prev = nodeMap.get(ORDER[i - 1]);
            const arrowLabel =
              prev?.kind === 'judge' && prev.id !== 'j1' ? '是' : prev?.kind === 'judge' ? '是' : undefined;
            return (
              <div key={id} className="flex w-full flex-col items-center">
                {i > 0 && (
                  <div className="flex flex-col items-center py-1">
                    <span className={`text-[10px] ${arrowLabel ? 'text-emerald-400' : 'text-zinc-600'}`}>{arrowLabel ?? ''}</span>
                    <span className="text-zinc-600">↓</span>
                  </div>
                )}
                {n.kind === 'judge' ? (
                  <div className="relative w-full">
                    <div className="mx-auto w-fit rounded-2xl border border-violet-400/40 bg-violet-500/10 px-4 py-3">
                      <p className="text-[10px] font-semibold text-violet-300">判定 ①{'ABCDE'[n.blank ?? 0]}</p>
                      <select
                        className={selCls}
                        value={sel[n.blank ?? 0]}
                        onChange={(e) => {
                          const next = [...sel];
                          next[n.blank ?? 0] = e.target.value;
                          setSel(next);
                        }}
                      >
                        <option value="">选择判定条件…</option>
                        {choices.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {checked && (n.blank ?? 0) < answers.length && (
                        <p className={`mt-1.5 flex items-center gap-1 text-[11px] ${sel[n.blank!] === answers[n.blank!] ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {sel[n.blank!] === answers[n.blank!]
                            ? <><CheckCircle2 size={11} /> 正确</>
                            : <><XCircle size={11} /> 应为：{answers[n.blank!]}</>}
                        </p>
                      )}
                    </div>
                    {/* 否分支 */}
                    <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-2 sm:block">
                      {n.id === 'j1' ? (
                        <span className="text-[10px] text-zinc-600">─否→ 暂不设置</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">─否→ 跳过此项</span>
                      )}
                    </div>
                  </div>
                ) : n.kind === 'action' ? (
                  <div className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-[13px] text-zinc-300">
                    {n.label}
                  </div>
                ) : (
                  <div
                    className={`rounded-full px-6 py-2 text-xs font-semibold ${
                      n.kind === 'start' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {n.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-zinc-600">
          首个判定若选"否" → 直接进入「暂不设置，直接体验」分支；其余判定选"否" → 跳过该项继续
        </p>
      </div>

      <button
        onClick={() => setChecked(true)}
        disabled={sel.some((s) => !s)}
        className="grad-btn w-full rounded-xl py-3 text-sm font-semibold text-white"
      >
        {sel.some((s) => !s) ? `还有 ${sel.filter((s) => !s).length} 处未选择` : '判分'}
      </button>

      {checked && (
        <div className="fade-up card p-4 text-center text-sm">
          正确 <span className="font-bold text-emerald-300">{sel.filter((s, i) => s === answers[i]).length}</span> / {blankCount} 处
          {sel.every((s, i) => s === answers[i]) && <span className="ml-2 text-emerald-300">🎉 最优流程达成！</span>}
        </div>
      )}
    </div>
  );
}
