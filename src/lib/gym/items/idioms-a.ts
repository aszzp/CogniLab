import type { GymItem } from '../types';

export const indexMap: GymItem = {
  key: 'i1-index-map',
  kind: 'idiom',
  order: 8,
  title: '名字 → 下标',
  subtitle: '建一张字典，把字符串名称换成列表下标',
  minutes: 3,
  level: 1,
  tags: ['enumerate', '字典推导'],
  summary: '图、并查集、矩阵题都先把名称映射成下标，后面所有数组操作都用整数，避免在列表里反复 index()。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '输入常给字符串名称（环节名、服务名、标注员名），但数组、邻接表、DP 都按下标访问。先建 index 字典，后面就不用 O(n) 的 list.index()。',
        'enumerate(names) 同时给下标和名字，字典推导一次成型。',
      ],
    },
  ],
  formula: { label: '一行建索引', code: 'index = {name: i for i, name in enumerate(names)}' },
  demo: {
    inputLabel: 'names',
    input: '["collect", "clean", "label"]',
    steps: [
      { label: 'enumerate', value: '(0,collect) (1,clean) (2,label)' },
      { label: '字典推导', value: 'name → i' },
    ],
    output: '{"collect":0, "clean":1, "label":2}',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i1-m1',
      type: 'mcq',
      prompt: '下面哪一行能正确建立「名字 → 下标」的映射？',
      options: [
        'index = {i: name for i, name in enumerate(names)}',
        'index = {name: i for i, name in enumerate(names)}',
        'index = [name for name in names]',
        'index = dict(names)',
      ],
      answer: 1,
      explain: '字典的键要是名字，值要是下标，所以是 {name: i ...}。第一个选项写反了；dict(names) 要求 names 是键值对。',
      trap: 'shape',
    },
    {
      id: 'i1-f1',
      type: 'fill',
      prompt: '补全索引字典。',
      code: `index = {name: ___ for ___, name in enumerate(names)}`,
      blanks: [
        { answers: ['i'], hint: '下标变量', width: 4 },
        { answers: ['i'], hint: '解包变量', width: 4 },
      ],
      explain: 'enumerate 解包成 (i, name)；字典值放 i，键放 name。',
      trap: 'shape',
    },
  ],
};

export const adjacency: GymItem = {
  key: 'i2-adjacency',
  kind: 'idiom',
  order: 9,
  title: '邻接表 + 入度',
  subtitle: '图题的第一行：每个节点一个后继列表，再统计入度',
  minutes: 4,
  level: 2,
  tags: ['列表推导', '图', '入度'],
  summary: 'succ = [[] for _ in range(n)] 给每个节点独立列表；indeg[b] += 1 统计前驱数。不要写 [[]] * n，那是同一个列表的 n 个引用。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '拓扑排序、关键路径、依赖检查都需要「从 a 能到哪些 b」。邻接表是 O(n+m) 的存法，比邻接矩阵省空间。',
        '入度是「还没完成的前驱数」：每条 a→b 的边让 indeg[b] 加 1；拓扑排序时每弹出一个节点，就把后继入度减 1。',
      ],
    },
  ],
  formula: {
    label: '建图',
    code: 'succ = [[] for _ in range(n)]\nindeg = [0] * n\nfor a, b in deps:\n    succ[index[a]].append(index[b])\n    indeg[index[b]] += 1',
  },
  demo: {
    inputLabel: 'deps',
    input: '[["a","b"], ["b","c"]]',
    steps: [
      { label: '建空表', value: 'succ = [[],[],[]]  indeg=[0,0,0]' },
      { label: '加边 a→b', value: 'succ[0]=[1]  indeg[1]=1' },
      { label: '加边 b→c', value: 'succ[1]=[2]  indeg[2]=1' },
    ],
    output: 'succ=[[1],[2],[]]  indeg=[0,1,1]',
  },
  visual: 'idiom',
  traps: [
    { title: '列表别名', wrong: 'succ = [[]] * n', right: 'succ = [[] for _ in range(n)]' },
  ],
  drills: [
    {
      id: 'i2-m1',
      type: 'mcq',
      prompt: '为什么建邻接表要用 `[[] for _ in range(n)]`，而不是 `[[]] * n`？',
      options: [
        '前者更快',
        '后者所有元素指向同一个列表，改一个会改全部',
        '前者占用内存更少',
        '两者完全等价',
      ],
      answer: 1,
      explain: '[[]] * n 复制的是列表引用，n 个位置共享同一个内层列表；append 到一个节点会污染所有节点。列表推导每次都新建 []。',
      trap: 'shape',
    },
    {
      id: 'i2-f1',
      type: 'fill',
      prompt: '补全建图与入度。',
      code: `succ = [[] for _ in range(n)]
indeg = [0] * n
for a, b in deps:
    succ[index[a]].append(index[b])
    indeg[index[b]] += ___`,
      blanks: [{ answers: ['1'], hint: '一条入边', width: 4 }],
      explain: '每条 a→b 的边让 b 的入度加 1；后续拓扑排序会把入度减回 0。',
      trap: 'order',
    },
  ],
};

