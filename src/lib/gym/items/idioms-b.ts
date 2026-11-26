import type { GymItem } from '../types';

export const emptySafeMax: GymItem = {
  key: 'i6-empty-safe-max',
  kind: 'idiom',
  order: 13,
  title: '空安全极值',
  subtitle: 'max(..., default=0)：没有后继时不要炸',
  minutes: 3,
  level: 1,
  tags: ['max', 'default', '空输入'],
  summary: '叶子节点没有后继，直接 max(空生成器) 会抛 ValueError；加 default=0 是图题里最常见的空安全写法。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '关键路径的 forward[v] = duration + 后继 forward 的最大值。叶子节点没有后继，max 的参数为空，必须给默认值。',
        '同理，min 在没有候选时也要给 default；但如果逻辑上一定非空，就不要滥用默认值，否则会掩盖错误。',
      ],
    },
  ],
  formula: { label: '空安全', code: 'max((forward[w] for w in succ[v]), default=0)' },
  demo: {
    inputLabel: 'succ[v]',
    input: '[]（叶子节点）',
    steps: [
      { label: '生成器', value: '没有元素' },
      { label: 'max', value: 'ValueError' },
      { label: '加 default', value: '返回 0' },
    ],
    output: 'forward[v] = duration[v] + 0',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i6-m1',
      type: 'mcq',
      prompt: '叶子节点没有后继时，`max(forward[w] for w in succ[v])` 会怎样？',
      options: ['返回 0', '返回 None', '抛 ValueError', '返回 -1'],
      answer: 2,
      explain: 'max 对空序列没有定义，会抛 ValueError。要么加 default=0，要么先判断 if succ[v]。',
      trap: 'empty',
    },
    {
      id: 'i6-f1',
      type: 'fill',
      prompt: '补全空安全最大值。',
      code: `forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=___)`,
      blanks: [{ answers: ['0'], hint: '没有后继时的贡献', width: 4 }],
      explain: '没有后继就没有额外耗时，默认贡献 0。',
      trap: 'empty',
    },
  ],
};

export const tieWinners: GymItem = {
  key: 'i7-tie-winners',
  kind: 'idiom',
  order: 14,
  title: '平票检测',
  subtitle: '先找最高分，再收集所有等于最高分的标签',
  minutes: 4,
  level: 2,
  tags: ['max', 'items', '平票'],
  summary: 'max(counts.values()) 只给最高分；要判断是否并列，必须再遍历 items，收集所有等于最高分的键。长度 1 才是唯一赢家。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '投票合并里，平票要转人工。只取 max 的键会默认选第一个，掩盖平票。',
        '正确顺序：top = max(counts.values())；winners = [k for k, v in counts.items() if v == top]；len(winners) == 1 才采纳。',
      ],
    },
  ],
  formula: {
    label: '平票检测',
    code: 'top = max(counts.values())\nwinners = [k for k, v in counts.items() if v == top]\nresult = winners[0] if len(winners) == 1 else "ARBITRATE"',
  },
  demo: {
    inputLabel: 'counts',
    input: '{"X": 2, "Y": 2, "Z": 1}',
    steps: [
      { label: '最高分', value: 'top = 2' },
      { label: '收集', value: '["X", "Y"]' },
      { label: '唯一性', value: 'len = 2 → 平票' },
    ],
    output: '"ARBITRATE"',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i7-m1',
      type: 'mcq',
      prompt: 'counts 为 {"X":2, "Y":2, "Z":1}，正确的裁决是？',
      options: ['X，因为先出现', 'Y，因为字典序靠后', 'ARBITRATE，因为最高分有两个', 'Z，因为分数最低'],
      answer: 2,
      explain: 'top=2，winners 是 X 和 Y，长度 2，说明平票，必须转人工。不能按字典顺序或输入顺序取第一个。',
      trap: 'tie',
    },
    {
      id: 'i7-f1',
      type: 'fill',
      prompt: '补全平票检测。',
      code: `top = max(counts.values())
winners = [label for label, score in counts.items() if score == ___]
result = winners[0] if len(winners) == ___ else "ARBITRATE"`,
      blanks: [
        { answers: ['top'], hint: '最高分', width: 6 },
        { answers: ['1'], hint: '唯一赢家', width: 4 },
      ],
      explain: '比较每一项是否等于最高分；只有一个赢家才采纳，否则转人工。',
      trap: 'tie',
    },
  ],
};

export const largestRemainder: GymItem = {
  key: 'i8-largest-remainder',
  kind: 'idiom',
  order: 15,
  title: '整数商与余数',
  subtitle: '// 分整数份额，% 算余数，再按余数补名额',
  minutes: 4,
  level: 2,
  tags: ['//', '%', '最大余数法'],
  summary: '按比例分配整数名额时，base = remaining * c // pool 是保底商，remainder = ... % pool 是余数；left 个名额按余数从大到小补。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '分层配额、比例分配、座位分配都不能出现小数名额。先用整数除法算出每层至少拿到的部分，再把剩下的名额按余数分配。',
        'base 之和可能小于 remaining，差额就是 left；余数越大，说明这一层被整数除法「截掉」得越多，越应该优先补。',
      ],
    },
  ],
  formula: {
    label: '商与余数',
    code: 'base = remaining * c // pool\nremainder = remaining * c % pool\nleft = remaining - sum(base)',
  },
  demo: {
    inputLabel: 'remaining=14, capacity=[8,18,28], pool=54',
    input: '14×8=112, 14×18=252, 14×28=392',
    steps: [
      { label: '整数商', value: '[2, 4, 7]，和 13' },
      { label: '余数', value: '[4, 36, 14]' },
      { label: '补 1 个', value: '给余数 36 的第二层' },
    ],
    output: 'base = [2, 5, 7]',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i8-m1',
      type: 'mcq',
      prompt: '`remaining * c // pool` 和 `remaining * c % pool` 分别是什么？',
      options: ['余数和商', '商和余数', '都算商', '都算余数'],
      answer: 1,
      explain: '// 是向下取整的整数商，% 是余数。两者满足 a = (a // b) * b + a % b。',
      trap: 'precision',
    },
    {
      id: 'i8-f1',
      type: 'fill',
      prompt: '补全商与余数。',
      code: `base = [remaining * c ___ pool for c in capacity]
remainder = [remaining * c ___ pool for c in capacity]
left = remaining - sum(base)`,
      blanks: [
        { answers: ['//'], hint: '整数商', width: 4 },
        { answers: ['%'], hint: '余数', width: 4 },
      ],
      explain: '先算商，再算余数；left 是整数商分完后还剩下的名额。',
      trap: 'precision',
    },
  ],
};

