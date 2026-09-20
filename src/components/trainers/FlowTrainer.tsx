'use client';

import { useId, useState } from 'react';
import { CheckCircle2, XCircle, GitBranch } from 'lucide-react';
import type { Task } from '@/lib/types';

export default function FlowTrainer({ task }: { task: Task }) {
  return <FlowExercise key={task.id} task={task} />;
}

/** Render the actual graph, including negative branches, optional steps and bounded loops. */
function FlowExercise({ task }: { task: Task }) {
  const nodes = task.meta.nodes ?? [];
  const edges = task.meta.edges ?? [];
  const choices = task.meta.choices ?? [];
  const answers = task.meta.answers ?? [];
  const [selected, setSelected] = useState<string[]>(() => answers.map(() => ''));
  const [checked, setChecked] = useState(false);
  const prefix = useId();
  const anchor = (id: string) => `${prefix}-${id}`;
  const labelFor = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return id;
    return node.blank !== undefined ? `条件 ${node.blank + 1}` : node.label || node.id;
  };
  const correct = selected.filter((value, index) => value === answers[index]).length;
  const complete = selected.length > 0 && selected.every(Boolean);
  const labels = { start: '开始', end: '结束', action: '处理', judge: '判断' };

  if (!nodes.length || !answers.length) {
    return <p role="alert" className="card p-4 text-sm text-rose-300">该任务缺少流程节点或答案配置。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <GitBranch size={16} className="text-violet-300" /> 补全 {answers.length} 个判定条件
        </p>
        <p className="text-xs leading-6 text-zinc-400">
          按每个节点的真实分支阅读流程。分支可跳转、汇合或返回前面的节点，不按卡片排列顺序推断执行顺序。
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {nodes.map((node) => {
            const blank = node.blank;
            const outgoing = edges.filter(([from]) => from === node.id);
            const incoming = edges.filter(([, to]) => to === node.id);
            return (
              <section id={anchor(node.id)} key={node.id}
                className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                  <span className="rounded-md bg-violet-500/15 px-2 py-1 text-violet-200">{labels[node.kind]}</span>
                  <code className="break-all">{node.id}</code>
                </div>
                {blank !== undefined ? (
                  <div>
                    <label htmlFor={anchor(`select-${node.id}`)} className="mb-2 block text-sm text-zinc-200">
                      条件 {blank + 1}
                    </label>
                    <select id={anchor(`select-${node.id}`)} value={selected[blank] ?? ''}
                      className="w-full rounded-xl border border-violet-400/30 bg-[#12101e] px-3 py-3 text-sm text-violet-100"
                      onChange={(event) => {
                        setSelected((previous) => previous.map((value, index) => index === blank ? event.target.value : value));
                        setChecked(false);
                      }}>
                      <option value="">选择判定条件…</option>
                      {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </select>
                    {checked && (
                      <p className={`mt-2 flex items-start gap-1 text-xs ${selected[blank] === answers[blank] ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {selected[blank] === answers[blank]
                          ? <><CheckCircle2 size={14} className="shrink-0" /> 正确</>
                          : <><XCircle size={14} className="shrink-0" /> 参考条件：{answers[blank]}</>}
                      </p>
                    )}
                  </div>
                ) : <p className="text-sm leading-6 text-zinc-200">{node.label}</p>}
                {incoming.length > 0 && (
                  <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                    来自：{incoming.map(([from, , branch]) => `${labelFor(from)}${branch ? `（${branch}）` : ''}`).join('、')}
                  </p>
                )}
                <div className="mt-3 space-y-1.5">
                  {outgoing.map(([, to, branch], index) => (
                    <a key={`${to}-${index}`} href={`#${anchor(to)}`}
                      className="block rounded-lg bg-white/[0.04] px-2.5 py-2 text-xs text-cyan-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-cyan-300">
                      {branch || '下一步'} → {labelFor(to)} <span className="text-zinc-500">({to})</span>
                    </a>
                  ))}
                  {!outgoing.length && <p className="text-xs text-zinc-500">此路径结束。</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <button type="button" disabled={!complete} onClick={() => setChecked(true)}
        className="grad-btn w-full rounded-xl py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
        检查全部条件
      </button>
      {checked && (
        <div role="status" className="card space-y-3 p-4 text-sm text-zinc-300">
          <p>正确 {correct} / {answers.length} 项；训练得分 {((correct / answers.length) * task.points).toFixed(1)} / {task.points}。</p>
          <p className="text-xs text-zinc-500">本页检查所填条件，不代表完整流程设计能力或官方评分。</p>
          {task.meta.referenceAnswer && (
            <details><summary className="cursor-pointer text-violet-200">查看参考分析</summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{task.meta.referenceAnswer}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
