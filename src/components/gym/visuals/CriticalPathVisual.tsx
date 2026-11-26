'use client';

import { useMemo, useState } from 'react';
import { Check, GitBranch, Info, Lightbulb, RotateCcw, X } from 'lucide-react';

const NAMES = ['采集', '清洗', '标注', '增强', '训练', '评测'] as const;
const BASE_DURATIONS: readonly number[] = [2, 3, 4, 2, 5, 2];
const N = NAMES.length;
const AUGMENT = 3;

/** 依赖边：采集→清洗，清洗→标注/增强，标注/增强→训练，训练→评测 */
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [4, 5],
];

const SUCC: number[][] = Array.from({ length: N }, () => []);
const PRED: number[][] = Array.from({ length: N }, () => []);
for (const [a, b] of EDGES) {
  SUCC[a].push(b);
  PRED[b].push(a);
}
const SOURCES = PRED.map((preds, i) => (preds.length === 0 ? i : -1)).filter((i) => i >= 0);

type Mode = 'graph' | 'forward' | 'backward' | 'critical';

const MODES: { key: Mode; step: string; label: string; note: string }[] = [
  {
    key: 'graph',
    step: '①',
    label: '图',
    note: '先看结构：6 个环节、6 条依赖，清洗之后分成标注与增强两条并行分支，最后汇入训练。',
  },
  {
    key: 'forward',
    step: '②',
    label: '正推',
    note: '按拓扑序算最早开始/结束：ES 取所有前驱 EF 的最大值，EF = ES + 耗时。',
  },
  {
    key: 'backward',
    step: '③',
    label: '倒推',
    note: '从 makespan 倒推最晚结束/开始：LF 取所有后继 LS 的最小值，松弛 = LS − ES。',
  },
  {
    key: 'critical',
    step: '④',
    label: '关键路径',
    note: '松弛为 0 的环节串成关键路径；路径上耗时最长的环节就是瓶颈。',
  },
];

interface Schedule {
  durations: number[];
  es: number[];
  ef: number[];
  ls: number[];
  lf: number[];
  slack: number[];
  forward: number[];
  makespan: number;
  path: number[];
  bottleneck: number;
  critical: Set<number>;
  /** 所有 slack=0 的节点；并列关键路径时会比选中的 path 更宽。 */
  zeroSlack: Set<number>;
  zeroSlackKey: string;
}

/** 纯函数：从耗时重算正推、倒推、关键路径与瓶颈 */
function computeSchedule(durations: readonly number[]): Schedule {
  const indeg = PRED.map((preds) => preds.length);
  const queue: number[] = [];
  for (let i = 0; i < N; i += 1) if (indeg[i] === 0) queue.push(i);

  const topo: number[] = [];
  while (queue.length > 0) {
    const v = queue.shift()!;
    topo.push(v);
    for (const w of SUCC[v]) {
      indeg[w] -= 1;
      if (indeg[w] === 0) queue.push(w);
    }
  }

  const es = new Array<number>(N).fill(0);
  const ef = new Array<number>(N).fill(0);
  for (const v of topo) {
    for (const p of PRED[v]) es[v] = Math.max(es[v], ef[p]);
    ef[v] = es[v] + durations[v];
  }
  const makespan = Math.max(...ef);

  const ls = new Array<number>(N).fill(0);
  const lf = new Array<number>(N).fill(makespan);
  for (let t = topo.length - 1; t >= 0; t -= 1) {
    const v = topo[t];
    lf[v] = SUCC[v].length > 0 ? Math.min(...SUCC[v].map((w) => ls[w])) : makespan;
    ls[v] = lf[v] - durations[v];
  }

  // forward[v]：从 v 到出口的最长耗时（含自身）
  const forward = new Array<number>(N).fill(0);
  for (let t = topo.length - 1; t >= 0; t -= 1) {
    const v = topo[t];
    forward[v] = durations[v] + (SUCC[v].length > 0 ? Math.max(...SUCC[v].map((w) => forward[w])) : 0);
  }

  // 关键路径：起点取 sources 中 forward==makespan 的最小下标，之后每步在后继里取最小下标
  let start = -1;
  for (const v of SOURCES) {
    if (forward[v] === makespan && (start === -1 || v < start)) start = v;
  }
  if (start === -1) start = SOURCES[0] ?? 0;

  const path = [start];
  let cur = start;
  while (true) {
    const rest = forward[cur] - durations[cur];
    let next = -1;
    for (const w of SUCC[cur]) {
      if (forward[w] === rest && (next === -1 || w < next)) next = w;
    }
    if (next === -1) break;
    cur = next;
    path.push(cur);
  }

  // 瓶颈：关键路径上耗时最大，并列取下标小
  let bottleneck = path[0];
  for (const v of path) {
    if (
      durations[v] > durations[bottleneck]
      || (durations[v] === durations[bottleneck] && v < bottleneck)
    ) {
      bottleneck = v;
    }
  }

  const slack = es.map((value, i) => ls[i] - value);
  const zeroSlack = new Set<number>();
  slack.forEach((value, i) => { if (value === 0) zeroSlack.add(i); });
  const zeroSlackKey = [...zeroSlack].join(',');

  return {
    durations: [...durations],
    es, ef, ls, lf, slack, forward, makespan, path, bottleneck,
    critical: new Set(path), zeroSlack, zeroSlackKey,
  };
}

