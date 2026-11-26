'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const EVENTS = [
  { t: 0, svc: 'cpu', sev: 'P2' },
  { t: 5, svc: 'cpu', sev: 'P3' },
  { t: 10, svc: 'cpu', sev: 'P1' },
  { t: 20, svc: 'cpu', sev: 'P2' },
  { t: 21, svc: 'mem', sev: 'P3' },
];
const SPAN = 25;

function timelineLeft(t: number): string {
  return `${(t / SPAN) * 100}%`;
}

function Timeline({ mode }: { mode: 0 | 1 | 2 }) {
  return (
    <div className="relative h-28 px-1">
      <div className="absolute inset-x-1 top-14 h-0.5 bg-white/15" />
      {mode === 1 && (
        <div className="absolute top-6 h-16 rounded border border-amber-400/30 bg-amber-400/[0.05]" style={{ left: '1%', width: '40%' }}>
          <span className="absolute left-1 top-1 text-[8.5px] text-amber-300">窗口 10s</span>
        </div>
      )}
      {mode === 2 && (
        <div className="absolute top-11 h-7 rounded border border-violet-400/30 bg-violet-500/20" style={{ left: '1%', width: '80%' }}>
          <span className="absolute left-1 top-1 text-[8.5px] text-violet-200">事件 0–20 · 4 条 · P1</span>
        </div>
      )}
      {EVENTS.map((e) => (
        <div key={`${e.t}-${e.svc}`} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: timelineLeft(e.t) }}>
          <span className={`rounded px-1 py-0.5 text-[8.5px] ${e.svc === 'cpu' ? 'bg-violet-500/30 text-violet-100' : 'bg-cyan-500/30 text-cyan-100'}`}>{e.sev}</span>
          <span className={`mt-0.5 h-10 w-0.5 ${e.svc === 'cpu' ? 'bg-violet-400/60' : 'bg-cyan-400/60'}`} />
          <span className="text-[8px] tabular-nums text-zinc-500">{e.t}s</span>
        </div>
      ))}
      {mode === 2 && <span className="absolute bottom-0 right-1 text-[8px] text-zinc-600">cpu 组相邻间隔 5 / 5 / 10</span>}
    </div>
  );
}

function Suppression() {
  const rows = [
    { t: 0, state: 'sent', text: '发送，last_sent=0' },
    { t: 10, state: 'suppressed', text: '10-0 < 30，抑制' },
    { t: 20, state: 'suppressed', text: '20-0 < 30，抑制' },
    { t: 35, state: 'sent', text: '35-0 ≥ 30，发送' },
  ];
  const left = (t: number) => `${(t / 40) * 100}%`;
  return (
    <div className="space-y-2">
      <div className="relative h-16 px-1">
        <div className="absolute inset-x-1 top-8 h-0.5 bg-white/15" />
        {rows.map((r) => (
          <div key={r.t} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: left(r.t) }}>
            <span className={`h-3 w-3 rounded-full ${r.state === 'sent' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="mt-1 text-[8px] tabular-nums text-zinc-500">{r.t}s</span>
            <span className={`text-[7.5px] ${r.state === 'sent' ? 'text-emerald-300' : 'text-rose-300'}`}>{r.state === 'sent' ? '发送' : '抑制'}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.t} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1 text-[10px]">
            <span className="w-8 tabular-nums text-zinc-500">{r.t}s</span>
            <span className={r.state === 'sent' ? 'text-emerald-300' : 'text-rose-300'}>{r.state === 'sent' ? '发送' : '抑制'}</span>
            <span className="text-zinc-500">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AlertsVisual() {
  const scenes: Scene[] = [
    {
      title: '原始告警按时间排开',
      note: '同一服务、同一指标的告警放一组。横轴是时间，标记上的 P1/P2/P3 是级别；P1 级别最高。',
      body: <Timeline mode={0} />,
      state: [
        { label: '事件数', value: '5' },
        { label: '分组', value: 'cpu × 4, mem × 1' },
      ],
    },
    {
      title: '窗口 10 秒：相邻间隔决定是否合并',
      note: '0→5→10→20 的相邻间隔是 5、5、10，都 ≤10，所以 cpu 组全部并成一个事件；mem 是另一个组。',
      body: <Timeline mode={1} />,
      question: {
        prompt: '20 秒与 10 秒的间隔是 10，window_sec=10。20 秒这条是并入还是新事件？',
        options: ['并入，因为 10 ≤ 10', '新事件，因为必须严格小于', '丢弃', '无法判断'],
        answer: 0,
        explain: '聚合判断是 ts - prev <= window_sec，10 ≤ 10 成立，所以并入。把 <= 写成 < 会在这里少算一条。',
      },
    },
    {
      title: '结算成一个事件',
      note: '每个事件返回 [service, metric, start, end, count, top]。top 取组内最高级别，P1 < P2 < P3，所以用 min。',
      body: <Timeline mode={2} />,
      state: [
        { label: '事件', value: 'cpu 0–20' },
        { label: 'count', value: '4' },
        { label: 'top', value: 'P1' },
      ],
    },
    {
      title: '抑制：只有发送才刷新计时',
      note: '抑制规则 gap=30 秒。t=10 和 t=20 都被抑制，不更新 last_sent；所以 t=35 距离 last_sent=0 已经 35 秒，才发送。',
      body: <Suppression />,
      question: {
        prompt: 't=20 的告警被抑制后，last_sent 会更新成 20 吗？',
        options: ['会，抑制也要刷新', '不会，只有真正发送才刷新', '会，但只在同一服务内', '取决于级别'],
        answer: 1,
        explain: '如果被抑制的告警也刷新，抑制窗口会一直延长，告警永远发不出去。last_sent 只记录真正发送的时间。',
      },
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
