'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

function MemoryBar({ models = true }: { models?: boolean }) {
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-white/10">
        <div className="flex items-center justify-center bg-zinc-700/60 text-[8px] text-zinc-300" style={{ width: '10%' }}>保留 8</div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center border-r border-black/20 bg-violet-500/35 text-[8px] text-violet-100" style={{ width: '12.5%' }}>
            {models ? '10' : ''}
          </div>
        ))}
        <div className="flex items-center justify-center bg-amber-400/10 text-[8px] text-amber-300" style={{ width: '2.5%' }}>2</div>
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-zinc-600"><span>0</span><span>可用 72 / 总 80 GB</span></div>
    </div>
  );
}

function Gpu({ load, label }: { load: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <p className="text-[9px] text-zinc-500">{label}</p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-violet-200">{load} QPS</p>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: `${Math.min(100, (load / 560) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function CapacityVisual() {
  const scenes: Scene[] = [
    {
      title: '先减掉保留显存',
      note: '80GB 的卡要留 8GB 给系统和缓存，真正能给模型用的是 72GB。模型块每块 10GB，余下 2GB 不够一块。',
      body: <MemoryBar />,
      state: [
        { label: '总显存', value: '80' },
        { label: '保留', value: '8' },
        { label: '可用', value: '72' },
      ],
    },
    {
      title: '能放几个：向下取整',
      note: '72 // 10 = 7。放不下的 2GB 不能算半个副本，所以副本数是 7，不是 8。',
      body: (
        <div className="space-y-3">
          <MemoryBar />
          <div className="rounded-lg border border-violet-400/25 bg-violet-400/[0.06] px-3 py-2 text-center text-[11.5px] text-violet-100">
            72 // 10 = <b>7</b> 个副本，余 2GB
          </div>
        </div>
      ),
      question: {
        prompt: '如果写成 ceil(72/10)，副本数会变成多少？',
        options: ['7', '8', '72', '10'],
        answer: 1,
        explain: 'ceil 会把 7.2 变成 8，但第 8 个副本根本放不下。副本数必须用 floor。',
      },
    },
    {
      title: '单卡吞吐：副本 × 批大小 ÷ 时延',
      note: '单卡每秒能处理的请求数 = 副本数 × 批大小 × 1000 / 时延（毫秒）。7 个副本、批 4、时延 50ms，单卡 560 QPS。',
      body: (
        <div className="space-y-2 text-center">
          <p className="text-[11px] text-zinc-400">7 × 4 × 1000 ÷ 50</p>
          <p className="text-2xl font-bold tabular-nums text-cyan-200">560 <span className="text-[11px] font-normal text-zinc-500">QPS / 卡</span></p>
        </div>
      ),
      question: {
        prompt: '把批大小从 4 加到 8，单卡 QPS 一定翻倍吗？',
        options: ['一定翻倍', '不一定，时延也会随批大小增加', '一定减半', '与批大小无关'],
        answer: 1,
        explain: 'QPS = batch × 1000 / latency。batch 变大时时延通常也变大，所以 QPS 不一定线性增长。',
      },
    },
    {
      title: '需要几张卡：向上取整',
      note: '目标 600 QPS，单卡 560 QPS。600/560=1.07，差一点也要多一张，所以需要 2 张卡；第二张只跑 40 QPS。',
      body: (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Gpu load={560} label="卡 1" />
            <Gpu load={40} label="卡 2（余量）" />
          </div>
          <p className="text-center text-[11px] text-zinc-400">ceil(600 / 560) = 2</p>
        </div>
      ),
      state: [
        { label: '目标', value: '600' },
        { label: '单卡', value: '560' },
        { label: '卡数', value: '2' },
      ],
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
