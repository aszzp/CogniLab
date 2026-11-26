import type { GymItem } from '../types';

export const labelMerge: GymItem = {
  key: 'p2-label-merge',
  kind: 'pattern',
  order: 2,
  title: '加权投票与平票仲裁',
  subtitle: '谁权重高听谁的；平票不是取第一个，是转人工',
  theme: '52 · 多标注员标签合并与仲裁',
  minutes: 10,
  level: 1,
  tags: ['加权投票', '仲裁', '字典计数', '排序输出'],
  summary: '按样本把票聚起来，权重只加给可信标注员；最高分唯一才自动采纳，平票或没有有效票一律 ARBITRATE/REVIEW。',
  sections: [
    {
      title: '题目在问什么',
      body: [
        '给若干条「样本、标注员、标签」的投票，以及每个标注员的权重。要求按样本合并：得分最高的标签获胜；如果最高分并列，或者这个样本没有有效票，就转人工仲裁。',
        '有些变体会先给一批金标准题，用标注员在金标准上的准确率决定谁可信；低质量标注员的票直接作废，作废后没有票的样本同样转人工。',
      ],
    },
    {
      title: '心智模型：先聚票，再裁决',
      body: [
        '第一层字典按样本分组，第二层字典按标签累计权重。遍历投票时同时维护一个 seen 列表，最后按样本名排序输出，保证结果稳定。',
        '裁决只有三种结局：唯一最高分 → 采纳；最高分并列 → 转人工；一条有效票都没有 → 转人工。不要把「字典里第一个」当成赢家。',
      ],
      code: 'counts[label] = counts.get(label, 0) + weights[annotator]',
    },
    {
      title: '三个坑',
      body: [
        '① 未知标注员不在 weights 里：这张票忽略，但不能把样本丢掉；如果所有票都被忽略，样本仍然要输出 ARBITRATE。',
        '② 平票检测要用「最高分出现了几次」，不是「最大值是多少」。',
        '③ 输出按样本名排序；输入顺序不等于输出顺序。',
      ],
    },
  ],
  formula: {
    label: '加权计数与唯一最大',
    code: 'top = max(counts.values())\nwinners = [label for label, score in counts.items() if score == top]\nresult = winners[0] if len(winners) == 1 else "ARBITRATE"',
  },
  skeleton: `def merge_labels(votes, weights):
    tally, seen = {}, []
    for sample, annotator, label in votes:
        if sample not in tally:
            tally[sample] = {}
            seen.append(sample)
        if annotator not in weights:
            continue
        counts = tally[sample]
        counts[label] = counts.get(label, 0) + weights[annotator]
    result = []
    for sample in sorted(seen):
        counts = tally[sample]
        if not counts:
            result.append([sample, "ARBITRATE"])
            continue
        top = max(counts.values())
        winners = [label for label, score in counts.items() if score == top]
        result.append([sample, winners[0] if len(winners) == 1 else "ARBITRATE"])
    return result`,
  traps: [
    { title: '平票取第一个', wrong: 'winners[0] 直接返回', right: 'len(winners) == 1 才采纳，否则 ARBITRATE' },
    { title: '丢掉无效样本', wrong: '没有有效票就不输出', right: '仍然输出 [sample, "ARBITRATE"]' },
    { title: '输出顺序', wrong: '按输入顺序返回', right: '按样本名 sorted 后返回' },
  ],
  visual: 'vote-merge',
  drills: [
    {
      id: 'p2-m1',
      type: 'mcq',
      prompt: '样本 s1 有三票：a 标 X、b 标 X、c 标 Y；权重 a=1、b=1、c=3。合并结果是什么？',
      options: ['X，因为票数多', 'Y，因为权重和 3 > 2', 'ARBITRATE，因为平票', 'Y，因为 c 的字典序靠后'],
      answer: 1,
      explain: 'X 的权重和是 1+1=2，Y 的权重和是 3。唯一最高分是 Y，所以采纳 Y。票数多不等于权重高。',
      trap: 'tie',
    },
    {
      id: 'p2-m2',
      type: 'mcq',
      prompt: '样本 s2 只有两票：a 标 X、b 标 Y，权重都为 1。正确输出是？',
      options: ['X', 'Y', 'ARBITRATE', '丢掉 s2'],
      answer: 2,
      explain: '最高分并列，没有任何标签唯一获胜，必须转人工仲裁。不要按输入顺序取第一个。',
      trap: 'tie',
    },
    {
      id: 'p2-m3',
      type: 'mcq',
      prompt: '样本 s3 的两票来自 z 和 a，但 weights 里只有 a。应该怎么处理？',
      options: ['z 的票按权重 1 算', 'z 的票忽略；a 的票有效，按剩余票裁决', '整个样本丢掉', '报错退出'],
      answer: 1,
      explain: '未知标注员没有可信权重，票作废；a 的票仍然有效。如果作废后一张有效票都不剩，才输出 ARBITRATE。',
      trap: 'empty',
    },
    {
      id: 'p2-f1',
      type: 'fill',
      prompt: '补全加权计数与平票裁决。',
      code: `tally = {}
for sample, annotator, label in votes:
    if sample not in tally:
        tally[sample] = {}
    if annotator not in weights:
        ___
    counts = tally[sample]
    counts[label] = counts.get(label, ___) + weights[annotator]
result = []
for sample in sorted(tally):
    counts = tally[sample]
    if not counts:
        result.append([sample, "ARBITRATE"])
        continue
    top = max(counts.___())
    winners = [label for label, score in counts.items() if score == ___]
    result.append([sample, winners[0] if len(winners) == ___ else "ARBITRATE"])`,
      blanks: [
        { answers: ['continue'], hint: '跳过这张票', width: 10 },
        { answers: ['0'], hint: '第一次计数', width: 4 },
        { answers: ['values'], hint: '取所有得分', width: 8 },
        { answers: ['top'], hint: '最高分', width: 6 },
        { answers: ['1'], hint: '唯一获胜', width: 4 },
      ],
      explain: '未知标注员直接 continue；计数从 0 开始；平票检测比较的是最高分 top，唯一性看 len(winners) 是否为 1。',
      trap: 'tie',
    },
    {
      id: 'p2-f2',
      type: 'fill',
      prompt: '补全「没有有效票」的分支与输出结构。',
      code: `for sample in sorted(seen):
    counts = tally[sample]
    if not counts:
        result.append([sample, ___])
        continue
    top = max(counts.values())
    winners = [label for label, score in counts.items() if score == top]
    result.append([sample, winners[0] if len(winners) == 1 else ___])`,
      blanks: [
        { answers: ['"ARBITRATE"', "'ARBITRATE'"], hint: '转人工', width: 12 },
        { answers: ['"ARBITRATE"', "'ARBITRATE'"], hint: '平票也转人工', width: 12 },
      ],
      explain: '两条分支的结局相同：没有有效票 → 转人工；平票 → 转人工。区别只在于是否还保留样本。',
      trap: 'empty',
    },
    {
      id: 'p2-c1',
      type: 'code',
      prompt: '补全 5 个空并运行。判题覆盖权重获胜、平票、未知标注员、全无效票和输出排序。',
      fn: 'merge_labels',
      starter: `def merge_labels(votes, weights):
    tally, seen = {}, []
    for sample, annotator, label in votes:
        if sample not in tally:
            tally[sample] = {}
            seen.append(sample)
        if annotator not in weights:
            ___
        counts = tally[sample]
        counts[label] = counts.get(label, ___) + weights[annotator]
    result = []
    for sample in sorted(seen):
        counts = tally[sample]
        if not counts:
            result.append([sample, ___])
            continue
        top = max(counts.values())
        winners = [label for label, score in counts.items() if score == ___]
        result.append([sample, winners[0] if len(winners) == ___ else "ARBITRATE"])
    return result`,
      blanks: [
        { answers: ['continue'], hint: '跳过无效票', width: 10 },
        { answers: ['0'], hint: '计数初值', width: 4 },
        { answers: ['"ARBITRATE"', "'ARBITRATE'"], hint: '无有效票', width: 12 },
        { answers: ['top'], hint: '最高分', width: 6 },
        { answers: ['1'], hint: '唯一赢家', width: 4 },
      ],
      cases: [
        { args: [[['s1', 'a', 'X'], ['s1', 'b', 'X'], ['s1', 'c', 'Y']], { a: 1, b: 1, c: 3 }], expected: [['s1', 'Y']] },
        { args: [[['s2', 'a', 'X'], ['s2', 'b', 'Y']], { a: 1, b: 1 }], expected: [['s2', 'ARBITRATE']] },
        { args: [[['s3', 'z', 'X'], ['s3', 'a', 'Y']], { a: 1 }], expected: [['s3', 'Y']] },
        { args: [[['s4', 'z', 'X']], {}], expected: [['s4', 'ARBITRATE']] },
        {
          args: [
            [['s2', 'a', 'X'], ['s1', 'a', 'Y'], ['s1', 'b', 'Z'], ['s1', 'c', 'Z']],
            { a: 1, b: 1, c: 2 },
          ],
          expected: [['s1', 'Z'], ['s2', 'X']],
        },
      ],
      explain: '最后一个用例同时考排序和权重：s1 的 Z 权重和 3 > Y 的 1；输出按样本名 s1、s2 排序。',
      trap: 'order',
    },
  ],
};