export const plateau: GymItem = {
  key: 'i9-plateau',
  kind: 'idiom',
  order: 16,
  title: '同分平台',
  subtitle: '分数相同的会话必须同进同出，只在组末尾评估',
  minutes: 4,
  level: 2,
  tags: ['continue', '平台', '阈值'],
  summary: '降序扫描时，如果下一条分数和当前相同，就先 continue，等这一组最后一条再评估；否则会把同分组拆开，阈值不合法。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '置信度相同的会话不能被阈值拆成两半。扫描到组内非末尾时继续累加，不评估；到组末尾（下一条分数不同或已到末尾）才检查约束。',
        '判断条件必须同时看「还有下一条」和「下一条分数相同」，否则会越界。',
      ],
    },
  ],
  formula: {
    label: '平台判断',
    code: 'if i + 1 < n and pairs[i + 1][0] == score:\n    continue\n# 到这里才是这一组的末尾，可以评估',
  },
  demo: {
    inputLabel: 'pairs',
    input: '[0.9, 0.9, 0.8]',
    steps: [
      { label: '第 1 条', value: '下一条也是 0.9 → continue' },
      { label: '第 2 条', value: '下一条是 0.8 → 评估 0.9 组' },
      { label: '第 3 条', value: '末尾 → 评估 0.8 组' },
    ],
    output: '只在 (0.9 组末尾) 和 (0.8) 评估',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i9-m1',
      type: 'mcq',
      prompt: '为什么扫描到同分组中间时要 continue？',
      options: [
        '为了跳过错误数据',
        '因为同分必须同进同出，切在中间不合法',
        '为了提高运行速度',
        '因为 continue 会结束循环',
      ],
      answer: 1,
      explain: '阈值只能落在两个不同分数之间；同分组的中间不是一个合法切点。continue 让循环继续累加，等组末尾再统一评估。',
      trap: 'tie',
    },
    {
      id: 'i9-f1',
      type: 'fill',
      prompt: '补全平台判断。',
      code: `if i + 1 < n and pairs[i + 1][0] == ___:
    continue`,
      blanks: [{ answers: ['score'], hint: '当前分数', width: 8 }],
      explain: '比较下一条分数和当前分数；相同说明还在同一平台。',
      trap: 'tie',
    },
  ],
};

export const ceilFloor: GymItem = {
  key: 'i10-ceil-floor',
  kind: 'idiom',
  order: 17,
  title: 'ceil 与 floor',
  subtitle: '能放几个用 //，需要几个用 ceil',
  minutes: 3,
  level: 1,
  tags: ['math.ceil', '//', '容量'],
  summary: '容量题里两个方向容易写反：一张卡能放几个副本是 floor；达到目标需要几张卡是 ceil。零除要先判断。',
  sections: [
    {
      title: '它解决什么',
      body: [
        '副本数受显存硬限制：72GB 可用、每个 10GB，只能放 7 个，余下 2GB 不够一个，用 //。',
        '卡数是需求：560 QPS/卡，目标 100 QPS，1 张就够；目标 600 QPS 就需要 2 张，用 math.ceil。',
      ],
    },
  ],
  formula: {
    label: '两个方向',
    code: 'replicas = usable // model_mem_gb   # 能放几个\ngpus = math.ceil(target_qps / qps_per_gpu)  # 需要几个',
  },
  demo: {
    inputLabel: 'usable=72, model=10; target=600, qps_per_gpu=560',
    input: '72 // 10; 600 / 560',
    steps: [
      { label: '副本', value: '7（余 2GB 不够）' },
      { label: '卡数', value: 'ceil(1.071) = 2' },
    ],
    output: 'replicas=7, gpus=2',
  },
  visual: 'idiom',
  drills: [
    {
      id: 'i10-m1',
      type: 'mcq',
      prompt: '可用显存 72GB，模型 10GB，目标 600 QPS，单卡 560 QPS。副本数和卡数分别是？',
      options: ['7 和 1', '8 和 2', '7 和 2', '7.2 和 1.07'],
      answer: 2,
      explain: '72//10=7 个副本（余 2GB 不够一个）；600/560=1.071，向上取整需要 2 张卡。',
      trap: 'precision',
    },
    {
      id: 'i10-f1',
      type: 'fill',
      prompt: '补全两个方向的取整。',
      code: `replicas = int(usable ___ model_mem_gb)
gpus = math.___(target_qps / qps_per_gpu)`,
      blanks: [
        { answers: ['//'], hint: '能放几个', width: 4 },
        { answers: ['ceil'], hint: '需要几个', width: 6 },
      ],
      explain: '放得下才算，所以用 //；差一点也要多一张，所以用 ceil。',
      trap: 'precision',
    },
  ],
};
