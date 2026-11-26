import type { GymItem } from '../types';

export const allocation: GymItem = {
  key: 'p6-allocation',
  kind: 'pattern',
  order: 6,
  title: '分层配额与最大余数',
  subtitle: '先保底，再按容量/权重分；余数大者先，并列取小下标',
  theme: '56 · 分层抽样配额分配',
  minutes: 12,
  level: 3,
  tags: ['最大余数法', '尼曼分配', '整数除法', '上限'],
  summary: '每层先拿 min(min_each, size) 保底，剩余名额按容量或 size×标准差 的比例分；整数商分完，余数从大到小补，并列取下标小的层。',
  sections: [
    {
      title: '最大余数法的三步',
      body: [
        '① 保底：quota[i] = min(min_each, size[i])，每层不能超过自己的总量。',
        '② 按比例分整数商：base[i] = remaining × capacity[i] // pool；capacity = size - quota，pool 是所有 capacity 之和。',
        '③ 分余数：left = remaining - sum(base)；把 left 个名额给余数最大的层，余数相同取下标小的。',
      ],
      code: 'base = [remaining * c // pool for c in capacity]\nremainder = [remaining * c % pool for c in capacity]\nleft = remaining - sum(base)\nfor i in sorted(range(len(strata)), key=lambda i: (-remainder[i], i))[:left]:\n    quota[i] += 1',
    },
    {
      title: '尼曼分配与加权估计',
      body: [
        '尼曼分配把比例权重换成 size × std（层内标准差）：weight[i] = size[i] * std[i]。分完之后如果某层超过自己的总量，就把该层分满，把多出来的名额还给其他层，再循环。',
        '加权估计的公式是 estimate = Σ(size × mean) / Σsize；简单平均是各层均值再平均。自加权（self-weighting）指各层权重 size/drawn 相等。',
        '样本量题用 n0 = z²p(1-p)/moe²，再做有限总体校正 n0 / (1 + (n0-1)/N)，最后向上取整。',
      ],
    },
    {
      title: '三个坑',
      body: [
        '① 保底不能超过层容量：min(min_each, size)，否则会出现负容量。',
        '② 余数分配要处理并列：(-remainder[i], i) 让余数大者先、并列时小下标先。',
        '③ 尼曼分配可能让某层超过上限；超限层先分满，剩余名额进入下一轮，不能直接截断。',
      ],
    },
  ],
  formula: {
    label: '最大余数法',
    code: 'quota = min(min_each, size)\nbase = remaining * capacity // pool\nleft = remaining - sum(base)\n按 (-remainder, index) 补 left 个',
  },
  skeleton: `def allocate_quotas(strata, total, min_each):
    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    pool = sum(capacity)
    if remaining > 0 and pool > 0:
        base = [remaining * c // pool for c in capacity]
        remainder = [remaining * c % pool for c in capacity]
        quota = [q + b for q, b in zip(quota, base)]
        left = remaining - sum(base)
        for i in sorted(range(len(strata)), key=lambda i: (-remainder[i], i))[:left]:
            quota[i] += 1
    return quota`,
  traps: [
    { title: '保底超容量', wrong: 'quota = min_each', right: 'min(min_each, size)' },
    { title: '余数并列', wrong: '按输入顺序补', right: '按 (-remainder, index) 排序' },
    { title: '尼曼超上限', wrong: '直接截断到 size', right: '超限层分满，名额回流下一轮' },
  ],
  visual: 'allocation',
  drills: [
    {
      id: 'p6-m1',
      type: 'mcq',
      prompt: '三层容量 [10,20,30]，总配额 20，每层保底 2。最大余数法分配结果是什么？',
      options: ['[4,6,10]', '[4,7,9]', '[2,8,10]', '[5,7,8]'],
      answer: 1,
      explain: '保底 [2,2,2]，剩余 14，容量 [8,18,28]，pool=54。整数商 [2,4,7]，余数 [4,36,14]；还剩 1 个名额给余数最大的第二层，最终 [4,7,9]。',
      trap: 'precision',
    },
    {
      id: 'p6-m2',
      type: 'mcq',
      prompt: '尼曼分配的比例权重应该怎么算？',
      options: ['只看层容量 size', 'size × 层内标准差 std', '只看层内均值', 'size ÷ std'],
      answer: 1,
      explain: '尼曼分配同时考虑层的大小和层内差异：weight = size × std。差异大的层需要更多样本，才能达到同样的估计精度。',
      trap: 'precision',
    },
    {
      id: 'p6-m3',
      type: 'mcq',
      prompt: '两个层的余数相同，还剩 1 个名额。应该给谁？',
      options: ['给容量大的层', '给输入顺序靠前的层', '给下标小的层', '随机给一层'],
      answer: 2,
      explain: '题目通常规定并列时取下标较小者。排序键写成 (-remainder[i], i) 就能同时表达「余数大者先」和「并列小下标先」。',
      trap: 'tie',
    },
    {
      id: 'p6-f1',
      type: 'fill',
      prompt: '补全最大余数法。',
      code: `quota = [min(min_each, size) for _, size in strata]
capacity = [size - q for (_, size), q in zip(strata, quota)]
remaining = total - sum(quota)
pool = sum(capacity)
if remaining > 0 and pool > 0:
    base = [remaining * c ___ pool for c in capacity]
    remainder = [remaining * c ___ pool for c in capacity]
    quota = [q + b for q, b in zip(quota, base)]
    left = remaining - sum(base)
    for i in sorted(range(len(strata)), key=lambda i: (___, i))[:left]:
        quota[i] += 1`,
      blanks: [
        { answers: ['//'], hint: '整数商', width: 4 },
        { answers: ['%'], hint: '余数', width: 4 },
        { answers: ['-remainder[i]'], hint: '余数大者先', width: 14 },
      ],
      explain: '整数商用 //，余数用 %；排序键第一项取负，让余数大的排在前面，第二项 i 保证并列时小下标先。',
      trap: 'tie',
    },
    {
      id: 'p6-f2',
      type: 'fill',
      prompt: '补全尼曼分配的权重和上限回流。',
      code: `size = [row[1] for row in strata]
weight = [row[1] * ___ for row in strata]
quota = [min(min_each, s) for s in size]
pending = [i for i in range(len(strata)) if quota[i] < size[i]]
remaining = total - sum(quota)
while remaining > 0 and pending:
    weight_sum = sum(weight[i] for i in pending)
    share = {i: remaining * weight[i] // weight_sum for i in pending}
    rest = {i: remaining * weight[i] % weight_sum for i in pending}
    left = remaining - sum(share.values())
    for i in sorted(pending, key=lambda i: (-rest[i], i))[:left]:
        share[i] += 1
    over = [i for i in pending if quota[i] + share[i] > ___]
    if not over:
        for i in pending:
            quota[i] += share[i]
        remaining = 0
    else:
        for i in over:
            remaining -= ___ - quota[i]
            quota[i] = size[i]
            pending.remove(i)`,
      blanks: [
        { answers: ['row[2]'], hint: '层内标准差', width: 8 },
        { answers: ['size[i]'], hint: '层容量上限', width: 8 },
        { answers: ['size[i]'], hint: '让出的名额', width: 8 },
      ],
      explain: 'weight = size × std（row[2]）；超过 size[i] 的层直接分满，把超出部分从 remaining 里扣掉，剩下的层进入下一轮。',
      trap: 'boundary',
    },
    {
      id: 'p6-c1',
      type: 'code',
      prompt: '补全 3 个空并运行。判题覆盖正常分配、总数等于保底、单层容量上限和余数并列。',
      fn: 'allocate_quotas',
      starter: `def allocate_quotas(strata, total, min_each):
    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    pool = sum(capacity)
    if remaining > 0 and pool > 0:
        base = [remaining * c ___ pool for c in capacity]
        remainder = [remaining * c ___ pool for c in capacity]
        quota = [q + b for q, b in zip(quota, base)]
        left = remaining - sum(base)
        for i in sorted(range(len(strata)), key=lambda i: (___, i))[:left]:
            quota[i] += 1
    return quota`,
      blanks: [
        { answers: ['//'], hint: '整数商', width: 4 },
        { answers: ['%'], hint: '余数', width: 4 },
        { answers: ['-remainder[i]'], hint: '余数大者先', width: 14 },
      ],
      cases: [
        { args: [[['a', 10], ['b', 20], ['c', 30]], 20, 2], expected: [4, 7, 9] },
        { args: [[['a', 1], ['b', 1]], 2, 2], expected: [1, 1] },
        { args: [[['a', 2]], 5, 2], expected: [2] },
        { args: [[['a', 10], ['b', 10]], 5, 1], expected: [3, 2] },
      ],
      explain: '第三个用例只有一层，容量 2 已经分满，剩余名额不再分；第四个用例两层余数相同，1 个名额按下标给小 a。',
      trap: 'tie',
    },
  ],
};