export const weightedTally: GymItem = {
  key: 'i3-weighted-tally',
  kind: 'idiom',
  order: 10,
  title: '加权计数',
  subtitle: 'counts.get(label, 0) + weight：没有键时从 0 开始',
  minutes: 3,
  level: 1,
  tags: ['dict.get', '计数'],
  summary: '计数字典不要先判断 key 是否存在，直接 get(label, 0) + 权重；一行完成「取值 + 加权重 + 写回」。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '投票、词频、得分累计都用到「往字典的某个键上累加」。dict.get(key, 0) 在键不存在时返回 0，避免 KeyError。',
        '如果权重是浮点，默认值写 0.0；如果计数是整数，写 0。',
      ],
    },
  ],
  formula: { label: '一行累加', code: 'counts[label] = counts.get(label, 0) + weights[annotator]' },
  demo: {
    inputLabel: 'votes',
    input: 'a→X, b→X, c→Y；weights a=1,b=1,c=3',
    steps: [
      { label: 'a 投 X', value: 'X: 0 + 1 = 1' },
      { label: 'b 投 X', value: 'X: 1 + 1 = 2' },
      { label: 'c 投 Y', value: 'Y: 0 + 3 = 3' },
    ],
    output: '{"X":2, "Y":3}',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i3-m1',
      type: 'mcq',
      prompt: '`counts.get(label, 0)` 里的 0 表示什么？',
      options: ['字典的默认值，键不存在时返回 0', '把已有值清零', '只统计 0 分', '字典的长度'],
      answer: 0,
      explain: 'get 的第二个参数是默认值：键不存在时返回它，键存在时返回真实值。这样累加不需要先判断 in。',
      trap: 'empty',
    },
    {
      id: 'i3-f1',
      type: 'fill',
      prompt: '补全加权计数。',
      code: `counts[label] = counts.get(label, ___) + weights[annotator]`,
      blanks: [{ answers: ['0', '0.0'], hint: '整数计数从几开始', width: 4 }],
      explain: '整数计数默认 0；如果是浮点权重，写 0.0 也可以。',
      trap: 'empty',
    },
  ],
};

