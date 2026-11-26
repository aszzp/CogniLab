'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const COLORS: Record<string, string> = {
  g1: 'border-violet-400/40 bg-violet-400/[0.1] text-violet-200',
  g2: 'border-cyan-400/40 bg-cyan-400/[0.1] text-cyan-200',
  g3: 'border-amber-400/40 bg-amber-400/[0.1] text-amber-200',
};

function Sample({ id, group, leaked = false }: { id: number; group: string; leaked?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${leaked ? 'border-rose-400/50 bg-rose-400/[0.08]' : COLORS[group] ?? 'border-white/10 text-zinc-400'}`}>
      <span className="font-mono">{id}</span>
      <span className="rounded bg-black/20 px-1 text-[9.5px]">{group}</span>
      {leaked && <span className="ml-auto text-[9px] text-rose-300">泄漏</span>}
    </div>
  );
}

function Columns({ highlight = false, leaked = false, emptyTest = false }: { highlight?: boolean; leaked?: boolean; emptyTest?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_28px_1fr] items-start gap-1">
      <div className="space-y-1.5">
        <p className="text-center text-[10px] text-zinc-500">训练集</p>
        <Sample id={0} group="g1" />
        <Sample id={1} group="g2" />
      </div>
      <div className={`flex h-full items-center justify-center text-[14px] ${highlight ? 'text-violet-300' : 'text-zinc-700'}`}>
        {highlight ? '↔' : ''}
      </div>
      <div className="space-y-1.5">
        <p className="text-center text-[10px] text-zinc-500">测试集</p>
        {emptyTest ? (
          <div className="rounded-lg border border-dashed border-white/10 px-2 py-3 text-center text-[10px] text-zinc-600">空</div>
        ) : (
          <>
            <Sample id={2} group="g1" leaked={leaked} />
            <Sample id={3} group="g3" />
          </>
        )}
      </div>
    </div>
  );
}

export default function LeakageVisual() {
  const scenes: Scene[] = [
    {
      title: '训练集与测试集各有哪些样本',
      note: '每个样本带一个组 ID（同一个用户、同一条会话、同一段语音）。看的是「组」有没有跨集合，不是样本 ID 有没有重复。',
      body: <Columns />,
      state: [
        { label: 'train', value: '[0:g1, 1:g2]' },
        { label: 'test', value: '[2:g1, 3:g3]' },
      ],
    },
    {
      title: '同组出现在两边，就是泄漏',
      note: '测试样本 2 的组是 g1，训练集里的样本 0 也是 g1。这个组跨了集合，测试样本 2 就泄漏了。',
      body: <Columns highlight />,
      question: {
        prompt: '哪个测试样本泄漏了？',
        options: ['样本 2', '样本 3', '2 和 3 都泄漏', '没有泄漏'],
        answer: 0,
        explain: 'g1 同时出现在训练集和测试集；测试集里属于 g1 的只有样本 2。样本 3 的 g3 没在训练集出现。',
      },
    },
    {
      title: '把结果写成结构',
      note: '泄漏样本要排序；泄漏组去重后排序；泄漏率 = 泄漏数 / 测试集总数，保留 4 位小数。',
      body: (
        <div className="space-y-2">
          <Columns highlight leaked />
          <pre className="code-area overflow-x-auto rounded-lg border border-white/8 bg-[#0c0c14] p-2.5 text-[10.5px] leading-5 text-zinc-300">{`{"leaked_test_ids": [2],
 "leaked_groups": ["g1"],
 "leak_rate": 0.5}`}</pre>
        </div>
      ),
      state: [
        { label: 'leaked', value: '[2]' },
        { label: 'rate', value: '1/2 = 0.5' },
      ],
    },
    {
      title: '空测试集：不要除零',
      note: '测试集为空时没有泄漏，leak_rate 返回 0.0，结果结构仍然完整。这是隐藏测试点最喜欢放的边界。',
      body: <Columns emptyTest />,
      state: [
        { label: 'leaked', value: '[]' },
        { label: 'rate', value: '0.0' },
      ],
      question: {
        prompt: 'test_ids 为空时，下面哪种写法最稳？',
        options: ['len(leaked) / len(test_ids)', 'len(leaked) / len(test_ids) if test_ids else 0.0', '直接 return None', '把测试集补一个样本'],
        answer: 1,
        explain: '空列表做除数会抛 ZeroDivisionError；条件表达式在空测试集时返回 0.0。',
      },
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
