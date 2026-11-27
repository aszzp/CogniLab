'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Code2, Eye, Keyboard, Play, Timer, Trophy, Zap } from 'lucide-react';
import type { GymCode, GymItem, GymProgress } from '@/lib/gym/types';
import VisualPlayer from './VisualPlayer';
import GymDrillSession, { type DrillEntry } from './GymDrillSession';
import CodeSprint from './CodeSprint';
import QuickWrite from './QuickWrite';

type Tab = 'learn' | 'visual' | 'quick' | 'practice' | 'sprint';

const TAB_META: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: 'learn', label: '学习', icon: BookOpen },
  { key: 'visual', label: '可视化', icon: Eye },
  { key: 'quick', label: '速写', icon: Keyboard },
  { key: 'practice', label: '练习', icon: Code2 },
  { key: 'sprint', label: '冲刺', icon: Zap },
];

export default function GymItemView({
  item, progress, initialTab, pythonLabel,
}: {
  item: GymItem;
  progress: GymProgress | null;
  initialTab: Tab;
  pythonLabel: string;
}) {
  const codeDrills = useMemo(
    () => item.drills.filter((drill): drill is GymCode => drill.type === 'code'),
    [item],
  );
  const hasCode = codeDrills.length > 0;
  const hasQuick = Boolean(item.quickCode || item.formula?.code || item.skeleton);
  const tabs = TAB_META.filter((t) => (t.key !== 'sprint' || hasCode) && (t.key !== 'quick' || hasQuick));
  const [tab, setTab] = useState<Tab>(
    (initialTab === 'sprint' && !hasCode) || (initialTab === 'quick' && !hasQuick) ? 'learn' : initialTab,
  );
  const [sprintId, setSprintId] = useState(() => codeDrills[0]?.id ?? '');
  const sprintDrill = codeDrills.find((d) => d.id === sprintId) ?? codeDrills[0];
  const [local, setLocal] = useState<GymProgress | null>(progress);
  const entries: DrillEntry[] = useMemo(
    () => item.drills.map((drill) => ({
      itemKey: item.key, drillId: drill.id, itemTitle: item.title, kind: item.kind, drill,
    })),
    [item],
  );
  const tabCols = tabs.length === 5 ? 'grid-cols-5' : tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="fade-up space-y-3">
      <div className="flex items-center gap-2 pt-1">
        <Link href="/gym" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> 道场
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-[11px] text-zinc-500">{item.kind === 'pattern' ? '七式' : '惯用法'}</span>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-zinc-600">
          <Timer size={11} /> {item.minutes} 分钟
        </span>
      </div>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.theme && <p className="text-[10.5px] font-medium uppercase tracking-wider text-violet-300/80">{item.theme}</p>}
            <h1 className="mt-0.5 text-xl font-bold leading-tight text-zinc-50">{item.title}</h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{item.subtitle}</p>
          </div>
          <Mastery value={local?.mastery ?? 0} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div className={`grid ${tabCols} gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs`}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              tab === key ? 'bg-violet-500/25 font-medium text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'learn' && (
        <LearnTab
          item={item}
          onVisual={() => setTab('visual')}
          onQuick={hasQuick ? () => setTab('quick') : undefined}
          onPractice={() => setTab('practice')}
          onSprint={hasCode ? () => setTab('sprint') : undefined}
        />
      )}
      {tab === 'visual' && (
        <div className="space-y-3">
          <VisualPlayer item={item} />
          <div className={`grid gap-2 ${hasCode ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button type="button" onClick={() => setTab('practice')} className="grad-btn flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white">
              <Play size={15} /> 练 {item.drills.length} 道
            </button>
            {hasCode && (
              <button type="button" onClick={() => setTab('sprint')} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/[0.1]">
                <Zap size={15} /> 代码冲刺
              </button>
            )}
          </div>
        </div>
      )}
      {tab === 'quick' && <QuickWrite item={item} />}
      {tab === 'practice' && (
        <div className="space-y-3">
          {hasCode && (
            <button type="button" onClick={() => setTab('sprint')} className="card flex w-full items-center gap-3 border-cyan-400/25 bg-cyan-400/[0.05] p-3 text-left transition-colors hover:border-cyan-400/40">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><Zap size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-cyan-100">代码冲刺 · 从零写 5 轮</span>
                <span className="block text-[10.5px] text-zinc-500">计时 · 随机 3 个用例 · 连续 AC</span>
              </span>
              <span className="text-[10px] text-cyan-300">去冲刺 →</span>
            </button>
          )}
          <GymDrillSession
            entries={entries}
            pythonLabel={pythonLabel}
            onProgress={setLocal}
            finishHref="/gym"
            finishLabel="回到道场"
          />
        </div>
      )}
      {tab === 'sprint' && hasCode && sprintDrill && (
        <div className="space-y-3">
          {codeDrills.length > 1 && (
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {codeDrills.map((drill) => (
                <button
                  key={drill.id}
                  type="button"
                  aria-pressed={sprintDrill.id === drill.id}
                  onClick={() => setSprintId(drill.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[10.5px] transition-colors ${
                    sprintDrill.id === drill.id ? 'bg-cyan-500/20 text-cyan-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {drill.fn}
                </button>
              ))}
            </div>
          )}
          <CodeSprint
            key={sprintDrill.id}
            item={item}
            drill={sprintDrill}
            pythonLabel={pythonLabel}
            onProgress={setLocal}
          />
        </div>
      )}
    </div>
  );
}

function Mastery({ value }: { value: number }) {
  return (
    <div className="shrink-0 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-center">
      <p className="flex items-center justify-center gap-1 text-[9.5px] text-zinc-500"><Trophy size={10} className="text-amber-300" /> 掌握</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-100">{value}<span className="text-[10px] font-normal text-zinc-600">/5</span></p>
      <div className="mt-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`h-1 w-2.5 rounded-full ${n <= value ? 'bg-gradient-to-r from-violet-400 to-cyan-400' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  );
}

function LearnTab({
  item, onVisual, onQuick, onPractice, onSprint,
}: {
  item: GymItem;
  onVisual: () => void;
  onQuick?: () => void;
  onPractice: () => void;
  onSprint?: () => void;
}) {
  return (
    <div className="space-y-3">
      <section className="card border-violet-400/20 bg-violet-400/[0.05] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">一句话</p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-200">{item.summary}</p>
      </section>

      {item.sections.map((section) => (
        <section key={section.title} className="card space-y-2 p-4">
          <h2 className="text-[13px] font-semibold text-zinc-100">{section.title}</h2>
          {section.body.map((p, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed text-zinc-400">{p}</p>
          ))}
          {section.code && (
            <pre className="code-area overflow-x-auto rounded-xl border border-white/8 bg-[#0c0c14] p-3 text-[11.5px] leading-5 text-zinc-300">
              {section.code}
            </pre>
          )}
          {section.note && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11.5px] text-amber-200/90">
              {section.note}
            </p>
          )}
        </section>
      ))}

      {item.formula && (
        <section className="card border-cyan-400/20 bg-cyan-400/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">{item.formula.label}</p>
          <pre className="code-area mt-1.5 overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-5 text-cyan-100/90">{item.formula.code}</pre>
        </section>
      )}

      {item.skeleton && (
        <details className="card p-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-zinc-200">展开参考骨架（先自己默写，再看）</summary>
          <pre className="code-area mt-2 overflow-x-auto rounded-xl border border-white/8 bg-[#0c0c14] p-3 text-[11.5px] leading-5 text-zinc-300">
            {item.skeleton}
          </pre>
        </details>
      )}

      {item.traps && item.traps.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-semibold text-zinc-200">三个坑</h2>
          {item.traps.map((trap) => (
            <div key={trap.title} className="card p-3.5">
              <p className="text-[12px] font-medium text-zinc-200">{trap.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-rose-300/80">✗ {trap.wrong}</p>
              <p className="text-[11.5px] leading-relaxed text-emerald-300/80">✓ {trap.right}</p>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onVisual} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/12 py-2.5 text-[12px] font-medium text-zinc-300 hover:bg-white/[0.05]">
          <Eye size={14} /> 看可视化
        </button>
        <button type="button" onClick={onPractice} className="grad-btn flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold text-white">
          <Play size={14} /> 开始练习
        </button>
      </div>
      {onQuick && (
        <button type="button" onClick={onQuick} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-400/[0.05] py-2.5 text-[12px] font-semibold text-violet-200 hover:bg-violet-400/[0.1]">
          <Keyboard size={14} /> 代码速写 · Enter 检查
        </button>
      )}
      {onSprint && (
        <button type="button" onClick={onSprint} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] py-2.5 text-[12px] font-semibold text-cyan-200 hover:bg-cyan-400/[0.1]">
          <Zap size={14} /> 代码冲刺 · 从零写 5 轮
        </button>
      )}
    </div>
  );
}
