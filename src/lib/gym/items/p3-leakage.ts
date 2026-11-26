import type { GymItem } from '../types';

export const leakage: GymItem = {
  key: 'p3-leakage',
  kind: 'pattern',
  order: 3,
  title: '训练/测试集泄漏检查',
  subtitle: '训练集和测试集的交集，就是泄漏；先归一化，再比集合',
  theme: '53 · 训练测试集分组泄漏检查',
  minutes: 10,
  level: 1,
  tags: ['集合交集', '归一化', '近重复', '时间截断'],
  summary: '分组泄漏是组 ID 的交集，近重复是文本 shingle 的 Jaccard，时间泄漏是测试时间早于训练截止线。三种变体都是「先建集合，再判交集」。',
  sections: [
    {
      title: '三种泄漏，一个套路',
      body: [
        '① 分组泄漏：同一条会话/同一个用户/同一段语音被拆到训练集和测试集。只要某个组同时出现在两边，测试集里属于该组的样本就算泄漏。',
        '② 近重复泄漏：两条文本去掉空白、转小写后相同，或字符 2-gram 的 Jaccard 相似度达到阈值，就算近重复。',
        '③ 时间穿越：测试样本的时间早于「训练集最后时间 + 延迟」，说明模型用到了未来信息。',
      ],
    },
    {
      title: '心智模型：先建集合',
      body: [
        '把训练集的组 ID 收进 set，再遍历测试集，判断它的组是否在 set 里。泄漏率 = 泄漏的测试样本数 / 测试样本总数。',
        '近重复先把文本归一化：去掉所有空白、转小写；再切成字符 2-gram 集合，用交集大小 / 并集大小算 Jaccard。',
        '时间检查只需要一条截止线：cutoff = max(train_times) + delay_hours * 3600；测试时间严格小于 cutoff 就是穿越。',
      ],
      code: 'train_groups = {groups[i] for i in train_ids if i in groups}\nleaked = sorted(i for i in test_ids if i in groups and groups[i] in train_groups)',
    },
    {
      title: '三个坑',
      body: [
        '① 测试集为空时不能除零，泄漏率返回 0.0，不是报错。',
        '② 时间边界：题目说「早于截止线」就是严格小于；如果写 <=，恰好等于截止线的样本会被误判。',
        '③ 输出要排序；泄漏率保留 4 位小数；missing group 的样本跳过，不要当成泄漏。',
      ],
    },
  ],
  formula: {
    label: '泄漏判定',
    code: 'train_groups & test_groups ≠ ∅  →  存在分组泄漏\nleak_rate = round(len(leaked) / len(test_ids), 4) if test_ids else 0.0',
  },
  skeleton: `def group_leakage(train_ids, test_ids, groups):
    train_groups = {groups[i] for i in train_ids if i in groups}
    leaked = sorted(i for i in test_ids if i in groups and groups[i] in train_groups)
    leaked_groups = sorted({groups[i] for i in leaked})
    rate = round(len(leaked) / len(test_ids), 4) if test_ids else 0.0
    return {"leaked_test_ids": leaked, "leaked_groups": leaked_groups, "leak_rate": rate}`,
  traps: [
    { title: '空测试集', wrong: 'len(test_ids) 直接做除数', right: 'if test_ids else 0.0' },
    { title: '时间边界', wrong: 'test_time <= cutoff 判泄漏', right: '题目说「早于」就用 test_time < cutoff' },
    { title: '近重复归一化', wrong: '直接比较原始文本', right: '去空白、转小写，再切 2-gram' },
  ],
  visual: 'leakage',
  drills: [
    {
      id: 'p3-m1',
      type: 'mcq',
      prompt: '训练集有样本 0、1，测试集有样本 2、3；groups 为 {0:g1, 1:g2, 2:g1, 3:g3}。哪些测试样本泄漏？',
      options: ['2 和 3', '只有 2', '只有 3', '没有泄漏'],
      answer: 1,
      explain: '测试样本 2 的组是 g1，训练集里样本 0 也是 g1，所以 2 泄漏；样本 3 的组 g3 没在训练集出现，不泄漏。',
      trap: 'tie',
    },
    {
      id: 'p3-m2',
      type: 'mcq',
      prompt: 'test_ids 为空时，leak_rate 应该返回什么？',
      options: ['报 ZeroDivisionError', '0.0', '1.0', 'None'],
      answer: 1,
      explain: '没有测试样本就没有泄漏，泄漏率定义为 0.0。题目明确要求空输入也要返回结构完整的结果，不能抛异常。',
      trap: 'empty',
    },
    {
      id: 'p3-m3',
      type: 'mcq',
      prompt: '训练集最晚时间是 1000，delay_hours=1（3600 秒）。下面哪个测试时间算时间穿越？',
      options: ['t = 4600', 't = 4599', 't = 5000', 't = 1000'],
      answer: 1,
      explain: 'cutoff = 1000 + 3600 = 4600；题目说「早于截止线」算穿越，所以 t < 4600。4599 穿越，4600 及以后不算。',
      trap: 'boundary',
    },
    {
      id: 'p3-f1',
      type: 'fill',
      prompt: '补全分组泄漏检查。',
      code: `train_groups = {groups[i] for i in train_ids if ___}
leaked = sorted(i for i in test_ids if i in groups and ___ in train_groups)
leaked_groups = sorted({groups[i] for i in leaked})
rate = round(len(leaked) / len(test_ids), ___) if test_ids else ___`,
      blanks: [
        { answers: ['i in groups'], hint: '只统计有组信息的样本', width: 14 },
        { answers: ['groups[i]'], hint: '测试样本的组', width: 10 },
        { answers: ['4'], hint: '保留几位小数', width: 4 },
        { answers: ['0.0'], hint: '空测试集', width: 6 },
      ],
      explain: '先建训练组集合，再看测试样本的组是否落在集合里；空测试集返回 0.0，避免除零。',
      trap: 'empty',
    },
    {
      id: 'p3-f2',
      type: 'fill',
      prompt: '补全近重复检查的归一化与 Jaccard。',
      code: `def normalize(text):
    s = ''.join(text.split()).___
    return s, {s[i:i + 2] for i in range(len(s) - ___)}

train = [normalize(t) for t in train_texts]
exact = {s for s, _ in train}
for i, text in enumerate(test_texts):
    s, grams = normalize(text)
    if s in exact or (grams and any(
        other and len(grams ___ other) / len(grams | other) >= ___
        for _, other in train
    )):
        leaked.append(i)`,
      blanks: [
        { answers: ['lower()'], hint: '统一大小写', width: 10 },
        { answers: ['1'], hint: '2-gram 的起点数', width: 4 },
        { answers: ['&'], hint: '交集', width: 4 },
        { answers: ['threshold'], hint: '相似度阈值', width: 12 },
      ],
      explain: '2-gram 的数量是 len(s)-1；Jaccard = 交集 / 并集；达到 threshold 就算近重复。归一化必须先做，否则大小写和空格会让重复漏掉。',
      trap: 'precision',
    },
    {
      id: 'p3-c1',
      type: 'code',
      prompt: '补全 4 个空并运行。判题覆盖正常泄漏、空测试集、无交集、全泄漏和缺失组信息。',
      fn: 'group_leakage',
      starter: `def group_leakage(train_ids, test_ids, groups):
    train_groups = {groups[i] for i in train_ids if ___}
    leaked = sorted(i for i in test_ids if i in groups and ___ in train_groups)
    leaked_groups = sorted({groups[i] for i in leaked})
    rate = round(len(leaked) / len(test_ids), ___) if test_ids else ___
    return {"leaked_test_ids": leaked, "leaked_groups": leaked_groups, "leak_rate": rate}`,
      blanks: [
        { answers: ['i in groups'], hint: '有组信息', width: 14 },
        { answers: ['groups[i]'], hint: '测试样本的组', width: 10 },
        { answers: ['4'], hint: '保留几位小数', width: 4 },
        { answers: ['0.0'], hint: '空测试集', width: 6 },
      ],
      cases: [
        { args: [['u1', 'u2'], ['u3', 'u4'], { u1: 'g1', u2: 'g2', u3: 'g1', u4: 'g3' }], expected: { leaked_test_ids: ['u3'], leaked_groups: ['g1'], leak_rate: 0.5 } },
        { args: [['u1'], [], { u1: 'g1' }], expected: { leaked_test_ids: [], leaked_groups: [], leak_rate: 0.0 } },
        { args: [['u1'], ['u2'], { u1: 'g1', u2: 'g2' }], expected: { leaked_test_ids: [], leaked_groups: [], leak_rate: 0.0 } },
        { args: [['u1'], ['u2', 'u3'], { u1: 'g1', u2: 'g1', u3: 'g2' }], expected: { leaked_test_ids: ['u2'], leaked_groups: ['g1'], leak_rate: 0.5 } },
        { args: [['u1', 'u2'], ['u3', 'u4', 'u5'], { u1: 'g1', u2: 'g2', u3: 'g1', u4: 'g3' }], expected: { leaked_test_ids: ['u3'], leaked_groups: ['g1'], leak_rate: 0.3333 } },
      ],
      explain: '最后一个用例有 3 个测试样本，只有 1 个泄漏，所以 rate=1/3=0.3333；u5 没有组信息，跳过但不报错。',
      trap: 'precision',
    },
  ],
};