export const grouping: GymItem = {
  key: 'i4-setdefault',
  kind: 'idiom',
  order: 11,
  title: '一行分组',
  subtitle: 'setdefault(key, []).append(x)：取列表、没有就建',
  minutes: 3,
  level: 1,
  tags: ['setdefault', '分组'],
  summary: '按 key 分组时，setdefault 一次完成「取列表 / 建空列表」，然后直接 append；比 if key not in d 少两行。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '告警按 (service, metric) 分组、标注按 sample 分组、日志按用户分组，都是同一个模式。',
        'setdefault(key, []) 返回已有的列表；键不存在时先插入 [] 再返回它。所以可以链式 append。',
      ],
    },
  ],
  formula: { label: '一行分组', code: 'by_key.setdefault(key, []).append(value)' },
  demo: {
    inputLabel: 'alerts',
    input: '(0,s,cpu), (5,s,cpu), (6,s,mem)',
    steps: [
      { label: 'cpu 第一条', value: '(s,cpu) → [(0,..)]' },
      { label: 'cpu 第二条', value: '(s,cpu) → [(0,..),(5,..)]' },
      { label: 'mem 第一条', value: '(s,mem) → [(6,..)]' },
    ],
    output: '{(s,cpu): 2 条, (s,mem): 1 条}',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i4-m1',
      type: 'mcq',
      prompt: '`by_key.setdefault(key, []).append(value)` 的返回值是什么？',
      options: ['None', '这个 key 对应的列表', '整个字典', '新插入的元素'],
      answer: 1,
      explain: 'setdefault 返回 key 对应的值；如果 key 不存在，先插入默认值 [] 再返回它。所以可以直接接着 .append。',
      trap: 'shape',
    },
    {
      id: 'i4-f1',
      type: 'fill',
      prompt: '补全分组。',
      code: `by_key = {}
for key, value in items:
    by_key.___(key, []).append(value)`,
      blanks: [{ answers: ['setdefault'], hint: '取或建', width: 12 }],
      explain: 'setdefault(key, []) 取列表；没有就建一个空列表。',
      trap: 'shape',
    },
  ],
};

export const multiKeySort: GymItem = {
  key: 'i5-multi-key-sort',
  kind: 'idiom',
  order: 12,
  title: '多键排序',
  subtitle: 'key=lambda x: (-x[0], x[1])：第一键降序，第二键升序',
  minutes: 4,
  level: 2,
  tags: ['sorted', 'lambda', '并列'],
  summary: '要按分数降序、同分按下标升序，就把 key 写成 (-score, index)。负号只加在需要降序的那一项上。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '阈值扫描要按置信度从高到低；配额分配要按余数从大到小；同时题目还规定并列时取小下标。',
        'key 返回元组，Python 按元组逐项比较。把需要降序的项取负，其他项保持升序。',
        '排序是稳定的，但稳定排序不等于题目要求的并列规则；并列规则最好显式写进 key。',
      ],
    },
  ],
  formula: { label: '两键排序', code: 'sorted(items, key=lambda x: (-x[0], x[1]))' },
  demo: {
    inputLabel: 'items',
    input: '[(0.9, 2), (0.8, 0), (0.9, 1)]',
    steps: [
      { label: '取负第一键', value: '(-0.9,2) (-0.8,0) (-0.9,1)' },
      { label: '元组排序', value: '(-0.9,1) (-0.9,2) (-0.8,0)' },
    ],
    output: '[(0.9,1), (0.9,2), (0.8,0)]',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i5-m1',
      type: 'mcq',
      prompt: '要按分数降序、同分按下标升序，key 应该怎么写？',
      options: ['lambda x: (x[0], x[1])', 'lambda x: (-x[0], x[1])', 'lambda x: (x[0], -x[1])', 'lambda x: (-x[0], -x[1])'],
      answer: 1,
      explain: '分数降序给 x[0] 加负号；下标升序保持 x[1] 原样。两个都加负号会让下标也降序。',
      trap: 'tie',
    },
    {
      id: 'i5-f1',
      type: 'fill',
      prompt: '补全排序键。',
      code: `pairs = sorted(zip(scores, labels), key=lambda p: ___)`,
      blanks: [{ answers: ['-p[0]'], hint: '分数从高到低', width: 8 }],
      explain: 'p[0] 是分数，加负号变降序；如果还要按下标升序，写 (-p[0], p[1])。',
      trap: 'tie',
    },
  ],
};
