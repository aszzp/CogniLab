'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const ROWS = [
  { score: 0.9, ok: true },
  { score: 0.8, ok: true },
  { score: 0.7, ok: false },
  { score: 0.6, ok: true },
];

function Dots({ cut }: { cut?: number }) {
  return (
    <div>
      {cut !== undefined && (
        <div className="mb-1 flex items-center justify-between text-[9px]">
          <span className="text-emerald-300">← 自动 {cut} 条</span>
          <span className="text-zinc-500">转人工 {ROWS.length - cut} 条 →</span>
        </div>
      )}
      <div className="flex items-stretch gap-2">
        {ROWS.map((row, i) => (
          <div key={row.score} className="flex flex-1 items-stretch gap-2">
            {cut === i && <div className="w-0.5 rounded bg-violet-400" />}
            <div className="flex-1 text-center">
              <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-sm ${
                row.ok ? 'border-emerald-400/35 bg-emerald-400/[0.08] text-emerald-300' : 'border-rose-400/35 bg-rose-400/[0.08] text-rose-300'
              }`}>
                {row.ok ? '✓' : '✗'}
              </div>
              <p className="mt-1 text-[10px] tabular-nums text-zinc-400">{row.score}</p>
            </div>
          </div>
        ))}
        {cut === ROWS.length && <div className="w-0.5 rounded bg-violet-400" />}
      </div>
    </div>
  );
}

function TieDots() {
  const rows = [{ s: 0.9, ok: true }, { s: 0.9, ok: false }, { s: 0.8, ok: true }];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.04] p-2">
        {rows.slice(0, 2).map((r, i) => (
          <div key={i} className="flex-1 text-center">
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-[11px] ${
              r.ok ? 'border-emerald-400/35 text-emerald-300' : 'border-rose-400/35 text-rose-300'
            }`}>{r.ok ? '✓' : '✗'}</div>
            <p className="mt-0.5 text-[9.5px] text-zinc-400">{r.s}</p>
          </div>
        ))}
        <span className="px-1 text-[9px] text-amber-300">同组必须一起</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/8 p-2 opacity-60">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/35 text-[11px] text-emerald-300">✓</div>
        <p className="text-[10px] text-zinc-400">0.8 单独一组</p>
        <span className="ml-auto text-[9px] text-rose-300">切在 0.9 中间 → 精确率 1/2</span>
      </div>
    </div>
  );
}

export default function ThresholdVisual() {
  const scenes: Scene[] = [
    {
      title: '把会话按置信度降序排开',
      note: '绿色是答对的会话，红色是答错的。阈值越高，自动应答越少但越准；阈值越低，自动率越高但错误也进来。',
      body: <Dots />,
      state: [
        { label: '样本', value: '4' },
        { label: '分数', value: '0.9 / 0.8 / 0.7 / 0.6' },
      ],
    },
    {
      title: '切在 0.8：自动 2 条，全对',
      note: '阈值 0.8 表示 0.9 和 0.8 自动应答，其余转人工。自动率 2/4=0.5，精确率 2/2=1.0。',
      body: <Dots cut={2} />,
      state: [
        { label: 'auto_rate', value: '0.5' },
        { label: 'precision', value: '1.0' },
      ],
      question: {
        prompt: '如果约束是「自动率不低于 0.5、精确率不低于 0.66」，0.8 可行吗？',
        options: ['可行', '不可行，自动率太低', '不可行，精确率太低', '无法判断'],
        answer: 0,
        explain: '自动率 0.5 ≥ 0.5，精确率 1.0 ≥ 0.66，两个约束都满足，所以 0.8 是可行阈值。',
      },
    },
    {
      title: '切在 0.6：自动 4 条，错 1 条',
      note: '阈值 0.6 把所有会话都纳入自动。自动率 1.0，精确率 3/4=0.75。可行阈值里取最小的，自动率最大。',
      body: <Dots cut={4} />,
      state: [
        { label: 'auto_rate', value: '1.0' },
        { label: 'precision', value: '0.75' },
        { label: 'threshold', value: '0.6' },
      ],
    },
    {
      title: '同分是平台，不能切在中间',
      note: '两条 0.9 的会话分数相同，必须一起自动或一起转人工。切在 0.9 会把它们拆开，这不是合法切点。',
      body: <TieDots />,
      question: {
        prompt: '两条 0.9 的会话一好一坏，精确率约束 0.6。能切在 0.9 吗？',
        options: ['能，0.9 更高', '不能，这一组精确率只有 0.5', '能，只要自动率高', '不能，因为没有 1.0 的会话'],
        answer: 1,
        explain: '同组必须一起。0.9 组只有 2 条，其中 1 条错，精确率 0.5 < 0.6，所以不能切在 0.9；只能退到 0.8。',
      },
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
