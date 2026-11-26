'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const WEIGHTS = { a: 1, b: 1, c: 3 };

function Matrix({ tie = false }: { tie?: boolean }) {
  const rows = tie
    ? [
      { sample: 's2', a: 'X', b: 'Y', c: null },
    ]
    : [
      { sample: 's1', a: 'X', b: 'X', c: 'Y' },
      { sample: 's2', a: 'X', b: 'Y', c: null },
    ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[42px_repeat(3,1fr)] gap-1.5 text-center text-[10px] text-zinc-500">
        <span />
        {(['a', 'b', 'c'] as const).map((k) => <span key={k}>标注员 {k} <span className="text-zinc-600">w={WEIGHTS[k]}</span></span>)}
      </div>
      {rows.map((row) => (
        <div key={row.sample} className="grid grid-cols-[42px_repeat(3,1fr)] items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">{row.sample}</span>
          {(['a', 'b', 'c'] as const).map((k) => {
            const label = row[k];
            return (
              <span
                key={k}
                className={`rounded-lg border py-1.5 text-center text-[11px] font-medium ${
                  label === 'X' ? 'border-violet-400/30 bg-violet-400/[0.08] text-violet-200'
                    : label === 'Y' ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200'
                      : 'border-dashed border-white/10 text-zinc-600'
                }`}
              >
                {label ?? '未投'}
              </span>
            );
          })}
        </div>
      ))}
      {tie && <p className="text-center text-[10.5px] text-rose-300">s2 的 X 和 Y 各 1 分 → 平票</p>}
    </div>
  );
}

function Tally({ x, y }: { x: number; y: number }) {
  const max = Math.max(x, y, 1);
  return (
    <div className="space-y-2">
      {[{ label: 'X', value: x, cls: 'bg-violet-400' }, { label: 'Y', value: y, cls: 'bg-cyan-400' }].map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="w-4 text-[11px] text-zinc-400">{row.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
            <div className={`h-full rounded-md ${row.cls}`} style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-[11px] tabular-nums text-zinc-300">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function VoteVisual() {
  const scenes: Scene[] = [
    {
      title: '先看原始投票',
      note: '每个样本有一组「标注员 → 标签」的票。权重只加给可信标注员；不在权重表里的票直接忽略。',
      body: <Matrix />,
      state: [
        { label: '权重', value: 'a=1, b=1, c=3' },
        { label: 's1', value: 'X, X, Y' },
      ],
      question: {
        prompt: 's1 里 X 有 2 票、Y 有 1 票，但 c 的权重是 3。赢家是谁？',
        options: ['X，因为票多', 'Y，因为权重和 3 > 2', 'ARBITRATE', 'Y，因为字典序'],
        answer: 1,
        explain: '票数不是权重。X 的权重和 1+1=2，Y 是 3，唯一最高分是 Y。',
      },
    },
    {
      title: '把票换成权重和',
      note: '对每个标签累计权重，得到 X=2、Y=3。下一步只看最高分出现了几次。',
      body: <Tally x={2} y={3} />,
      state: [
        { label: 'counts[X]', value: '2' },
        { label: 'counts[Y]', value: '3' },
      ],
    },
    {
      title: '唯一最高分才自动采纳',
      note: 'Y 是唯一最高分，所以 s1 输出 Y。s2 只有 X、Y 各 1 分，最高分并列，必须转人工。',
      body: (
        <div className="space-y-3">
          <Tally x={2} y={3} />
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-center text-[12px] text-emerald-200">
            s1 → Y
          </div>
        </div>
      ),
      question: {
        prompt: 's2 的 X 和 Y 各 1 分，正确输出是什么？',
        options: ['X', 'Y', 'ARBITRATE', '丢掉 s2'],
        answer: 2,
        explain: '最高分并列，没有一个标签唯一获胜，必须转人工仲裁。不能按输入顺序取第一个。',
      },
    },
    {
      title: '平票不是取第一个',
      note: '平票时 winners 的长度大于 1，代码应该走 ARBITRATE/REVIEW 分支。把所有样本按名字排序后再输出，保证结果稳定。',
      body: <Matrix tie />,
      state: [
        { label: 'top', value: '1' },
        { label: 'winners', value: '["X","Y"]' },
        { label: '输出', value: 'ARBITRATE' },
      ],
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
