'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Brain, CheckCircle2, ChevronRight, Code2, Dumbbell, Flame, Keyboard, Play, Timer, Zap,
} from 'lucide-react';
import type { GymListItem } from '@/lib/gym/content';
import type { GymProgress } from '@/lib/gym/types';

type Filter = 'all' | 'pattern' | 'idiom' | 'review';
type Status = 'new' | 'due' | 'learning' | 'mastered';

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  new: { label: '未学', cls: 'border-white/10 bg-white/[0.03] text-zinc-500' },
  due: { label: '待复习', cls: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200' },
  learning: { label: '复习中', cls: 'border-violet-400/25 bg-violet-400/[0.08] text-violet-200' },
  mastered: { label: '已掌握', cls: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200' },
};

function statusOf(progress: GymProgress | undefined, now: number): Status {
  if (!progress) return 'new';
  if (!progress.nextReviewAt || new Date(progress.nextReviewAt).getTime() <= now) return 'due';
  if (progress.mastery >= 4) return 'mastered';
  return 'learning';
}

function MasteryBar({ value }: { value: number }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-5 rounded-full ${n <= value ? 'bg-gradient-to-r from-violet-400 to-cyan-400' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <span className="text-[10px] tabular-nums text-zinc-600">{value}/5</span>
    </div>
  );
}

export default function GymList({
  items, progress, due, mastered, totalDrills, now,
}: {
  items: GymListItem[];
  progress: GymProgress[];
  due: number;
  mastered: number;
  totalDrills: number;
  now: number;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const byKey = useMemo(() => new Map(progress.map((p) => [p.itemKey, p])), [progress]);

  const filtered = items.filter((item) => {
    if (filter === 'pattern') return item.kind === 'pattern';
    if (filter === 'idiom') return item.kind === 'idiom';
    if (filter === 'review') {
      const p = byKey.get(item.key);
      return !p || p.mastery < 4 || !p.nextReviewAt || new Date(p.nextReviewAt).getTime() <= now;
    }
    return true;
  });
  const patterns = filtered.filter((i) => i.kind === 'pattern');
  const idioms = filtered.filter((i) => i.kind === 'idiom');

  return (
    <div className="fade-up space-y-4">
      <div className="flex items-start gap-3 pt-1">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 text-violet-200">
          <Dumbbell size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold">实操道场</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            7 个业务模板 + 10 个函数惯用法。先看懂一张卡，再用可视化走一遍、逐行速写、代码冲刺和 AI 点评练到条件反射。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="flex items-center gap-1 text-[10.5px] text-zinc-500"><Flame size={12} className="text-amber-300" /> 待练</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-200">{due}</p>
        </div>
        <div className="card p-3">
          <p className="flex items-center gap-1 text-[10.5px] text-zinc-500"><CheckCircle2 size={12} className="text-emerald-300" /> 已掌握</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-200">{mastered}</p>
        </div>
        <div className="card p-3">
          <p className="flex items-center gap-1 text-[10.5px] text-zinc-500"><Brain size={12} className="text-violet-300" /> 练习题</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-violet-200">{totalDrills}</p>
        </div>
      </div>

      <Link
        href="/gym/quick"
        className="card flex items-center gap-3 border-violet-400/25 bg-violet-400/[0.06] p-4 transition-colors hover:border-violet-400/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
          <Play size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-100">今日速练 · 10 题</span>
          <span className="block text-[11.5px] text-zinc-500">按到期和薄弱程度混合出题，约 5 分钟</span>
        </span>
        <ArrowRight size={16} className="text-violet-300" />
      </Link>

      <Link
        href="/gym/p1-critical-path?tab=sprint"
        className="card flex items-center gap-3 border-cyan-400/25 bg-cyan-400/[0.05] p-4 transition-colors hover:border-cyan-400/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
          <Zap size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            代码冲刺 · 关键路径 <span className="rounded-full border border-cyan-400/25 px-1.5 py-0.5 text-[9px] font-normal text-cyan-200">NEW</span>
          </span>
          <span className="block text-[11.5px] text-zinc-500">从零写 → 计时 → 连续 AC；每轮随机抽 3 个用例</span>
        </span>
        <Code2 size={16} className="text-cyan-300" />
      </Link>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs">
        {([
          ['all', '全部'],
          ['pattern', '七式'],
          ['idiom', '惯用法'],
          ['review', `待练${due ? ` ${due}` : ''}`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`flex-1 whitespace-nowrap rounded-lg py-1.5 transition-colors ${
              filter === key ? 'bg-violet-500/25 font-medium text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {patterns.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-200">
              <Dumbbell size={14} className="text-violet-300" /> 七式实战
            </h2>
            <span className="text-[10.5px] text-zinc-600">对应决赛 51–57 题</span>
          </div>
          {patterns.map((item) => (
            <ItemRow key={item.key} item={item} progress={byKey.get(item.key)} now={now} />
          ))}
        </section>
      )}

      {idioms.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-200">
              <Brain size={14} className="text-cyan-300" /> 函数肌肉记忆
            </h2>
            <span className="text-[10.5px] text-zinc-600">一行一个动作</span>
          </div>
          {idioms.map((item) => (
            <ItemRow key={item.key} item={item} progress={byKey.get(item.key)} now={now} />
          ))}
        </section>
      )}

      {filtered.length === 0 && (
        <div className="card p-6 text-center text-sm text-zinc-500">这个筛选下没有条目。</div>
      )}
    </div>
  );
}

function ItemRow({ item, progress, now }: { item: GymListItem; progress?: GymProgress; now: number }) {
  const status = statusOf(progress, now);
  const meta = STATUS_META[status];
  return (
    <div className="card group flex items-stretch gap-1 p-0 transition-colors hover:border-white/20">
      <Link href={`/gym/${item.key}`} className="flex min-w-0 flex-1 gap-3 p-4 pr-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-[11px] font-semibold tabular-nums text-zinc-500">
          {String(item.order).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-zinc-100">{item.title}</span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] ${meta.cls}`}>{meta.label}</span>
          </span>
          <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-relaxed text-zinc-500">{item.subtitle}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-600">
            <span className="flex items-center gap-0.5"><Timer size={10} /> {item.minutes} 分钟</span>
            <span>· {item.drillCount} 道练习</span>
            {item.tags.slice(0, 3).map((tag) => <span key={tag}>· {tag}</span>)}
          </span>
          <MasteryBar value={progress?.mastery ?? 0} />
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 pr-3">
        {item.kind === 'pattern' && (
          <Link
            href={`/gym/${item.key}?tab=sprint`}
            className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[10.5px] text-cyan-200 transition-colors hover:border-cyan-400/40"
          >
            <Zap size={10} /> 冲刺
          </Link>
        )}
        <Link
          href={`/gym/${item.key}?tab=quick`}
          className="flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/[0.05] px-2.5 py-1.5 text-[10.5px] text-violet-200 transition-colors hover:border-violet-400/40"
        >
          <Keyboard size={10} /> 速写
        </Link>
        <Link
          href={`/gym/${item.key}?tab=practice`}
          className="flex items-center gap-1 rounded-full border border-white/12 px-2.5 py-1.5 text-[10.5px] text-zinc-400 transition-colors hover:border-violet-400/40 hover:text-violet-200"
        >
          练 <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}
