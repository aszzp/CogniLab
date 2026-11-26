import type { GymItem } from '../types';

export const criticalPath: GymItem = {
  key: 'p1-critical-path',
  kind: 'pattern',
  order: 1,
  title: '关键路径与瓶颈',
  subtitle: '拓扑序 + 最长路：一次倒推算出工期、关键路径和瓶颈',
  theme: '51 · 数据处理流程关键路径与瓶颈判定',
  minutes: 12,
  level: 2,
  tags: ['DAG', '拓扑排序', '最长路', '并列路径'],
  summary: '先建图，再按拓扑序从后往前推 forward；关键路径就是 forward 恰好等于工期的节点链。瓶颈只从关键路径上取。',
  sections: [
    {
      title: '题目在问什么',
      body: [
        '给一组环节、每个环节的耗时、以及「a 完成后 b 才能开始」的依赖，求三样东西：整条流水线的完工时间 makespan、一条关键路径、关键路径上耗时最大的瓶颈环节。',
        '互不依赖的环节可以并行，所以 makespan 不是耗时总和，而是所有路径里最长的那条。',
      ],
    },
    {
      title: '心智模型：从出口倒推',
      body: [
        '先做拓扑排序，保证处理每个节点时它的后继都已经算过。令 forward[v] 表示「从 v 出发到出口的最长耗时（含 v 自身）」，则 forward[v] = durations[v] + 后继 forward 的最大值。',
        '所有起点里 forward 的最大值就是 makespan。重建路径时，每一步只在「forward 仍等于剩余耗时」的后继里选，这样不会走到一条更短的岔路。',
      ],
      code: 'forward[v] = durations[v] + max(forward[w] for w in succ[v], default=0)',
      note: '入度为 0 的节点是起点；单节点图也要能返回 [duration, [name], name]。',
    },
    {
      title: '并列规则：字典序最小',
      body: [
        '多条路径并列最长时，题目要求取「环节下标序列」字典序最小的一条：起点选下标最小的，之后每一步也在仍能构成最长路径的后继里选下标最小的。',
        '瓶颈耗时并列时，取 names 里下标较小的那个。不要用「全局耗时最大」代替「关键路径上耗时最大」。',
      ],
    },
    {
      title: '考场动作',
      body: [
        '① 建 index、succ、indeg；② 栈式拓扑排序；③ 逆拓扑序推 forward；④ 从起点重建路径；⑤ 在路径上取瓶颈。',
        'n 可达 2000，用迭代栈，不要递归。',
      ],
    },
  ],
  formula: {
    label: '最长路递推',
    code: 'forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=0)',
  },
  skeleton: `def pipeline_critical_path(names, durations, deps):
    n = len(names)
    index = {name: i for i, name in enumerate(names)}
    succ = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in deps:
        succ[index[a]].append(index[b])
        indeg[index[b]] += 1
    sources = [i for i in range(n) if indeg[i] == 0]
    stack, topo = list(sources), []
    while stack:
        v = stack.pop()
        topo.append(v)
        for w in succ[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                stack.append(w)
    forward = [0] * n
    for v in reversed(topo):
        forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=0)
    makespan = max(forward)
    cur = min(v for v in sources if forward[v] == makespan)
    path = [cur]
    while True:
        rest = forward[cur] - durations[cur]
        nxt = [w for w in succ[cur] if forward[w] == rest]
        if not nxt:
            break
        cur = min(nxt)
        path.append(cur)
    bottleneck = min(path, key=lambda v: (-durations[v], v))
    return [makespan, [names[v] for v in path], names[bottleneck]]`,
  traps: [
    { title: '输入不是拓扑序', wrong: '按 names 的顺序直接递推', right: '先拓扑排序，再按 topo 顺序递推' },
    { title: '瓶颈取错', wrong: '取全局耗时最大的环节', right: '只在关键路径上取耗时最大者' },
    { title: '并列路径', wrong: '随便取一条最长的', right: '每一步取下标最小的后继' },
  ],
  visual: 'critical-path',
  drills: [
    {
      id: 'p1-m1',
      type: 'mcq',
      prompt: '环节 a→b、b→c、b→d，耗时分别为 2、1、3、1。完工时间、关键路径和瓶颈是什么？',
      options: ['6，a→b→c，c', '4，a→b→d，b', '5，a→b→c，b', '7，a→b→c→d，c'],
      answer: 0,
      explain: 'a→b→c 耗时 2+1+3=6，a→b→d 耗时 4，所以 makespan=6；关键路径是 a→b→c，瓶颈是路径上耗时最大的 c（3）。',
      trap: 'tie',
    },
    {
      id: 'p1-m2',
      type: 'mcq',
      prompt: '想让整条流水线更快，下面哪种做法一定可能缩短 makespan？',
      options: [
        '缩短任意一个环节的耗时',
        '缩短关键路径上的瓶颈环节',
        '缩短全局耗时最大的环节，即使它不在关键路径上',
        '给关键路径再加一条依赖',
      ],
      answer: 1,
      explain: '只有关键路径上的环节缩短才会影响 makespan；瓶颈是关键路径上耗时最大的环节，缩短它收益最大。非关键路径的环节有松弛，缩短它不改变工期。',
      trap: 'tie',
    },
    {
      id: 'p1-m3',
      type: 'mcq',
      prompt: 'names 的顺序不保证是拓扑序。最稳妥的处理顺序是？',
      options: [
        '按 names 的输入顺序递推',
        '先按耗时从大到小排序',
        '先做拓扑排序，再按拓扑序递推',
        '按 names 的字典序排序',
      ],
      answer: 2,
      explain: '递推要求后继先算完；只有拓扑序能保证这一点。按输入顺序或字典序都可能在后继没算完时就计算 forward。',
      trap: 'order',
    },
    {
      id: 'p1-f1',
      type: 'fill',
      prompt: '补全最长路递推与路径重建。注意空位 3 的两种等价写法。',
      code: `forward = [0] * n
for v in reversed(topo):
    forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=___)
makespan = max(forward)
cur = min(v for v in sources if forward[v] == ___)
path = [cur]
while True:
    rest = forward[cur] - durations[cur]
    nxt = [w for w in succ[cur] if forward[w] == ___]
    if not nxt:
        break
    cur = min(nxt)
    path.append(cur)
bottleneck = min(path, key=lambda v: (___, v))`,
      blanks: [
        { answers: ['0'], hint: '没有后继时取什么', width: 4 },
        { answers: ['makespan'], hint: '起点要等于哪个值', width: 10 },
        { answers: ['rest', 'forward[cur] - durations[cur]'], hint: '剩余耗时', width: 10 },
        { answers: ['-durations[v]'], hint: '耗时大者优先', width: 14 },
      ],
      explain: '两个关键点：空后继的 default 必须是 0；路径重建比较的是「剩余耗时」，不是 makespan。瓶颈用 (-duration, index) 让耗时大者排前、并列时下标小者排前。',
      trap: 'tie',
    },
    {
      id: 'p1-f2',
      type: 'fill',
      prompt: '补全建图与拓扑排序。',
      code: `index = {name: i for i, name in enumerate(names)}
succ = [[] for _ in range(n)]
indeg = [0] * n
for a, b in deps:
    succ[index[a]].append(index[b])
    indeg[index[b]] += ___
sources = [i for i in range(n) if indeg[i] == ___]
stack, topo = list(sources), []
while stack:
    v = stack.pop()
    topo.append(v)
    for w in succ[v]:
        indeg[w] -= 1
        if indeg[w] == ___:
            stack.append(w)`,
      blanks: [
        { answers: ['1'], hint: '一条入边', width: 4 },
        { answers: ['0'], hint: '没有前驱', width: 4 },
        { answers: ['0'], hint: '前驱全部完成', width: 4 },
      ],
      explain: '入度是「还没完成的前驱数」。每弹出一个节点，就把所有后继的入度减 1；减到 0 说明后继的前驱全完成了，可以入栈。',
      trap: 'order',
    },
    {
      id: 'p1-c1',
      type: 'code',
      prompt: '补全 4 个空并运行。判题会跑 5 个用例，包括单节点、纯并行和并列路径。',
      fn: 'pipeline_critical_path',
      starter: `def pipeline_critical_path(names, durations, deps):
    n = len(names)
    index = {name: i for i, name in enumerate(names)}
    succ = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in deps:
        succ[index[a]].append(index[b])
        indeg[index[b]] += 1
    sources = [i for i in range(n) if indeg[i] == 0]
    stack, topo = list(sources), []
    while stack:
        v = stack.pop()
        topo.append(v)
        for w in succ[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                stack.append(w)
    forward = [0] * n
    for v in reversed(topo):
        forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=___)
    makespan = max(forward)
    cur = min(v for v in sources if forward[v] == ___)
    path = [cur]
    while True:
        rest = forward[cur] - durations[cur]
        nxt = [w for w in succ[cur] if forward[w] == ___]
        if not nxt:
            break
        cur = min(nxt)
        path.append(cur)
    bottleneck = min(path, key=lambda v: (___, v))
    return [makespan, [names[v] for v in path], names[bottleneck]]`,
      blanks: [
        { answers: ['0'], hint: '没有后继时取什么', width: 4 },
        { answers: ['makespan'], hint: '起点要等于哪个值', width: 10 },
        { answers: ['rest', 'forward[cur] - durations[cur]'], hint: '剩余耗时', width: 10 },
        { answers: ['-durations[v]'], hint: '耗时大者优先', width: 14 },
      ],
      cases: [
        { args: [['a', 'b', 'c', 'd'], [2, 1, 3, 1], [['a', 'b'], ['b', 'c'], ['b', 'd']]], expected: [6, ['a', 'b', 'c'], 'c'] },
        { args: [['only'], [5], []], expected: [5, ['only'], 'only'] },
        { args: [['a', 'b', 'c'], [3, 5, 2], []], expected: [5, ['b'], 'b'] },
        { args: [['x', 'y', 'z'], [1, 2, 3], [['x', 'y'], ['y', 'z']]], expected: [6, ['x', 'y', 'z'], 'z'] },
        { args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'c'], ['b', 'c']]], expected: [3, ['a', 'c'], 'a'] },
      ],
      explain: '第 4 个用例考并列路径：两条路径都是 3，取下标序列 [0,2]（a→c）而不是 [1,2]；瓶颈 a 和 b 都是 2，取下标更小的 a。',
      trap: 'tie',
    },
  ],
};