const BASE_SCHEDULE = computeSchedule(BASE_DURATIONS);

function pathText(path: readonly number[]): string {
  return path.map((v) => NAMES[v]).join(' → ');
}

function describeSwitch(current: Schedule): { kind: 'path' | 'tie' | 'none'; detail: string } {
  const pathChanged = current.path.join(',') !== BASE_SCHEDULE.path.join(',');
  if (pathChanged) {
    const added = current.path.filter((v) => !BASE_SCHEDULE.path.includes(v)).map((v) => NAMES[v]);
    const removed = BASE_SCHEDULE.path.filter((v) => !current.path.includes(v)).map((v) => NAMES[v]);
    const detail = added.length > 0 || removed.length > 0
      ? `${added.join('、')} 取代 ${removed.join('、')}；工期 ${BASE_SCHEDULE.makespan} → ${current.makespan}`
      : `工期 ${BASE_SCHEDULE.makespan} → ${current.makespan}`;
    return { kind: 'path', detail };
  }
  if (current.zeroSlackKey !== BASE_SCHEDULE.zeroSlackKey) {
    const newly = current.slack
      .map((value, i) => (value === 0 && BASE_SCHEDULE.slack[i] !== 0 ? NAMES[i] : null))
      .filter((name): name is (typeof NAMES)[number] => name !== null);
    const dropped = BASE_SCHEDULE.slack
      .map((value, i) => (value === 0 && current.slack[i] !== 0 ? NAMES[i] : null))
      .filter((name): name is (typeof NAMES)[number] => name !== null);
    return {
      kind: 'tie',
      detail: newly.length > 0
        ? `${newly.join('、')} 的 slack 归零，与主链并列最长；当前仍按最小下标取主链`
        : `${dropped.join('、')} 退出零松弛集合，关键路径仍按最小下标选取`,
    };
  }
  return { kind: 'none', detail: '' };
}

