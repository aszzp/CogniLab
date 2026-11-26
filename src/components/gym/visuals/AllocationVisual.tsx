'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const STRATA = [
  { name: 'a', size: 10 },
  { name: 'b', size: 20 },
  { name: 'c', size: 30 },
];

function Bars({ quotas, extras = [0, 0, 0], showCap = false }: { quotas: number[]; extras?: number[]; showCap?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[9px] text-zinc-600">
        <span className="w-3" />
        <span className="flex-1">每层按容量比例占宽</span>
        <span className="w-8 text-right">配额</span>
        {showCap && <span className="w-8 text-right">余量</span>}
      </div>
      {STRATA.map((s, i) => {
        const q = quotas[i] + extras[i];
        return (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-3 text-[10px] text-zinc-400">{s.name}</span>
            <div className="h-6 flex-1">
              <div className="flex h-6 overflow-hidden rounded-md border border-white/8" style={{ width: `${(s.size / 30) * 100}%` }}>
                <div className="bg-violet-500/55 transition-all" style={{ width: `${(q / s.size) * 100}%` }} />
                <div className="bg-white/[0.05]" style={{ width: `${((s.size - q) / s.size) * 100}%` }} />
              </div>
            </div>
            <span className="w-8 text-right text-[10px] tabular-nums text-violet-200">{q}</span>
            {showCap && <span className="w-8 text-right text-[9px] tabular-nums text-zinc-600">{s.size - quotas[i]}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function AllocationVisual() {
  const scenes: Scene[] = [
    {
      title: '先给每层保底',
      note: '总配额 20，每层保底 2。保底数不能超过层容量：quota[i] = min(min_each, size[i])。',
      body: <Bars quotas={[2, 2, 2]} />,
      state: [
        { label: 'quota', value: '[2, 2, 2]' },
        { label: 'remaining', value: '20 - 6 = 14' },
      ],
      question: {
        prompt: '保底之后，每层还剩多少容量？',
        options: ['[8, 18, 28]', '[10, 20, 30]', '[2, 2, 2]', '[4, 7, 9]'],
        answer: 0,
        explain: '容量 = size - quota：10-2=8，20-2=18，30-2=28，pool=54。',
      },
    },
    {
      title: '按容量比例分整数商',
      note: 'base[i] = remaining × capacity[i] // pool = 14 × [8,18,28] // 54 = [2,4,7]，和是 13。',
      body: <Bars quotas={[4, 6, 9]} showCap />,
      state: [
        { label: 'capacity', value: '[8, 18, 28]' },
        { label: 'base', value: '[2, 4, 7]' },
        { label: 'sum(base)', value: '13' },
      ],
      question: {
        prompt: '整数商一共分掉了 13 个名额，还剩几个？',
        options: ['0 个', '1 个', '2 个', '3 个'],
        answer: 1,
        explain: 'remaining=14，sum(base)=13，left=1。剩下的 1 个按余数分配。',
      },
    },
    {
      title: '余数大者先，并列取小下标',
      note: '余数是 14×c % 54 = [4,36,14]。第二层余数最大，拿到最后 1 个名额，最终配额 [4,7,9]。',
      body: (
        <div className="space-y-3">
          <Bars quotas={[4, 6, 9]} extras={[0, 1, 0]} />
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            {[{ n: 'a', r: 4 }, { n: 'b', r: 36 }, { n: 'c', r: 14 }].map((x) => (
              <div key={x.n} className={`rounded-lg border px-2 py-1.5 ${x.n === 'b' ? 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-200' : 'border-white/8 text-zinc-500'}`}>
                {x.n} · 余 {x.r}{x.n === 'b' ? ' ← +1' : ''}
              </div>
            ))}
          </div>
        </div>
      ),
      state: [
        { label: 'remainder', value: '[4, 36, 14]' },
        { label: 'left', value: '1' },
        { label: 'quota', value: '[4, 7, 9]' },
      ],
    },
    {
      title: '三个边界',
      note: '保底不能超容量；总数小于保底和时，remaining ≤ 0，直接返回保底；余数并列时取小下标。',
      body: (
        <div className="space-y-2">
          <Bars quotas={[1, 1, 1]} />
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-[10.5px] text-amber-200/90">
            例：三层配额各 1，总配额 3，保底 2 → 已经没有名额可分，直接 [1,1,1]。
          </div>
        </div>
      ),
      state: [
        { label: 'remaining', value: '3 - 3 = 0' },
        { label: '结果', value: '[1, 1, 1]' },
      ],
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
