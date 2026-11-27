import type { GymItem } from '../types';

export const threshold: GymItem = {
  key: 'p5-threshold',
  kind: 'pattern',
  order: 5,
  title: '阈值扫描与成本最优',
  subtitle: '同分同进同出；切点只能落在平台边界',
  theme: '55 · 人机协同路由阈值测算',
  minutes: 12,
  level: 3,
  tags: ['排序扫描', '阈值', '平票平台', '成本最小'],
  summary: '把会话按置信度降序排列，切点从左往右扫；同一个分数的会话必须一起自动或一起转人工，所以只能在同分组的末尾评估。',
  sections: [
    {
      title: '题目在问什么',
      body: [
        '给每个会话的置信度和是否正确，要求选一个阈值：置信度 ≥ 阈值的自动应答，其余转人工。约束通常是「自动应答率不低于 min_auto_rate」「自动应答的准确率不低于 min_precision」；有的变体给自动成本、人工成本、错误惩罚，要求总成本最小。',
        '置信度相同的会话必须同进同出，这是这类题最重要的隐藏规则。',
      ],
    },
    {
      title: '心智模型：扫描平台',
      body: [
        '先把 (score, label) 按分数降序排列。维护两个前缀量：auto（已纳入自动应答的数量）和 correct（其中正确的数量）。',
        '每纳入一个会话，只有当下一个分数不同（或已经到末尾）时才评估一次。因为同一分的会话必须一起进退，切在平台中间是不允许的。',
        '可行阈值取所有满足约束的分数里最小的那个（这样自动率最大）；成本题取总成本最小的切点，成本相同取更小的阈值。',
      ],
      code: 'pairs = sorted(zip(scores, labels), key=lambda p: -p[0])\nfor i, (score, ok) in enumerate(pairs):\n    auto += 1\n    correct += 1 if ok else 0\n    if i + 1 < n and pairs[i + 1][0] == score:\n        continue\n    if auto / n >= min_auto_rate and correct / auto >= min_precision:\n        feasible.append(score)',
    },
    {
      title: '三个坑',
      body: [
        '① 切在平台中间：把同分的会话拆成两半，违反「同进同出」。',
        '② 比较符：题目说「不低于」就是 >=；阈值本身也包含在自动侧。',
        '③ 没有可行解时返回 [None, 0.0, 0.0]，不要返回最小分数或抛异常。',
      ],
    },
  ],
  formula: {
    label: '可行阈值',
    code: 'auto / n >= min_auto_rate  and  correct / auto >= min_precision\nthreshold = min(feasible)',
  },
  quickCode: `pairs = sorted(zip(scores, labels), key=lambda p: -p[0])
if i + 1 < n and pairs[i + 1][0] == score:
    continue
if auto / n >= min_auto_rate and correct / auto >= min_precision:
    feasible.append(score)`,
  skeleton: `def route_threshold(scores, labels, min_auto_rate, min_precision):
    n = len(scores)
    pairs = sorted(zip(scores, labels), key=lambda p: -p[0])
    feasible = []
    auto = correct = 0
    for i, (score, is_correct) in enumerate(pairs):
        auto += 1
        correct += 1 if is_correct else 0
        if i + 1 < n and pairs[i + 1][0] == score:
            continue
        if auto / n >= min_auto_rate and correct / auto >= min_precision:
            feasible.append(score)
    if not feasible:
        return [None, 0.0, 0.0]
    threshold = min(feasible)
    picked = [ok for score, ok in pairs if score >= threshold]
    return [threshold, round(len(picked) / n, 4), round(sum(picked) / len(picked), 4)]`,
  traps: [
    { title: '平台中间', wrong: '每纳入一个就评估一次', right: '只在同分组末尾评估' },
    { title: '比较符', wrong: '用 > 而不是 >=' , right: '「不低于」用 >=' },
    { title: '空可行域', wrong: '返回 0.0 当阈值', right: '返回 [None, 0.0, 0.0]' },
  ],
  visual: 'threshold',
  drills: [
    {
      id: 'p5-m1',
      type: 'mcq',
      prompt: 'scores=[0.9,0.8,0.7,0.6]，labels=[对,对,错,对]，min_auto_rate=0.5，min_precision=0.66。可行阈值和最终结果是什么？',
      options: ['0.8，自动率 0.5，精确率 1.0', '0.7，自动率 0.75，精确率 0.6667', '0.6，自动率 1.0，精确率 0.75', '无可行解'],
      answer: 2,
      explain: '0.8 处自动率 0.5、精确率 1.0，可行；0.7 处自动率 0.75、精确率 2/3≈0.667，可行；0.6 处自动率 1.0、精确率 0.75，也可行。取最小可行阈值 0.6，自动率 1.0、精确率 0.75。',
      trap: 'boundary',
    },
    {
      id: 'p5-m2',
      type: 'mcq',
      prompt: 'scores=[0.9,0.9,0.8]，labels=[对,错,对]，min_precision=0.6。为什么阈值不能取 0.9？',
      options: ['因为 0.9 太高', '因为 0.9 这一组的两条必须一起自动，精确率只有 0.5', '因为 0.9 不是可行分数', '因为必须取最小分数'],
      answer: 1,
      explain: '同分同进同出：阈值 0.9 会把两条 0.9 的会话都纳入自动，其中一条错，精确率 1/2=0.5 < 0.6，不可行。只能取 0.8，把三条都纳入，精确率 2/3≈0.667。',
      trap: 'tie',
    },
    {
      id: 'p5-m3',
      type: 'mcq',
      prompt: '所有切点都不满足约束时，函数应该返回什么？',
      options: ['返回 0.0 作为阈值', '返回最大分数', '返回 [None, 0.0, 0.0]', '抛出异常'],
      answer: 2,
      explain: '没有可行阈值是合法结果，返回 [None, 0.0, 0.0]，让调用方知道全部转人工。',
      trap: 'empty',
    },
    {
      id: 'p5-f1',
      type: 'fill',
      prompt: '补全降序扫描与可行阈值。',
      code: `pairs = sorted(zip(scores, labels), key=lambda p: ___)
feasible = []
auto = correct = 0
for i, (score, ok) in enumerate(pairs):
    auto += 1
    correct += 1 if ok else 0
    if i + 1 < n and pairs[i + 1][0] == score:
        ___
    if auto / n >= min_auto_rate and ___ >= min_precision:
        feasible.append(score)
threshold = ___(feasible)`,
      blanks: [
        { answers: ['-p[0]'], hint: '分数从高到低', width: 8 },
        { answers: ['continue'], hint: '同分还没结束', width: 10 },
        { answers: ['correct / auto'], hint: '自动应答的精确率', width: 14 },
        { answers: ['min'], hint: '取最小可行阈值', width: 6 },
      ],
      explain: '降序用 -p[0]；同分组没结束就 continue；精确率的分母是已纳入自动的数量 auto；可行阈值取最小，才能让自动率最大。',
      trap: 'tie',
    },
    {
      id: 'p5-f2',
      type: 'fill',
      prompt: '补全成本最小版本。',
      code: `auto += 1
errors += 0 if ok else ___
if i + 1 < n and pairs[i + 1][0] == score:
    continue
costs.append((auto * auto_cost + errors * error_penalty + (n - auto) * human_cost, ___))
cost, threshold = ___(costs)
return [threshold, cost, n * human_cost - cost]`,
      blanks: [
        { answers: ['1'], hint: '错一条', width: 4 },
        { answers: ['score'], hint: '成本并列时比阈值', width: 8 },
        { answers: ['min'], hint: '成本最小', width: 6 },
      ],
      explain: '元组比较先比成本，再比阈值；成本相同会自动选更小的阈值。最后一个是「相比全部转人工省了多少钱」。',
      trap: 'precision',
    },
    {
      id: 'p5-c1',
      type: 'code',
      prompt: '补全 4 个空并运行。判题覆盖正常可行、同分平台和无可行解。',
      fn: 'route_threshold',
      starter: `def route_threshold(scores, labels, min_auto_rate, min_precision):
    n = len(scores)
    pairs = sorted(zip(scores, labels), key=lambda p: ___)
    feasible = []
    auto = correct = 0
    for i, (score, is_correct) in enumerate(pairs):
        auto += 1
        correct += 1 if is_correct else 0
        if i + 1 < n and pairs[i + 1][0] == score:
            ___
        if auto / n >= min_auto_rate and ___ >= min_precision:
            feasible.append(score)
    if not feasible:
        return [None, 0.0, 0.0]
    threshold = ___(feasible)
    picked = [ok for score, ok in pairs if score >= threshold]
    return [threshold, round(len(picked) / n, 4), round(sum(picked) / len(picked), 4)]`,
      blanks: [
        { answers: ['-p[0]'], hint: '分数从高到低', width: 8 },
        { answers: ['continue'], hint: '同分还没结束', width: 10 },
        { answers: ['correct / auto'], hint: '自动应答的精确率', width: 14 },
        { answers: ['min'], hint: '取最小可行阈值', width: 6 },
      ],
      cases: [
        { args: [[0.9, 0.8, 0.7, 0.6], [true, true, false, true], 0.5, 0.66], expected: [0.6, 1.0, 0.75] },
        { args: [[0.9, 0.9, 0.8], [true, false, true], 0.5, 0.6], expected: [0.8, 1.0, 0.6667] },
        { args: [[0.5], [false], 0.9, 0.9], expected: [null, 0.0, 0.0] },
      ],
      explain: '第二个用例考同分平台：0.9 这一组精确率只有 0.5，不能切；0.8 处三条全自动，精确率 0.6667。第三个用例无可行解。',
      trap: 'tie',
    },
  ],
};
