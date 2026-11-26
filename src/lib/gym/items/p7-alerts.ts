import type { GymItem } from '../types';

export const alerts: GymItem = {
  key: 'p7-alerts',
  kind: 'pattern',
  order: 7,
  title: '告警聚合、抑制与值班负载',
  subtitle: '聚合看上一条事件，抑制看上一条已发送；窗口边界差一条',
  theme: '57 · 告警聚合抑制与值班负载测算',
  minutes: 12,
  level: 2,
  tags: ['时间排序', '滑动窗口', '抑制规则', '中位数'],
  summary: '先按服务/指标分组并按时间排序；聚合窗口比较相邻事件，抑制窗口比较「上一条已发送」；<= 还是 < 决定边界那一条算不算。',
  sections: [
    {
      title: '聚合：把连续告警并成事件',
      body: [
        '按 (service, metric) 分组，组内按时间排序。维护当前事件的 start、上一条时间 prev、条数 count、最高级别 top。',
        '如果当前时间与上一条的间隔 ≤ window_sec，就并入当前事件；否则结算当前事件，从当前这条开始新事件。注意是「相邻两条」的间隔，不是与 start 的间隔。',
        '级别 P1 < P2 < P3，字符串越小级别越高，所以 top = min(top, severity)。',
      ],
      code: 'if ts - prev <= window_sec:\n    count += 1\n    top = min(top, severity)\nelse:\n    incidents.append([service, metric, start, prev, count, top])\n    start, count, top = ts, 1, severity\nprev = ts',
    },
    {
      title: '抑制：只有发出去的才刷新计时',
      body: [
        '按时间排序，同一时刻保持输入顺序（稳定排序）。对每条告警查它的规则间隔 gap；如果距离上一条「已发送」告警小于 gap，就抑制；否则发送，并把 last_sent 更新为当前时间。',
        '关键：被抑制的告警不能刷新 last_sent，否则抑制窗口会无限延长。',
        '值班负载题按人统计告警数、超时数、已响应数和响应时间合计；缺 ack 也算超时；中位数要分奇偶。',
      ],
    },
    {
      title: '三个坑',
      body: [
        '① 边界：聚合用 ≤，抑制用 <；题目说「小于间隔」才是严格小于，不要凭感觉。',
        '② 同一时刻的多条告警要稳定排序，先出现的先处理。',
        '③ 空输入返回 []；空响应的中位数返回 0.0；不要对空列表取 [0]。',
      ],
    },
  ],
  formula: {
    label: '聚合与抑制',
    code: '聚合：ts - prev <= window  → 并入当前事件\n抑制：ts - last_sent < gap  → 抑制（不刷新 last_sent）',
  },
  skeleton: `def aggregate_alerts(alerts, window_sec):
    by_key = {}
    for ts, service, metric, severity in alerts:
        by_key.setdefault((service, metric), []).append((ts, severity))
    incidents = []
    for service, metric in sorted(by_key):
        group = sorted(by_key[(service, metric)])
        start = prev = group[0][0]
        count, top = 1, group[0][1]
        for ts, severity in group[1:]:
            if ts - prev <= window_sec:
                count += 1
                top = min(top, severity)
            else:
                incidents.append([service, metric, start, prev, count, top])
                start, count, top = ts, 1, severity
            prev = ts
        incidents.append([service, metric, start, prev, count, top])
    return incidents`,
  traps: [
    { title: '边界符号', wrong: '聚合用 <、抑制用 <=', right: '聚合 ≤ window，抑制 < gap' },
    { title: '抑制刷新', wrong: '被抑制的告警也更新 last_sent', right: '只有真正发送的才更新' },
    { title: '空输入', wrong: '直接访问 group[0]', right: '没有告警直接返回 []' },
  ],
  visual: 'alerts',
  drills: [
    {
      id: 'p7-m1',
      type: 'mcq',
      prompt: '同一服务同一指标在 0、5、10、20 秒各有一条告警，window_sec=10。会聚合成几个事件？',
      options: ['1 个，0–20', '2 个，0–10 和 20–20', '4 个，每条一个', '3 个，0–5、10、20'],
      answer: 0,
      explain: '相邻间隔分别是 5、5、10，都 ≤10，所以全部并入同一个事件，范围 0–20，共 4 条。如果把 20 与 10 的间隔当成 10 并用 <，就会错分成两个事件。',
      trap: 'boundary',
    },
    {
      id: 'p7-m2',
      type: 'mcq',
      prompt: '抑制规则 gap=30 秒。一条告警在 t=10 被发送，t=20 的同类告警被抑制。t=35 的同类告警会怎样？',
      options: ['发送，因为距离 t=20 已经 15 秒', '抑制，因为距离 t=10 只有 25 秒', '发送，因为距离 t=10 已经 25 秒', '无法判断'],
      answer: 1,
      explain: 'last_sent 只在真正发送时更新。t=20 被抑制，不刷新计时，所以 t=35 距离 last_sent=10 只有 25 秒 < 30，仍然抑制。',
      trap: 'order',
    },
    {
      id: 'p7-m3',
      type: 'mcq',
      prompt: 'alerts 为空时，aggregate_alerts 应该返回什么？',
      options: ['抛 IndexError', '[]', '[[]]', 'None'],
      answer: 1,
      explain: '没有告警就没有事件，返回空列表。不能在空列表上访问 group[0]；先判断 alerts 是否为空，或者循环自然不进入。',
      trap: 'empty',
    },
    {
      id: 'p7-f1',
      type: 'fill',
      prompt: '补全按服务/指标分组与事件聚合。',
      code: `by_key = {}
for ts, service, metric, severity in alerts:
    by_key.___((service, metric), []).append((ts, severity))
incidents = []
for service, metric in sorted(by_key):
    group = sorted(by_key[(service, metric)])
    start = prev = group[0][0]
    count, top = 1, group[0][1]
    for ts, severity in group[1:]:
        if ts - prev <= window_sec:
            count += 1
            top = ___(top, severity)
        else:
            incidents.append([service, metric, start, prev, count, top])
            start, count, top = ts, 1, severity
        prev = ts
    incidents.append([service, metric, start, prev, count, top])`,
      blanks: [
        { answers: ['setdefault'], hint: '没有键就建列表', width: 12 },
        { answers: ['min'], hint: 'P1 级别最高', width: 6 },
      ],
      explain: 'setdefault 一次性完成「取列表/建列表」；级别字符串 P1 < P2 < P3，用 min 取最高级别。',
      trap: 'order',
    },
    {
      id: 'p7-f2',
      type: 'fill',
      prompt: '补全抑制规则：只有真正发送的告警才刷新计时。',
      code: `gap_of = {(service, metric): gap for service, metric, gap in rules}
order = sorted(range(len(alerts)), key=lambda i: (alerts[i][0], ___))
last_sent, sent, suppressed = {}, [], 0
for i in order:
    ts, service, metric, _ = alerts[i]
    key = (service, metric)
    gap = gap_of.get(key)
    if gap is not None and key in last_sent and ts - last_sent[key] < gap:
        suppressed += 1
    else:
        sent.append(i)
        last_sent[key] = ___`,
      blanks: [
        { answers: ['i'], hint: '同一时刻保持输入顺序', width: 4 },
        { answers: ['ts'], hint: '刷新已发送时间', width: 6 },
      ],
      explain: '排序键加 i 保证同一时刻稳定；last_sent 只在 else 分支（真正发送）更新，被抑制的告警不刷新。',
      trap: 'order',
    },
    {
      id: 'p7-c1',
      type: 'code',
      prompt: '补全 2 个空并运行。判题覆盖跨服务聚合、空输入和同一时刻多条。',
      fn: 'aggregate_alerts',
      starter: `def aggregate_alerts(alerts, window_sec):
    by_key = {}
    for ts, service, metric, severity in alerts:
        by_key.___((service, metric), []).append((ts, severity))
    incidents = []
    for service, metric in sorted(by_key):
        group = sorted(by_key[(service, metric)])
        start = prev = group[0][0]
        count, top = 1, group[0][1]
        for ts, severity in group[1:]:
            if ts - prev <= window_sec:
                count += 1
                top = ___(top, severity)
            else:
                incidents.append([service, metric, start, prev, count, top])
                start, count, top = ts, 1, severity
            prev = ts
        incidents.append([service, metric, start, prev, count, top])
    return incidents`,
      blanks: [
        { answers: ['setdefault'], hint: '没有键就建列表', width: 12 },
        { answers: ['min'], hint: 'P1 级别最高', width: 6 },
      ],
      cases: [
        {
          args: [[[0, 's', 'cpu', 'P2'], [5, 's', 'cpu', 'P3'], [10, 's', 'cpu', 'P1'], [20, 's', 'cpu', 'P2'], [21, 's', 'mem', 'P3']], 10],
          expected: [['s', 'cpu', 0, 20, 4, 'P1'], ['s', 'mem', 21, 21, 1, 'P3']],
        },
        { args: [[], 5], expected: [] },
        { args: [[[0, 's', 'cpu', 'P2'], [0, 's', 'cpu', 'P3']], 5], expected: [['s', 'cpu', 0, 0, 2, 'P2']] },
      ],
      explain: '第一个用例的 cpu 组相邻间隔 5、5、10 都 ≤10，合并成一个 0–20 的事件；mem 单独一个。第三个用例同一时刻两条，条数 2、级别取更高的 P2。',
      trap: 'boundary',
    },
  ],
};
