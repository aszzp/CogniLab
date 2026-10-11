'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database, Code2, Sparkles, BarChart3, GitBranch, ChevronRight } from 'lucide-react';

const KIND_META: Record<string, { icon: typeof Database; label: string; cls: string }> = {
  sql: { icon: Database, label: 'SQL', cls: 'text-cyan-300 bg-cyan-400/12' },
  python: { icon: Code2, label: 'Python', cls: 'text-emerald-300 bg-emerald-400/12' },
  essay: { icon: Sparkles, label: '方案设计', cls: 'text-violet-300 bg-violet-400/12' },
  chart: { icon: BarChart3, label: '图表配置', cls: 'text-amber-300 bg-amber-400/12' },
  flow: { icon: GitBranch, label: '流程设计', cls: 'text-rose-300 bg-rose-400/12' },
};

export interface HandsOnTask {
  id: number;
  kind: string;
  title: string;
  category: string;
  points: number;
  source: string;
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs transition-colors ${
    on
      ? 'border-violet-400/60 bg-violet-500/15 text-violet-200'
      : 'border-white/12 text-zinc-500 hover:border-white/25 hover:text-zinc-300'
  }`;

export default function HandsOnList({ tasks }: { tasks: HandsOnTask[] }) {
  const [filter, setFilter] = useState<string>('all');
  const kinds = [...new Set(tasks.map((t) => t.kind))].filter((k) => KIND_META[k]);
  const shown = filter === 'all' ? tasks : tasks.filter((t) => t.kind === filter);

  return (
    <>
      {/* 题型过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('all')} className={chip(filter === 'all')}>
          全部 {tasks.length}
        </button>
        {kinds.map((k) => {
          const m = KIND_META[k];
          const n = tasks.filter((t) => t.kind === k).length;
          return (
            <button key={k} onClick={() => setFilter(k)} className={chip(filter === k)}>
              {m.label} {n}
            </button>
          );
        })}
        {filter !== 'all' && (
          <span className="ml-auto text-[11px] text-zinc-500">
            显示 {shown.length} / {tasks.length} 个任务
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map((t) => {
          const m = KIND_META[t.kind] ?? KIND_META.essay;
          const Icon = m.icon;
          return (
            <Link key={t.id} href={`/hands-on/${t.id}`} className="card flex items-center gap-3.5 p-4 transition-transform active:scale-[0.99]">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.cls}`}>
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[14.5px] font-semibold">{t.title}</p>
                  <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-zinc-400">{m.label}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {t.category} · {t.points} 分制 · {t.source}
                </p>
              </div>
              <ChevronRight size={17} className="shrink-0 text-zinc-500" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