const COLUMNS = [
  { key: 'name', label: '环节' },
  { key: 'dur', label: '耗时' },
  { key: 'es', label: 'ES' },
  { key: 'ef', label: 'EF' },
  { key: 'ls', label: 'LS' },
  { key: 'lf', label: 'LF' },
  { key: 'slack', label: '松弛' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

function activeColumns(mode: Mode): ColumnKey[] {
  if (mode === 'forward') return ['es', 'ef'];
  if (mode === 'backward') return ['ls', 'lf'];
  if (mode === 'critical') return ['slack'];
  return ['dur'];
}

const GANTT_NOTES: Record<Mode, string> = {
  graph: '绿条是关键链，斜纹段是松弛；紫色虚线为当前 makespan。',
  forward: '条从 ES 开始、到 EF 结束；正推出的 EF 决定后继的 ES。',
  backward: '虚线框是 [LS, LF] 最晚窗口，它与实条之间的差就是松弛。',
  critical: '非关键行变淡；关键条绿色，瓶颈条加琥珀色描边。',
};

interface Quiz {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

const QUIZZES: Quiz[] = [
  {
    id: 'train-es',
    prompt: '基准设定下，训练 的 ES 是多少？',
    options: ['5', '7', '9', '14'],
    answer: 2,
    explain: '两条前驱的 EF 是 标注 9（5+4）和 增强 7（5+2）。训练要等两条都完成，ES = max(9, 7) = 9。',
  },
  {
    id: 'augment-slack',
    prompt: '基准设定下，增强 的 slack 是多少？',
    options: ['0', '1', '2', '3'],
    answer: 2,
    explain: '增强 ES=5、EF=7，但训练最早 9 才能开始；所以 LF=9、LS=7，slack = 9 − 7 = 2。',
  },
];

export default function CriticalPathVisual() {
  const [mode, setMode] = useState<Mode>('graph');
  const [durations, setDurations] = useState<number[]>(() => [...BASE_DURATIONS]);
  const [picks, setPicks] = useState<Record<string, number>>({});

  const schedule = useMemo(() => computeSchedule(durations), [durations]);
  const change = useMemo(() => describeSwitch(schedule), [schedule]);
  const isBaseline = durations.every((value, i) => value === BASE_DURATIONS[i]);
  const activeMode = MODES.find((m) => m.key === mode) ?? MODES[0];
  const highlighted = activeColumns(mode);
  const augmentSlack = schedule.slack[AUGMENT];
  const pathEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < schedule.path.length - 1; i += 1) {
      keys.add(`${schedule.path[i]}-${schedule.path[i + 1]}`);
    }
    return keys;
  }, [schedule]);

  function changeDuration(index: number, delta: number) {
    setDurations((prev) => prev.map((value, i) => (
      i === index ? Math.max(0, Math.min(8, value + delta)) : value
    )));
  }

  function pickAnswer(id: string, index: number) {
    setPicks((prev) => (prev[id] === undefined ? { ...prev, [id]: index } : prev));
  }

  return (
    <div className="card space-y-3 p-3 sm:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] text-emerald-200">
            <GitBranch size={10} /> 关键路径实验台
          </span>
          <h3 className="mt-1 text-[13px] font-semibold text-zinc-100">调耗时，看关键路径怎么换</h3>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-zinc-500">
            基准：makespan 16 · {pathText(BASE_SCHEDULE.path)}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-center">
          <span className="block text-[8.5px] text-zinc-500">当前工期</span>
          <span className="block font-mono text-sm font-bold tabular-nums text-cyan-200">{schedule.makespan}</span>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="实验步骤">
        {MODES.map((item) => {
          const active = mode === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              aria-pressed={active}
              aria-label={`切换到${item.label}模式`}
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                active
                  ? 'border-violet-400/40 bg-violet-500/25 font-medium text-white'
                  : 'border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <span className={active ? 'text-violet-200' : 'text-zinc-600'}>{item.step}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2" aria-live="polite">
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-violet-100/85">
          <Info size={12} className="mt-0.5 shrink-0 text-violet-300" />
          <span>{activeMode.note}</span>
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-zinc-200">依赖图</p>
            <span className="text-[9px] text-zinc-600">箭头 = 先后依赖 · 可左右滑动</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/8 bg-[#0b0b13] p-2">
            <DagGraph schedule={schedule} mode={mode} pathEdgeKeys={pathEdgeKeys} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-emerald-400 bg-emerald-400/20" />关键路径</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-amber-400 bg-amber-400/20" />瓶颈</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-zinc-600 bg-white/[0.04]" />非关键 / 有松弛</span>
          </div>
        </section>

        <div className="min-w-0 space-y-2.5">
          <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-zinc-200">耗时调节</p>
              <button
                type="button"
                onClick={() => setDurations([...BASE_DURATIONS])}
                disabled={isBaseline}
                aria-label="恢复基准耗时"
                className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[9.5px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:opacity-30"
              >
                <RotateCcw size={10} /> 重置
              </button>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-zinc-600">范围 0-8，每次改动实时重算 ES/EF、LS/LF、slack 与工期。</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {NAMES.map((name, i) => {
                const isBottleneck = i === schedule.bottleneck;
                const isCritical = schedule.zeroSlack.has(i);
                return (
                  <div key={name} className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] px-1.5 py-1">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isBottleneck ? 'bg-amber-400' : isCritical ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-300">{name}</span>
                    <button
                      type="button"
                      onClick={() => changeDuration(i, -1)}
                      disabled={durations[i] <= 0}
                      aria-label={`减少 ${name} 耗时`}
                      className="flex h-5 w-5 items-center justify-center rounded border border-white/10 text-[11px] leading-none text-zinc-300 hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-25"
                    >
                      −
                    </button>
                    <span className={`w-4 text-center font-mono text-[11px] tabular-nums ${durations[i] !== BASE_DURATIONS[i] ? 'text-violet-200' : 'text-zinc-100'}`}>
                      {durations[i]}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeDuration(i, 1)}
                      disabled={durations[i] >= 8}
                      aria-label={`增加 ${name} 耗时`}
                      className="flex h-5 w-5 items-center justify-center rounded border border-white/10 text-[11px] leading-none text-zinc-300 hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-25"
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[9px] text-zinc-600">试试把 标注 调到 2，或把 增强 调到 5。</p>
          </section>

          <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-zinc-200">实时结果</p>
              <span className="text-[9px] text-zinc-600">随耗时立即更新</span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5">
                <p className="text-[8.5px] text-zinc-500">工期</p>
                <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-cyan-200">{schedule.makespan}</p>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-2 py-1.5">
                <p className="text-[8.5px] text-zinc-500">瓶颈</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-amber-200">
                  {NAMES[schedule.bottleneck]} <span className="font-mono tabular-nums">{durations[schedule.bottleneck]}</span>
                </p>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5">
                <p className="text-[8.5px] text-zinc-500">增强松弛</p>
                <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${augmentSlack > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>
                  {augmentSlack}
                </p>
              </div>
            </div>
            <div className="mt-1.5 rounded-lg border border-white/8 bg-[#0b0b13] px-2.5 py-2">
              <p className="text-[9px] text-zinc-500">关键路径</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {schedule.path.map((v, idx) => (
                  <span key={`${v}-${idx}`} className="flex items-center gap-1">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        v === schedule.bottleneck
                          ? 'border-amber-400/35 bg-amber-400/[0.10] text-amber-200'
                          : 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200'
                      }`}
                    >
                      {NAMES[v]}
                    </span>
                    {idx < schedule.path.length - 1 && <span className="text-[9px] text-emerald-400/60">→</span>}
                  </span>
                ))}
              </div>
            </div>
            {change.kind !== 'none' ? (
              <div role="status" className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-2 py-1.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-200">
                  <GitBranch size={10} /> {change.kind === 'path' ? '关键路径已切换' : '出现并列关键路径'}
                </p>
                <p className="mt-0.5 text-[9.5px] leading-relaxed text-amber-100/75">{change.detail}</p>
              </div>
            ) : !isBaseline ? (
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-zinc-500">改动还在松弛范围内，关键路径暂时没变。</p>
            ) : (
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-zinc-500">基准状态：所有路径里最长的一条就是关键路径。</p>
            )}
          </section>
        </div>
      </div>

      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[11px] font-semibold text-zinc-200">正推 / 倒推表</p>
          <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-1.5 py-0.5 text-[8.5px] text-violet-200">
            当前高亮：
            {mode === 'forward' ? 'ES · EF' : mode === 'backward' ? 'LS · LF' : mode === 'critical' ? '松弛' : '耗时'}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[420px] border-collapse text-[10.5px]">
            <caption className="sr-only">关键路径实验的正推与倒推表</caption>
            <thead>
              <tr className="border-b border-white/10 text-left text-[9.5px] text-zinc-500">
                {COLUMNS.map((column) => {
                  const active = highlighted.includes(column.key);
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-2 py-1.5 font-medium ${active ? 'text-violet-200' : ''}`}
                    >
                      {column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {NAMES.map((name, i) => {
                const isBottleneck = i === schedule.bottleneck;
                const isCritical = schedule.zeroSlack.has(i);
                const slack = schedule.slack[i];
                return (
                  <tr
                    key={name}
                    className={`border-b border-white/5 last:border-0 ${
                      isBottleneck
                        ? 'bg-amber-400/[0.09]'
                        : isCritical
                          ? 'bg-emerald-400/[0.06]'
                          : i % 2 === 1
                            ? 'bg-white/[0.012]'
                            : ''
                    }`}
                  >
                    <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                      <span className="flex items-center gap-1">
                        <span className={isBottleneck ? 'text-amber-200' : isCritical ? 'text-emerald-100' : 'text-zinc-300'}>
                          {name}
                        </span>
                        {isBottleneck && (
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.10] px-1 text-[8px] text-amber-200">瓶颈</span>
                        )}
                        {!isCritical && slack > 0 && (
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-1 text-[8px] text-zinc-400">
                            松弛 {slack}
                          </span>
                        )}
                      </span>
                    </th>
                    {COLUMNS.slice(1).map((column) => {
                      const active = highlighted.includes(column.key);
                      let value: number = 0;
                      if (column.key === 'dur') value = durations[i];
                      else if (column.key === 'es') value = schedule.es[i];
                      else if (column.key === 'ef') value = schedule.ef[i];
                      else if (column.key === 'ls') value = schedule.ls[i];
                      else if (column.key === 'lf') value = schedule.lf[i];
                      else value = slack;
                      const tone = column.key === 'slack'
                        ? slack > 0
                          ? 'text-amber-200'
                          : isCritical
                            ? 'text-emerald-200'
                            : 'text-zinc-400'
                        : active
                          ? 'text-violet-100'
                          : 'text-zinc-400';
                      return (
                        <td
                          key={column.key}
                          className={`px-2 py-1.5 font-mono tabular-nums ${active ? 'font-semibold' : ''} ${tone}`}
                        >
                          {value}
                          {column.key === 'slack' && slack > 0 && <span className="ml-0.5 text-[8px] text-amber-400/70">松</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[11px] font-semibold text-zinc-200">甘特图 · 0-{Math.max(18, Math.ceil(schedule.makespan / 2) * 2)}</p>
          <span className="text-[8.5px] text-zinc-600">{GANTT_NOTES[mode]}</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-[#0b0b13] p-2">
          <GanttChart schedule={schedule} mode={mode} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500/70" />关键条</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-zinc-600" />非关键条</span>
          <span className="flex items-center gap-1">
            <span
              className="h-2 w-3 rounded-sm border border-amber-400/30"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(251,191,36,.55) 0 1px, transparent 1px 4px)' }}
            />
            松弛斜纹
          </span>
          <span className="flex items-center gap-1"><span className="h-0 w-3 border-t border-dashed border-violet-300" />makespan</span>
        </div>
      </section>

      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-zinc-200">
            <Lightbulb size={12} className="text-amber-300" /> 先预测
          </p>
          <span className="text-[9px] text-zinc-600">先在心里算，再点选项；答错不影响继续操作</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUIZZES.map((quiz) => {
            const picked = picks[quiz.id];
            const correct = picked === quiz.answer;
            return (
              <div key={quiz.id} className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-2.5">
                <p className="text-[10.5px] font-medium leading-relaxed text-amber-100">{quiz.prompt}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                  {quiz.options.map((option, idx) => {
                    const chosen = picked === idx;
                    const isAnswer = picked !== undefined && idx === quiz.answer;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => pickAnswer(quiz.id, idx)}
                        aria-pressed={chosen}
                        aria-label={`${quiz.prompt} 选项 ${option}`}
                        className={`rounded-lg border px-2 py-1 text-left text-[10.5px] transition-colors ${
                          isAnswer
                            ? 'border-emerald-400/40 bg-emerald-400/[0.10] text-emerald-100'
                            : chosen
                              ? 'border-rose-400/40 bg-rose-400/[0.08] text-rose-100'
                              : 'border-white/10 text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {picked !== undefined && (
                  <p className={`mt-1.5 flex items-start gap-1 text-[9.5px] leading-relaxed ${correct ? 'text-emerald-200' : 'text-rose-200/90'}`}>
                    {correct ? <Check size={11} className="mt-0.5 shrink-0" /> : <X size={11} className="mt-0.5 shrink-0" />}
                    <span>
                      <b>{correct ? '答对了。' : '再想想：'}</b>
                      {quiz.explain}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const NODE_W = 88;
const NODE_H = 60;
const NODE_POS = [
  { x: 6, y: 68 },
  { x: 112, y: 68 },
  { x: 218, y: 16 },
  { x: 218, y: 120 },
  { x: 324, y: 68 },
  { x: 430, y: 68 },
];
const EDGE_PATHS = [
  'M 94 98 H 112',
  'M 200 98 C 209 98 209 46 218 46',
  'M 200 98 C 209 98 209 150 218 150',
  'M 306 46 C 315 46 315 98 324 98',
  'M 306 150 C 315 150 315 98 324 98',
  'M 412 98 H 430',
];

function DagGraph({
  schedule, mode, pathEdgeKeys,
}: {
  schedule: Schedule;
  mode: Mode;
  pathEdgeKeys: Set<string>;
}) {
  return (
    <svg
      viewBox="0 0 524 196"
      className="mx-auto block h-auto w-full min-w-[520px] max-w-[700px]"
      role="img"
      aria-label={`关键路径依赖图：${pathText(schedule.path)}，工期 ${schedule.makespan}`}
    >
      <title>{`关键路径依赖图：${pathText(schedule.path)}，工期 ${schedule.makespan}，瓶颈 ${NAMES[schedule.bottleneck]}`}</title>
      <defs>
        <marker id="cp-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L7 3.5 L0 7 Z" fill="#52525b" />
        </marker>
        <marker id="cp-arrow-on" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L7 3.5 L0 7 Z" fill="#34d399" />
        </marker>
      </defs>

      {EDGES.map(([a, b], index) => {
        const onPath = pathEdgeKeys.has(`${a}-${b}`);
        return (
          <path
            key={`${a}-${b}`}
            d={EDGE_PATHS[index]}
            fill="none"
            stroke={onPath ? '#34d399' : '#3f3f46'}
            strokeWidth={onPath ? 1.8 : 1.2}
            strokeLinecap="round"
            markerEnd={onPath ? 'url(#cp-arrow-on)' : 'url(#cp-arrow)'}
          />
        );
      })}

      {NAMES.map((name, i) => {
        const { x, y } = NODE_POS[i];
        const isBottleneck = i === schedule.bottleneck;
        const isCritical = schedule.zeroSlack.has(i);
        const fill = isBottleneck
          ? 'rgba(251,191,36,.12)'
          : isCritical
            ? 'rgba(52,211,153,.10)'
            : 'rgba(255,255,255,.035)';
        const stroke = isBottleneck ? '#fbbf24' : isCritical ? '#34d399' : '#3f3f46';
        const valueLine = mode === 'backward'
          ? `LS ${schedule.ls[i]} · LF ${schedule.lf[i]}`
          : mode === 'critical'
            ? `slack ${schedule.slack[i]}`
            : `ES ${schedule.es[i]} · EF ${schedule.ef[i]}`;
        return (
          <g key={name}>
            <rect
              x={x}
              y={y}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill={fill}
              stroke={stroke}
              strokeWidth={isBottleneck ? 1.6 : 1.2}
            />
            <text x={x + 10} y={y + 19} fill="#e4e4e7" fontSize="12" fontWeight="600">{name}</text>
            {isBottleneck && (
              <text x={x + NODE_W - 8} y={y + 16} textAnchor="end" fill="#fbbf24" fontSize="8">瓶颈</text>
            )}
            <text x={x + 10} y={y + 35} fill="#a1a1aa" fontSize="9">耗时 {schedule.durations[i]}</text>
            <text
              x={x + 10}
              y={y + 50}
              fill={isBottleneck ? '#fcd34d' : isCritical ? '#6ee7b7' : '#a1a1aa'}
              fontSize="9"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            >
              {valueLine}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * DagGraph 只拿到 schedule；耗时、ES/EF 等都来自同一份派生结果，
 * 不直接读取可变的 durations state。
 */

function GanttChart({ schedule, mode }: { schedule: Schedule; mode: Mode }) {
  const axisMax = Math.max(18, Math.ceil(schedule.makespan / 2) * 2);
  const step = axisMax <= 20 ? 2 : axisMax <= 40 ? 4 : 6;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== axisMax) ticks.push(axisMax);

  const pct = (value: number) => `${(value / axisMax) * 100}%`;
  const makespanLabelShift = schedule.makespan / axisMax > 0.8 ? 'translateX(-100%)' : 'translateX(-50%)';

  return (
    <div
      className="mx-auto w-full max-w-[720px]"
      role="img"
      aria-label={`甘特图：0 到 ${axisMax}，工期 ${schedule.makespan}，关键路径 ${pathText(schedule.path)}`}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-1.5">
        <span aria-hidden="true" />
        <div className="relative h-4">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 font-mono text-[9px] tabular-nums text-zinc-600"
              style={{
                left: pct(tick),
                transform: tick === 0 ? 'translateX(0)' : tick === axisMax ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {tick}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-0.5 space-y-[3px]">
        {NAMES.map((name, i) => {
          const isBottleneck = i === schedule.bottleneck;
          const isCritical = schedule.zeroSlack.has(i);
          const slack = schedule.slack[i];
          const dim = mode === 'critical' && !isCritical;
          const title = `${name}：ES ${schedule.es[i]} → EF ${schedule.ef[i]}，LS ${schedule.ls[i]} → LF ${schedule.lf[i]}，松弛 ${slack}`;
          return (
            <div
              key={name}
              className={`grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-1.5 ${dim ? 'opacity-45' : ''}`}
            >
              <span className={`truncate text-[10px] ${isBottleneck ? 'font-semibold text-amber-300' : isCritical ? 'text-emerald-100' : 'text-zinc-400'}`}>
                {name}
              </span>
              <div className="relative h-[18px] overflow-hidden rounded border border-white/5 bg-white/[0.018]">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    aria-hidden="true"
                    className="absolute inset-y-0 border-l border-white/[0.05]"
                    style={{ left: pct(tick) }}
                  />
                ))}

                {slack > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-[3px] rounded-sm border border-dashed border-amber-400/30"
                    style={{
                      left: pct(schedule.ef[i]),
                      width: pct(slack),
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(251,191,36,.5) 0 1px, transparent 1px 4px)',
                      opacity: mode === 'backward' ? 1 : 0.8,
                    }}
                  />
                )}

                {mode === 'backward' && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-[1px] rounded-sm border border-dashed ${isCritical ? 'border-emerald-400/50' : 'border-violet-300/40'}`}
                    style={{ left: pct(schedule.ls[i]), width: pct(schedule.durations[i]) }}
                  />
                )}

                <span
                  className={`absolute inset-y-[3px] z-10 rounded-sm border ${
                    isBottleneck
                      ? 'border-2 border-amber-400 bg-emerald-500/70'
                      : isCritical
                        ? mode === 'critical'
                          ? 'border-emerald-300 bg-emerald-400/80'
                          : 'border-emerald-400 bg-emerald-500/60'
                        : 'border-zinc-500/60 bg-zinc-600/55'
                  }`}
                  style={{ left: pct(schedule.es[i]), width: pct(schedule.durations[i]), minWidth: 2 }}
                  title={title}
                />

                {mode === 'forward' && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 z-20 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-300"
                    style={{ left: pct(schedule.es[i]) }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-y-0 left-[38px] right-0 z-20">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 border-l border-dashed border-violet-300/80"
            style={{ left: pct(schedule.makespan) }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-1.5">
        <span aria-hidden="true" />
        <div className="relative h-3.5">
          <span
            className="absolute top-0 whitespace-nowrap font-mono text-[9px] text-violet-200"
            style={{ left: pct(schedule.makespan), transform: makespanLabelShift }}
          >
            makespan {schedule.makespan}
          </span>
        </div>
      </div>
    </div>
  );
}
