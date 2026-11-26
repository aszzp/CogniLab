'use client';

import ScenePlayer, { type Scene } from './ScenePlayer';

const NODES = [
  { id: 'a', x: 20, y: 40, dur: 2, fwd: 6 },
  { id: 'b', x: 126, y: 40, dur: 1, fwd: 4 },
  { id: 'c', x: 232, y: 40, dur: 3, fwd: 3 },
  { id: 'd', x: 232, y: 110, dur: 1, fwd: 1 },
];
const CRITICAL = new Set(['a', 'b', 'c']);
const W = 60;
const H = 34;

function Dag({ mode }: { mode: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <svg viewBox="0 0 312 160" className="mx-auto block w-full max-w-[420px]" role="img" aria-label="关键路径示例图">
      <defs>
        <marker id="cp-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#71717a" />
        </marker>
        <marker id="cp-arrow-on" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#34d399" />
        </marker>
      </defs>
      <line x1="80" y1="57" x2="124" y2="57" stroke={mode >= 3 ? '#34d399' : '#52525b'} strokeWidth="1.6" markerEnd={mode >= 3 ? 'url(#cp-arrow-on)' : 'url(#cp-arrow)'} />
      <line x1="186" y1="57" x2="230" y2="57" stroke={mode === 3 ? '#34d399' : '#52525b'} strokeWidth="1.6" markerEnd={mode === 3 ? 'url(#cp-arrow-on)' : 'url(#cp-arrow)'} />
      <path d="M156 74 L156 96 L262 96 L262 108" fill="none" stroke={mode === 4 ? '#34d399' : '#52525b'} strokeWidth="1.6" markerEnd={mode === 4 ? 'url(#cp-arrow-on)' : 'url(#cp-arrow)'} />
      {NODES.map((n, index) => {
        const critSet = mode === 4 ? new Set(['a', 'b', 'd']) : CRITICAL;
        const changed = mode === 4 && n.id === 'd';
        const crit = mode >= 3 && critSet.has(n.id) && !changed;
        return (
          <g key={n.id}>
            <rect
              x={n.x} y={n.y} width={W} height={H} rx="9"
              fill={crit ? 'rgba(52,211,153,.12)' : changed ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.04)'}
              stroke={crit ? '#34d399' : changed ? '#fbbf24' : '#3f3f46'}
              strokeWidth="1.2"
            />
            <text x={n.x + 12} y={n.y + 15} fill="#e4e4e7" fontSize="12" fontWeight="600">{n.id}</text>
            <text x={n.x + 12} y={n.y + 27} fill="#a1a1aa" fontSize="9">
              {mode === 0 ? `耗时 ${n.dur}` : mode === 1 ? `拓扑 #${index + 1}` : `forward ${mode === 4 && n.id === 'd' ? 5 : n.fwd}`}
            </text>
            {mode === 1 && <text x={n.x + W - 16} y={n.y - 4} fill="#a78bfa" fontSize="10" fontWeight="700">{index + 1}</text>}
          </g>
        );
      })}
      {mode === 3 && <text x="4" y="152" fill="#34d399" fontSize="9">关键路径 a→b→c，makespan 6</text>}
      {mode === 4 && <text x="4" y="152" fill="#34d399" fontSize="9">d=5，关键路径转为 a→b→d，makespan 8</text>}
    </svg>
  );
}

export default function CriticalPathVisual() {
  const scenes: Scene[] = [
    {
      title: '输入是一张有向无环图',
      note: '每个环节有耗时，边表示先后依赖。互不依赖的环节可以并行，所以完工时间不是耗时总和。',
      body: <Dag mode={0} />,
      state: [
        { label: 'a / b / c / d', value: '2 / 1 / 3 / 1' },
        { label: '依赖', value: 'a→b, b→c, b→d' },
      ],
    },
    {
      title: '先拓扑排序，再递推',
      note: '输入顺序不保证是拓扑序。先把图排成 1→2→3→4，保证处理每个节点时它的后继都算完了。',
      body: <Dag mode={1} />,
      question: {
        prompt: '如果直接按输入顺序 a,b,c,d 递推 forward，会有什么风险？',
        options: ['没有风险，顺序刚好对', '某个节点的后继可能还没算，forward 会偏小', '会多算一次', '只影响瓶颈，不影响工期'],
        answer: 1,
        explain: '递推依赖后继的 forward。后继没算完就递推，结果会偏小；拓扑序保证「后继先算」。',
      },
    },
    {
      title: '从出口倒推 forward',
      note: 'forward[v] = 自身耗时 + 后继 forward 的最大值。叶子节点没有后继，最大值默认 0。',
      body: <Dag mode={2} />,
      state: [
        { label: 'forward[c]', value: '3' },
        { label: 'forward[b]', value: '1+max(3,1)=4' },
        { label: 'forward[a]', value: '2+4=6' },
      ],
      question: {
        prompt: 'forward[a] 为什么是 6，而不是 2+1=3？',
        options: ['因为 a 的耗时是 2', '因为要加上后继里最长的那条链', '因为要加上所有后继', '因为 makespan 取最大值'],
        answer: 1,
        explain: 'a 的耗时只算一次；b 之后要选最长的 c 分支（3），所以 a 的 forward = 2+1+3 = 6。',
      },
    },
    {
      title: '关键路径与瓶颈',
      note: 'forward 等于 makespan 的起点，沿着「forward 恰好等于剩余耗时」的后继走，就是关键路径。瓶颈只在关键路径上取。',
      body: <Dag mode={3} />,
      state: [
        { label: 'makespan', value: '6' },
        { label: '关键路径', value: 'a→b→c' },
        { label: '瓶颈', value: 'c（3）' },
      ],
      question: {
        prompt: '瓶颈应该取「关键路径上耗时最大的环节」，还是「全图耗时最大的环节」？',
        options: ['全图耗时最大的环节', '关键路径上耗时最大的环节', '两者的交集', '最后一个环节'],
        answer: 1,
        explain: '不在关键路径上的环节有松弛，缩短它不影响工期，所以瓶颈只从关键路径上取。',
      },
    },
    {
      title: '改非关键任务：先看松弛',
      note: 'd 当前路径是 2+1+1=4，距离 makespan 6 还有 2 的松弛。d 增加到 2 仍在松弛内，工期不变；增加到 5 超过松弛，关键路径换成 a→b→d，工期变 8。',
      body: <Dag mode={4} />,
      question: {
        prompt: '把 d 从 1 改到 5（超过松弛 2），makespan 会变成多少？',
        options: ['仍然是 6', '变成 8', '变成 7', '变成 10'],
        answer: 1,
        explain: 'a→b→d 变成 2+1+5=8，超过原来的 a→b→c=6，关键路径换成 a→b→d，makespan=8。改到 2 仍在松弛内，工期才不变。',
      },
    },
  ];
  return <ScenePlayer scenes={scenes} />;
}
