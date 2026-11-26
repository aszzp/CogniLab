import type { GymItem } from '../types';

export const criticalPath: GymItem = {
  key: 'p1-critical-path',
  kind: 'pattern',
  order: 1,
  title: '关键路径与瓶颈',
  subtitle: '工期看最长路，关键路径看松弛，瓶颈只在关键路径上挑',
  theme: '51 · 数据处理流程关键路径与瓶颈判定',
  minutes: 16,
  level: 2,
  tags: ['DAG', '拓扑排序', '最长路', '松弛', '并列路径'],
  summary: '整条流水线的完工时间由最长的那条依赖链决定，而不是所有耗时相加；这条最长链就是关键路径，瓶颈只在关键路径上取耗时最大的环节。',
  sections: [
    {
      title: '为什么不是耗时总和',
      body: [
        '统一例子里六个环节耗时相加是 2+3+4+2+5+2=18，但真实工期只有 16：标注和增强都只依赖清洗，可以同时开工。',
        '流水线像接力赛：同一棒的选手要等前一棒交棒，但不同分队的选手可以同时跑；整场比赛结束的时间，取决于最慢的那条接力路线。',
        '所以工期不是总和，而是「从起点到终点最长的一条路」；这条路上任何一段变长，整场比赛就会变慢。',
        '想缩短工期，先看这条最长路：它就是瓶颈所在，旁边的支路再忙也帮不上。',
      ],
      note: '本卡的主线数据和正推/倒推表都用这组：采集2、清洗3、标注4、增强2、训练5、评测2。并列路径、归档支路这些变体会在这组数据上改耗时或加环节。',
    },
    {
      title: '正推：把依赖铺成时间轴',
      body: [
        '给每个环节记两个数：ES（最早开始时间，意思是所有前置都完成的最早时刻）和 EF（最早完成时间，等于 ES 加自身耗时）。',
        '从起点往终点推：一个环节的 ES 取它所有前置 EF 的最大值，因为要等最晚完成的那个前置。',
        '例子里训练的前置是标注（EF=9）和增强（EF=7），所以训练要等到第 9 天才能开始，ES=9、EF=14。',
      ],
      code: `环节  耗时  前置        ES  EF
采集  2     -           0   2
清洗  3     采集        2   5
标注  4     清洗        5   9
增强  2     清洗        5   7
训练  5     标注、增强  9   14
评测  2     训练        14  16`,
      note: '正推得到的最大 EF 就是工期 makespan=16。',
    },
    {
      title: '倒推：从终点往回挤',
      body: [
        '再从终点往起点推两个数：LF（最晚完成时间，意思是不拖工期的最晚完成时刻）和 LS（最晚开始时间，等于 LF 减自身耗时）。',
        '终点没有后继，LF 直接取工期；其他环节的 LF 取所有后继 LS 的最小值，因为要赶在最急的那个后继之前完成。',
        'slack（松弛，也叫浮动时间）等于 LS 减 ES：它是这个环节可以拖延而不影响工期的天数。',
      ],
      code: `环节  耗时  LS  LF  slack = LS - ES
评测  2     14  16  0
训练  5     9   14  0
标注  4     5   9   0
增强  2     7   9   2
清洗  3     2   5   0
采集  2     0   2   0`,
      note: '增强最早第 5 天能开始，最晚第 7 天开始也不拖工期，中间 2 天就是它的松弛。',
    },
    {
      title: '关键路径怎么读',
      body: [
        '把 slack 为 0 的环节连起来，能从起点一路走到终点的那条链就是关键路径；本例是 采集→清洗→标注→训练→评测，长度 2+3+4+5+2=16。',
        '关键路径上的环节没有余量：任何一个晚一天，工期就晚一天。增强的 slack 是 2，所以它不在这条链上。',
        '如果两条链并列最长，按「环节在 names 里的下标序列」字典序取最小：起点先选下标小的，之后每一步也在还能走满最长路的后继里选下标小的。',
        '并列时只返回一条路径即可，不要把所有关键路径都输出。',
      ],
      code: `假设增强的耗时也改成 4：
标注支路：[0,1,2,4,5]  采集→清洗→标注→训练→评测
增强支路：[0,1,3,4,5]  采集→清洗→增强→训练→评测
字典序更小 → 选标注支路`,
      note: '本例原数据的关键路径唯一；上面的并列只在增强改成 4 时出现。代码里的 tail[v] 是「从 v 到终点的最长剩余耗时」，沿它走出来的就是 slack 为 0 的那条链。',
    },
    {
      title: '瓶颈怎么判',
      body: [
        '瓶颈定义为关键路径上耗时最大的环节（并列时取 names 下标小的），本例是训练（5）；缩短它最直接地缩短工期。',
        '不在关键路径上的大任务不是瓶颈：比如再加一条清洗→归档、归档耗时 10 的支路，它虽然是全图最重，但所在路径只有 2+3+10=15，仍有 1 的松弛，缩短它不会让 16 变小。',
        '还要区分「资源瓶颈」：如果标注和增强由同一个人做、不能真并行，那就不是这张依赖图能表达的，需要把共享资源也建成依赖（例如标注→增强）。',
        '本卡默认资源无限，任务只受前置约束；在这个前提下，瓶颈只看关键路径。',
      ],
    },
    {
      title: '考场五步与边界',
      body: [
        '五步：① 建 index、succ、indeg；② 拓扑排序；③ 按拓扑序正推 ES/EF；④ 按逆拓扑序倒推 LS/LF 并算 slack；⑤ 读 slack 为 0 的链，在链上取瓶颈。',
        '复杂度是 O(n+m)，n 是环节数、m 是依赖数；用迭代栈拓扑排序，n 到 2000 也不要递归。',
        '边界一：单节点时 makespan 就是它的耗时，路径和瓶颈都是它自己；纯并行（没有依赖）时 makespan 取最大耗时，起点按下标最小裁决；并列路径按字典序取最小。',
        '边界二：叶子节点的 default 必须是 0，否则 max 空序列会报错；名字顺序不保证拓扑序，必须先排序再推。',
      ],
    },
  ],
  formula: {
    label: '正推与倒推',
    code: `正推：ES[v] = max(EF[前置], 默认 0)，EF[v] = ES[v] + 耗时[v]
倒推：LF[v] = min(LS[后继], 默认 工期)，LS[v] = LF[v] - 耗时[v]`,
  },
  skeleton: `def pipeline_critical_path(names, durations, deps):
    """返回 [工期, 关键路径环节名列表, 瓶颈环节名]。"""
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
    tail = [0] * n
    for v in reversed(topo):
        tail[v] = durations[v] + max((tail[w] for w in succ[v]), default=0)
    makespan = max(tail)
    cur = min(v for v in sources if tail[v] == makespan)
    path = [cur]
    while True:
        rest = tail[cur] - durations[cur]
        nxt = [w for w in succ[cur] if tail[w] == rest]
        if not nxt:
            break
        cur = min(nxt)
        path.append(cur)
    bottleneck = min(path, key=lambda v: (-durations[v], v))
    return [makespan, [names[v] for v in path], names[bottleneck]]`,
  traps: [
    { title: '输入不是拓扑序', wrong: '按 names 的顺序直接正推', right: '先拓扑排序，再按拓扑序推 ES/EF' },
    { title: '把全局最大当瓶颈', wrong: '在全图里挑耗时最大的环节', right: '只在关键路径（slack 为 0 的链）上挑' },
    { title: '并列路径裁决', wrong: '随便返回一条最长路', right: '按下标序列字典序取最小；瓶颈耗时并列也取下标小者' },
    { title: '忘记 default=0', wrong: 'max(tail[w] for w in succ[v]) 直接用在叶子上', right: '没有后继时取 0；单节点也要返回 [耗时, [名字], 名字]' },
    { title: '倒推取了 max', wrong: 'LF 取后继 LS 的最大值', right: 'LF 取后继 LS 的最小值，赶在最急的后继之前完成' },
  ],
  visual: 'critical-path',
  drills: [
    {
      id: 'p1-m1',
      type: 'mcq',
      prompt: '统一例子里（采集2、清洗3、标注4、增强2、训练5、评测2），训练的 ES 和 EF 分别是？',
      options: ['ES=5，EF=10', 'ES=9，EF=14', 'ES=7，EF=12', 'ES=9，EF=11'],
      answer: 1,
      explain: '训练有两个前置：标注的 EF=9、增强的 EF=7，要等晚的那个，所以 ES=9；EF=9+5=14。填 7 是只看了增强，填 5 是只看了清洗。',
      trap: 'order',
    },
    {
      id: 'p1-m2',
      type: 'mcq',
      prompt: '统一例子里增强的 ES=5、LS=7、slack=2，这说明了什么？',
      options: [
        '增强必须在第 2 天开始',
        '增强最晚可以比最早开始晚 2 天，且不影响 16 的工期',
        '增强的耗时是 2 天',
        '增强也在关键路径上，只是排在后面',
      ],
      answer: 1,
      explain: 'slack=LS-ES=7-5=2，表示最早第 5 天能开始，最晚第 7 天开始也不拖工期；有松弛就说明不在关键路径上。',
      trap: 'boundary',
    },
    {
      id: 'p1-m3',
      type: 'mcq',
      prompt: '统一例子的关键路径是 采集→清洗→标注→训练→评测。如果再加一条 清洗→归档、归档耗时 6 的支路，瓶颈应该取谁？',
      options: [
        '归档（6），因为它是全图耗时最大的环节',
        '训练（5），因为瓶颈只在关键路径上取',
        '标注（4），因为它在训练之前',
        '归档和训练并列',
      ],
      answer: 1,
      explain: '归档支路是 2+3+6=11，比工期 16 少 5，有松弛；它再重也不影响工期。瓶颈只看关键路径，训练 5 是路径上最大的。',
      trap: 'tie',
    },
    {
      id: 'p1-m4',
      type: 'mcq',
      prompt: '把统一例子里的增强耗时也改成 4（其余不变），两条支路一样长。按题面的字典序规则，关键路径取哪条？',
      options: [
        '采集→清洗→标注→训练→评测，因为下标序列 [0,1,2,4,5] 更小',
        '采集→清洗→增强→训练→评测，因为增强耗时更大',
        '两条都要输出',
        '任意一条，判题都算对',
      ],
      answer: 0,
      explain: '两条路径都是 16，比较环节下标序列：[0,1,2,4,5] < [0,1,3,4,5]，所以取标注那条。并列时不需要输出所有关键路径。',
      trap: 'tie',
    },
    {
      id: 'p1-m5',
      type: 'mcq',
      prompt: 'names 给的是 [训练, 采集, 清洗, 标注, 增强, 评测]，并不是拓扑序。直接按这个顺序正推 ES/EF 会怎样？',
      options: [
        '没关系，max 会自动修正',
        '训练排在前面时它的前置还没算，ES 会偏小，后面跟着错',
        '会进入死循环',
        '只会让 slack 变成负数',
      ],
      answer: 1,
      explain: '正推要求前置的 EF 已经确定。必须先拓扑排序（或用 DFS 后序），再按拓扑序递推；names 只决定输出顺序和并列裁决时的下标。',
      trap: 'order',
    },
    {
      id: 'p1-f1',
      type: 'fill',
      prompt: '补全正推。pred 存每个环节的前置下标（index 已建好），topo 是拓扑序。',
      code: `pred = [[] for _ in range(n)]
for a, b in deps:
    pred[index[b]].append(___)
es = [0] * n
ef = [0] * n
for v in topo:
    es[v] = max((ef[u] for u in pred[v]), default=___)
    ef[v] = ___ + durations[v]
makespan = ___(ef)`,
      blanks: [
        { answers: ['index[a]'], hint: 'a 的下标', width: 10 },
        { answers: ['0'], hint: '没有前置时取什么', width: 4 },
        { answers: ['es[v]'], hint: 'EF 等于谁加耗时', width: 8 },
        { answers: ['max'], hint: '工期取所有 EF 的什么', width: 6 },
      ],
      explain: '建前驱表时存的是前置 a 的下标；没有前置默认 0；EF=ES+耗时；工期取所有 EF 的最大值。统一例子里训练的两个前置 EF 是 9 和 7，max 之后 ES=9。',
      trap: 'order',
    },
    {
      id: 'p1-f2',
      type: 'fill',
      prompt: '补全倒推和 slack。延续上一题已经算好的 es/ef，topo 是拓扑序。',
      code: `ls = [0] * n
lf = [0] * n
for v in reversed(topo):
    lf[v] = min((ls[w] for w in succ[v]), default=___)
    ls[v] = lf[v] - ___
slack = [0] * n
for v in range(n):
    slack[v] = ls[v] - ___`,
      blanks: [
        { answers: ['makespan', 'max(ef)'], hint: '出口没有后继，LF 取什么', width: 10 },
        { answers: ['durations[v]'], hint: 'LS 等于 LF 减谁', width: 14 },
        { answers: ['es[v]'], hint: 'slack 等于 LS 减谁', width: 8 },
      ],
      explain: '出口没有后继，LF 默认取工期；LS=LF-耗时；slack=LS-ES。统一例子里增强 lf=9、ls=7、es=5，所以 slack=2。',
      trap: 'empty',
    },
    {
      id: 'p1-f3',
      type: 'fill',
      prompt: '补全关键路径重建。tail[v] 是从 v 到终点的最长耗时（含 v 自己）。',
      code: `cur = min(v for v in sources if tail[v] == ___)
path = [cur]
while True:
    rest = tail[cur] - ___
    nxt = [w for w in succ[cur] if tail[w] == ___]
    if not nxt:
        break
    cur = min(___)
    path.append(cur)`,
      blanks: [
        { answers: ['makespan', 'max(tail)'], hint: '起点要能走满工期', width: 10 },
        { answers: ['durations[cur]'], hint: '剩余耗时等于 tail 减谁', width: 16 },
        { answers: ['rest', 'tail[cur] - durations[cur]'], hint: '后继要正好接上剩余耗时', width: 8 },
        { answers: ['nxt'], hint: '并列时取下标小的', width: 6 },
      ],
      explain: '起点必须在「tail 等于工期」的起点里取下标最小的；每走一步，剩余耗时减少当前环节的耗时，后继的 tail 要正好等于剩余耗时；min(nxt) 保证并列时取下标小者。',
      trap: 'tie',
    },
    {
      id: 'p1-c1',
      type: 'code',
      prompt: '补全 4 个空并运行。tail[v] 表示从 v 到终点的最长耗时（含 v 自己），从终点倒着累加。判题覆盖 8 个用例：统一流水线、单节点、纯并行、链式、并列路径、并列瓶颈、names 乱序、非关键大支路。',
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
    tail = [0] * n
    for v in reversed(topo):
        tail[v] = durations[v] + max((tail[w] for w in succ[v]), default=___)
    makespan = max(tail)
    cur = min(v for v in sources if tail[v] == ___)
    path = [cur]
    while True:
        rest = tail[cur] - durations[cur]
        nxt = [w for w in succ[cur] if tail[w] == ___]
        if not nxt:
            break
        cur = min(nxt)
        path.append(cur)
    bottleneck = min(path, key=lambda v: (___, v))
    return [makespan, [names[v] for v in path], names[bottleneck]]`,
      blanks: [
        { answers: ['0'], hint: '没有后继时取什么', width: 4 },
        { answers: ['makespan', 'max(tail)'], hint: '起点要等于哪个值', width: 10 },
        { answers: ['rest', 'tail[cur] - durations[cur]'], hint: '剩余耗时', width: 8 },
        { answers: ['-durations[v]'], hint: '耗时大者优先', width: 14 },
      ],
      cases: [
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测'],
            [2, 3, 4, 2, 5, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [16, ['采集', '清洗', '标注', '训练', '评测'], '训练'],
        },
        { args: [['only'], [5], []], expected: [5, ['only'], 'only'] },
        { args: [['a', 'b', 'c'], [3, 5, 2], []], expected: [5, ['b'], 'b'] },
        { args: [['x', 'y', 'z'], [1, 2, 3], [['x', 'y'], ['y', 'z']]], expected: [6, ['x', 'y', 'z'], 'z'] },
        { args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'c'], ['b', 'c']]], expected: [3, ['a', 'c'], 'a'] },
        { args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'b'], ['b', 'c']]], expected: [5, ['a', 'b', 'c'], 'a'] },
        {
          args: [
            ['评测', '训练', '采集', '清洗', '标注', '增强'],
            [2, 5, 2, 3, 4, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [16, ['采集', '清洗', '标注', '训练', '评测'], '训练'],
        },
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测', '归档'],
            [2, 3, 4, 2, 5, 2, 6],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测'], ['清洗', '归档']],
          ],
          expected: [16, ['采集', '清洗', '标注', '训练', '评测'], '训练'],
        },
      ],
      explain: '第一个用例是统一流水线：tail 从终点往回累加，采集的 tail=16 就是工期，沿 tail 递减走到评测；瓶颈只在关键路径上取，训练 5 最大。并列路径用例选下标序列更小的 a→c；名字乱序用例证明必须先拓扑排序；最后的归档支路虽然单任务更长，但不在关键路径上。',
      trap: 'tie',
    },
    {
      id: 'p1-c2',
      type: 'code',
      prompt: '补全 5 个空：按 names 顺序返回每个环节的 [环节名, ES, EF, LS, LF, slack]。判题覆盖统一流水线（增强 slack=2）、单节点、纯并行、并列路径、names 乱序和非关键大支路。',
      fn: 'pipeline_schedule',
      starter: `def pipeline_schedule(names, durations, deps):
    n = len(names)
    index = {name: i for i, name in enumerate(names)}
    succ = [[] for _ in range(n)]
    pred = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in deps:
        u, v = index[a], index[b]
        succ[u].append(v)
        pred[v].append(u)
        indeg[v] += 1
    sources = [i for i in range(n) if indeg[i] == 0]
    stack, topo = list(sources), []
    while stack:
        v = stack.pop()
        topo.append(v)
        for w in succ[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                stack.append(w)
    es = [0] * n
    ef = [0] * n
    for v in topo:
        es[v] = max((ef[u] for u in pred[v]), default=___)
        ef[v] = es[v] + ___
    makespan = max(ef)
    ls = [0] * n
    lf = [0] * n
    for v in reversed(topo):
        lf[v] = min((ls[w] for w in succ[v]), default=___)
        ls[v] = lf[v] - ___
    return [[names[v], es[v], ef[v], ls[v], lf[v], ls[v] - ___] for v in range(n)]`,
      blanks: [
        { answers: ['0'], hint: '没有前置时 ES 取什么', width: 4 },
        { answers: ['durations[v]'], hint: 'EF = ES + 谁', width: 14 },
        { answers: ['makespan', 'max(ef)'], hint: '出口没有后继，LF 取什么', width: 10 },
        { answers: ['durations[v]'], hint: 'LS = LF - 谁', width: 14 },
        { answers: ['es[v]'], hint: 'slack = LS - 谁', width: 8 },
      ],
      cases: [
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测'],
            [2, 3, 4, 2, 5, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [
            ['采集', 0, 2, 0, 2, 0],
            ['清洗', 2, 5, 2, 5, 0],
            ['标注', 5, 9, 5, 9, 0],
            ['增强', 5, 7, 7, 9, 2],
            ['训练', 9, 14, 9, 14, 0],
            ['评测', 14, 16, 14, 16, 0],
          ],
        },
        { args: [['only'], [5], []], expected: [['only', 0, 5, 0, 5, 0]] },
        {
          args: [['a', 'b', 'c'], [3, 5, 2], []],
          expected: [
            ['a', 0, 3, 2, 5, 2],
            ['b', 0, 5, 0, 5, 0],
            ['c', 0, 2, 3, 5, 3],
          ],
        },
        {
          args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'c'], ['b', 'c']]],
          expected: [
            ['a', 0, 2, 0, 2, 0],
            ['b', 0, 2, 0, 2, 0],
            ['c', 2, 3, 2, 3, 0],
          ],
        },
        {
          args: [
            ['评测', '训练', '采集', '清洗', '标注', '增强'],
            [2, 5, 2, 3, 4, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [
            ['评测', 14, 16, 14, 16, 0],
            ['训练', 9, 14, 9, 14, 0],
            ['采集', 0, 2, 0, 2, 0],
            ['清洗', 2, 5, 2, 5, 0],
            ['标注', 5, 9, 5, 9, 0],
            ['增强', 5, 7, 7, 9, 2],
          ],
        },
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测', '归档'],
            [2, 3, 4, 2, 5, 2, 6],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测'], ['清洗', '归档']],
          ],
          expected: [
            ['采集', 0, 2, 0, 2, 0],
            ['清洗', 2, 5, 2, 5, 0],
            ['标注', 5, 9, 5, 9, 0],
            ['增强', 5, 7, 7, 9, 2],
            ['训练', 9, 14, 9, 14, 0],
            ['评测', 14, 16, 14, 16, 0],
            ['归档', 5, 11, 10, 16, 5],
          ],
        },
      ],
      explain: '正推用 pred 的 EF 最大值，倒推用 succ 的 LS 最小值，出口的 LF 默认取工期。统一例子里增强 ES=5、LS=7，所以 slack=2；并列路径 a→c 和 b→c 的两行 slack 都是 0，两条都关键。输出顺序固定按 names，不要按拓扑序。',
      trap: 'order',
    },
    {
      id: 'p1-c3',
      type: 'code',
      prompt: '补全 5 个空：返回 [工期, 瓶颈环节名]。瓶颈只在关键路径上取耗时最大的环节。判题覆盖统一流水线、全图最大但不在关键路径上的归档支路、单节点、纯并行、并列路径和 names 乱序。',
      fn: 'pipeline_bottleneck',
      starter: `def pipeline_bottleneck(names, durations, deps):
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
    tail = [0] * n
    for v in reversed(topo):
        tail[v] = durations[v] + max((tail[w] for w in succ[v]), default=___)
    makespan = max(tail)
    cur = min(v for v in sources if tail[v] == ___)
    path = [cur]
    while True:
        rest = tail[cur] - ___
        nxt = [w for w in succ[cur] if tail[w] == rest]
        if not nxt:
            break
        cur = ___(nxt)
        path.append(cur)
    best = min(path, key=lambda v: (___, v))
    return [makespan, names[best]]`,
      blanks: [
        { answers: ['0'], hint: '没有后继时取什么', width: 4 },
        { answers: ['makespan', 'max(tail)'], hint: '起点要等于哪个值', width: 10 },
        { answers: ['durations[cur]'], hint: '剩余耗时', width: 16 },
        { answers: ['min'], hint: '并列时取下标小的', width: 6 },
        { answers: ['-durations[v]'], hint: '耗时大者优先', width: 14 },
      ],
      cases: [
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测'],
            [2, 3, 4, 2, 5, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [16, '训练'],
        },
        {
          args: [
            ['采集', '清洗', '标注', '增强', '训练', '评测', '归档'],
            [2, 3, 4, 2, 5, 2, 10],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测'], ['清洗', '归档']],
          ],
          expected: [16, '训练'],
        },
        { args: [['only'], [5], []], expected: [5, 'only'] },
        { args: [['a', 'b', 'c'], [3, 5, 2], []], expected: [5, 'b'] },
        { args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'c'], ['b', 'c']]], expected: [3, 'a'] },
        { args: [['a', 'b', 'c'], [2, 2, 1], [['a', 'b'], ['b', 'c']]], expected: [5, 'a'] },
        {
          args: [
            ['评测', '训练', '采集', '清洗', '标注', '增强'],
            [2, 5, 2, 3, 4, 2],
            [['采集', '清洗'], ['清洗', '标注'], ['清洗', '增强'], ['标注', '训练'], ['增强', '训练'], ['训练', '评测']],
          ],
          expected: [16, '训练'],
        },
      ],
      explain: '第二个用例是反例：归档耗时 10 是全图最大，但它所在的 采集→清洗→归档 只有 15，比工期 16 少 1，所以不是瓶颈；瓶颈仍是关键路径上的训练 5。并列瓶颈时取 names 下标小的。',
      trap: 'tie',
    },
  ],
};
