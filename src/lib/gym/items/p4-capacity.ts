import type { GymItem } from '../types';

export const capacity: GymItem = {
  key: 'p4-capacity',
  kind: 'pattern',
  order: 4,
  title: '容量测算与降级',
  subtitle: 'floor 回答「能放几个」，ceil 回答「需要几个」',
  theme: '54 · 推理服务容量测算与降级决策',
  minutes: 10,
  level: 2,
  tags: ['显存', '并发', 'Little 定律', 'ceil/floor'],
  summary: '先减保留显存，再用整除算单卡能放几个模型；用吞吐算单卡 QPS，最后用 ceil 算需要多少卡。并发用 Little 定律：并发数 = QPS × 平均时长。',
  sections: [
    {
      title: '两个方向，两种取整',
      body: [
        '「一张卡能放几个模型副本」是向下取整：usable // model_mem_gb。放不下的余数不能用。',
        '「要达到目标 QPS 需要几张卡」是向上取整：ceil(target_qps / qps_per_gpu)。差一点也要多一张。',
        '把这两个方向记反，是这类题最常见的失分点。',
      ],
      code: 'usable = gpu_mem_gb - reserved_gb\nreplicas = int(usable // model_mem_gb)\nqps_per_gpu = round(replicas * batch_size * 1000 / latency_ms, 3)\ngpus_needed = math.ceil(target_qps / qps_per_gpu) if qps_per_gpu > 0 else 0',
    },
    {
      title: '并发与降级',
      body: [
        '并发会话数用 Little 定律：concurrent = qps × avg_duration_s；每个 Pod 能承载 max_sessions × target_utilization；Pod 数 = ceil(concurrent / per_pod)，再加冗余。',
        '降级题按规则表从上到下匹配，第一条命中的规则决定档位；注意规则里的比较符是 >= 还是 <=，命中的下标也要一起返回。',
        '批大小题从最大批开始往下试：latency = base_ms + per_item_ms × batch；QPS = batch × 1000 / latency；不满足时延或最小 QPS 就继续降。',
      ],
    },
    {
      title: '三个坑',
      body: [
        '① qps_per_gpu 为 0 时不能做除数，直接返回 0 张卡。',
        '② 保留显存要先减掉，模型块不能放进保留区。',
        '③ 返回值可能是 int 与 float 混合；按题面的字段顺序和类型返回，不要四舍五入错位数。',
      ],
    },
  ],
  formula: {
    label: '容量三连',
    code: 'replicas = (gpu_mem_gb - reserved_gb) // model_mem_gb\nqps_per_gpu = replicas * batch_size * 1000 / latency_ms\ngpus_needed = ceil(target_qps / qps_per_gpu)',
  },
  skeleton: `import math

def gpu_plan(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    usable = gpu_mem_gb - reserved_gb
    replicas = int(usable // model_mem_gb)
    qps_per_gpu = round(replicas * batch_size * 1000 / latency_ms, 3)
    gpus_needed = math.ceil(target_qps / qps_per_gpu) if qps_per_gpu > 0 else 0
    return [replicas, qps_per_gpu, gpus_needed]`,
  traps: [
    { title: '取整方向', wrong: 'replicas 用 ceil、gpus 用 floor', right: '能放几个用 floor，需要几个用 ceil' },
    { title: '零除', wrong: 'qps_per_gpu 为 0 仍然做除数', right: '先判断 qps_per_gpu > 0' },
    { title: '保留显存', wrong: '用总显存直接除模型大小', right: '先减 reserved_gb' },
  ],
  visual: 'capacity',
  drills: [
    {
      id: 'p4-m1',
      type: 'mcq',
      prompt: '模型 10GB，单卡 80GB，保留 8GB，时延 50ms，批大小 4，目标 100 QPS。单卡副本数、单卡 QPS、需要几张卡？',
      options: ['7、560.0、1', '8、640.0、1', '7、560.0、2', '7、280.0、1'],
      answer: 0,
      explain: '可用显存 80-8=72，72//10=7 个副本；单卡 QPS=7×4×1000/50=560；100/560 向上取整是 1 张卡。',
      trap: 'precision',
    },
    {
      id: 'p4-m2',
      type: 'mcq',
      prompt: '「一张卡能放几个模型副本」和「达到目标 QPS 需要几张卡」分别应该怎么取整？',
      options: ['都向上取整', '都向下取整', '前者向下取整，后者向上取整', '前者向上取整，后者向下取整'],
      answer: 2,
      explain: '副本数受显存硬限制，放不下的余数不能用，所以向下取整；卡数是需求，差一点也要多一张，所以向上取整。',
      trap: 'precision',
    },
    {
      id: 'p4-m3',
      type: 'mcq',
      prompt: '如果模型大小超过可用显存，qps_per_gpu 为 0，gpus_needed 应该返回什么？',
      options: ['报除零错误', '0', '1', '无穷大'],
      answer: 1,
      explain: '没有可用副本就没有吞吐，返回 0 张卡。必须显式判断 qps_per_gpu > 0，避免 ZeroDivisionError。',
      trap: 'empty',
    },
    {
      id: 'p4-f1',
      type: 'fill',
      prompt: '补全显存容量测算。',
      code: `usable = gpu_mem_gb - ___
replicas = int(usable ___ model_mem_gb)
qps_per_gpu = round(replicas * batch_size * 1000 / ___, 3)
gpus_needed = math.ceil(target_qps / qps_per_gpu) if ___ else 0`,
      blanks: [
        { answers: ['reserved_gb'], hint: '保留显存', width: 14 },
        { answers: ['//'], hint: '能放几个', width: 4 },
        { answers: ['latency_ms'], hint: '单次时延', width: 12 },
        { answers: ['qps_per_gpu > 0'], hint: '避免零除', width: 18 },
      ],
      explain: '先减保留显存；副本数用整除；QPS 的分母是时延（毫秒），乘 1000 把毫秒换成秒；最后判断单卡吞吐是否为正。',
      trap: 'empty',
    },
    {
      id: 'p4-f2',
      type: 'fill',
      prompt: '补全并发会话测算（Little 定律）。',
      code: `concurrent = qps * ___
per_pod = max_sessions * ___
pods = math.ceil(concurrent / ___)
return [round(concurrent, 2), pods, pods + redundancy]`,
      blanks: [
        { answers: ['avg_duration_s'], hint: '平均会话时长', width: 16 },
        { answers: ['target_utilization'], hint: '目标利用率', width: 18 },
        { answers: ['per_pod'], hint: '每个 Pod 的有效承载', width: 10 },
      ],
      explain: 'Little 定律：系统内平均并发 = 到达率 × 平均停留时间。每个 Pod 的有效承载要乘目标利用率，最后向上取整。',
      trap: 'precision',
    },
    {
      id: 'p4-c1',
      type: 'code',
      prompt: '补全 4 个空并运行。判题覆盖正常容量、多卡、模型放不下和批大小变化。',
      fn: 'gpu_plan',
      starter: `import math

def gpu_plan(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    usable = gpu_mem_gb - ___
    replicas = int(usable ___ model_mem_gb)
    qps_per_gpu = round(replicas * batch_size * 1000 / ___, 3)
    gpus_needed = math.ceil(target_qps / qps_per_gpu) if ___ else 0
    return [replicas, qps_per_gpu, gpus_needed]`,
      blanks: [
        { answers: ['reserved_gb'], hint: '保留显存', width: 14 },
        { answers: ['//'], hint: '能放几个', width: 4 },
        { answers: ['latency_ms'], hint: '单次时延', width: 12 },
        { answers: ['qps_per_gpu > 0'], hint: '避免零除', width: 18 },
      ],
      cases: [
        { args: [10, 80, 8, 50, 4, 100], expected: [7, 560.0, 1] },
        { args: [30, 80, 8, 100, 2, 1000], expected: [2, 40.0, 25] },
        { args: [100, 80, 8, 50, 4, 100], expected: [0, 0.0, 0] },
        { args: [10, 80, 8, 200, 8, 100], expected: [7, 280.0, 1] },
      ],
      explain: '第三个用例是模型放不下：可用 72GB < 100GB，副本 0、QPS 0、卡数 0。实际赛题可能保证单卡至少能放 1 个实例，这里保留 0 的防御性分支，避免除零。第四个用例考批大小翻倍但时延也变长，QPS 不一定翻倍。',
      trap: 'empty',
    },
  ],
};
