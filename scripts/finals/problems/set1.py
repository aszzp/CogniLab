"""第 1 套编程题（51–57）。字段含义见 scripts/finals/build.py 的文件说明。"""
import math
import random
from collections import Counter

import common


def problem(**spec):
    return spec


# ---------------------------------------------------------------- 51 关键路径
def pipeline_critical_path(names, durations, deps):
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
    # forward[v]：从 v 出发到出口的最长路径耗时（含 v 自身）
    forward = [0] * n
    for v in reversed(topo):
        forward[v] = durations[v] + max((forward[w] for w in succ[v]), default=0)
    makespan = max(forward)
    # 每一步都在「还能走在最长路径上」的环节里选下标最小的，即字典序最小的并列路径
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
    return [makespan, [names[v] for v in path], names[bottleneck]]


def _brute51(names, durations, deps):
    n = len(names)
    succ = [[] for _ in range(n)]
    has_pred = [False] * n
    for a, b in deps:
        succ[names.index(a)].append(names.index(b))
        has_pred[names.index(b)] = True
    best = None

    def walk(path, total):
        nonlocal best
        v = path[-1]
        if not succ[v]:
            cand = (-total, tuple(path))
            if best is None or cand < best:
                best = cand
        for w in succ[v]:
            walk(path + [w], total + durations[w])

    for s in range(n):
        if not has_pred[s]:
            walk([s], durations[s])
    path = list(best[1])
    bottleneck = sorted(path, key=lambda v: (-durations[v], v))[0]
    return [-best[0], [names[v] for v in path], names[bottleneck]]


def _neg51_global_bottleneck(names, durations, deps):
    makespan, path, _ = pipeline_critical_path(names, durations, deps)
    top = min(range(len(names)), key=lambda v: (-durations[v], v))
    return [makespan, path, names[top]]


def _neg51_largest_index(names, durations, deps):
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
    cur = max(v for v in sources if forward[v] == makespan)
    path = [cur]
    while True:
        rest = forward[cur] - durations[cur]
        nxt = [w for w in succ[cur] if forward[w] == rest]
        if not nxt:
            break
        cur = max(nxt)
        path.append(cur)
    bottleneck = min(path, key=lambda v: (-durations[v], v))
    return [makespan, [names[v] for v in path], names[bottleneck]]


def _neg51_serial(names, durations, deps):
    top = min(range(len(names)), key=lambda v: (-durations[v], v))
    return [sum(durations), list(names), names[top]]


P51 = problem(
    title="数据处理流水线关键路径与瓶颈判定",
    theme="critical_path", ability="业务分析", knowledge="业务流程设计与关键路径测算",
    fn="pipeline_critical_path", params=["names", "durations", "deps"],
    description="""
### 一、题目描述

一条数字人语料处理流水线被拆成 n 个环节。环节之间有先后依赖；同一时刻，互不依赖的环节可以并行执行，每个环节一旦开始就不会中断。请计算：

1. `makespan`：整条流水线的完工时间（所有环节都按最早可开始的时刻执行）；
2. 关键路径：从入点到出点、各环节耗时之和最长的一条路径；
3. 瓶颈环节：关键路径上耗时最大的环节。

函数返回 `[makespan, [关键路径上的环节名称, ...], 瓶颈环节名称]`。

### 二、输入说明

- `names`：长度为 n（1 ≤ n ≤ 2000）的字符串列表，环节名称互不相同，顺序不保证是拓扑序；
- `durations`：与 `names` 等长的整数列表，`durations[i]` 是第 i 个环节的耗时（1 ≤ durations[i] ≤ 10^4）；
- `deps`：依赖列表，每项 `[a, b]` 表示 a 完成之后 b 才能开始。保证无环、无重复依赖，名称都在 `names` 中。

### 三、输出说明

- 若有多条并列最长的路径，取「环节下标序列」字典序最小的一条：从起点开始，每一步都在仍能构成最长路径的前提下选下标最小的环节；
- 瓶颈环节耗时相同时，取 `names` 中下标较小者。

### 四、示例

```text
names      = ["collect", "clean", "label", "review"]
durations  = [2, 1, 3, 1]
deps       = [["collect", "clean"], ["clean", "label"], ["clean", "review"]]
返回       = [6, ["collect", "clean", "label"], "label"]
```

`collect → clean → label` 耗时 2 + 1 + 3 = 6，`collect → clean → review` 耗时 4，所以完工时间是 6，关键路径是 `["collect", "clean", "label"]`，瓶颈是 `label`。
""",
    sample=[["collect", "clean", "label", "review"], [2, 1, 3, 1],
            [["collect", "clean"], ["clean", "label"], ["clean", "review"]]],
    cases=lambda: [
        [["collect", "clean", "label", "review"], [2, 1, 3, 1],
         [["collect", "clean"], ["clean", "label"], ["clean", "review"]]],
        [["only"], [7], []],
        [["a", "b", "c", "d"], [3, 5, 2, 5], []],
        [["in", "l", "r", "out"], [1, 4, 4, 1], [["in", "l"], ["in", "r"], ["l", "out"], ["r", "out"]]],
        [["a", "b", "c"], [3, 3, 1], [["a", "b"], ["b", "c"]]],
        [["z", "m", "a"], [1, 2, 3], [["a", "m"], ["m", "z"]]],
        [["s1", "s2", "x", "y"], [2, 2, 1, 1], [["s1", "x"], ["s2", "y"]]],
        [["a", "b", "c", "d"], [2, 3, 2, 1], [["a", "c"], ["c", "d"]]],
        list(common.rand_dag(random.Random(11), 400, 0.3)),
        list(common.rand_dag(random.Random(12), 2000, 0.05)),
    ],
    reference=pipeline_critical_path,
    alt=_brute51,
    alt_case_ok=lambda args: len(args[0]) <= 12,
    fuzz=lambda rng: list(common.rand_dag(rng, rng.randint(1, 9), rng.uniform(0.1, 0.9))),
    negatives={
        "瓶颈取全程耗时最大的环节，没有限定在关键路径上": _neg51_global_bottleneck,
        "并列路径取下标较大者": _neg51_largest_index,
        "把所有环节耗时相加当作完工时间": _neg51_serial,
    },
    explanation="""
    这是有向无环图上的最长路径问题，标准做法是「拓扑序 + 动态规划」：
    1. 建邻接表并统计入度，用栈做迭代式拓扑排序（n 可达 2000，递归可能超出默认递归深度）；
    2. 令 forward[v] 为从 v 出发的最长路径耗时：按拓扑逆序计算 forward[v] = durations[v] + max(forward[后继])，入点的最大值即 makespan；
    3. 重建路径：起点取「入度为 0 且 forward 等于 makespan」的下标最小者，之后每一步在后继中找 forward 恰好等于剩余耗时的环节并取下标最小者。
    
    易错点：把「耗时最大的环节」直接当成瓶颈（它可能不在关键路径上）；按输入顺序而不是拓扑序递推；并列路径的取舍规则没有按要求实现。对应《标准》三级 1.1 业务流程设计：找出关键路径，才能判断压缩哪个环节真正缩短整体流程。
    """,
)


# ---------------------------------------------------------------- 52 标签合并
def merge_labels(votes, weights):
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
    return result


def _alt52(votes, weights):
    out = []
    for sid in sorted({v[0] for v in votes}):
        count = {}
        for sample, annotator, label in votes:
            if sample == sid and annotator in weights:
                count[label] = count.get(label, 0) + weights[annotator]
        ranked = sorted(count.items(), key=lambda kv: -kv[1])
        if not ranked or len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
            out.append([sid, "ARBITRATE"])
        else:
            out.append([sid, ranked[0][0]])
    return out


def _tie_smallest(votes, weights):
    tally = {}
    for sample, annotator, label in votes:
        if annotator in weights:
            tally.setdefault(sample, {}).setdefault(label, 0)
            tally[sample][label] += weights[annotator]
    out = []
    for sid in sorted({v[0] for v in votes}):
        counts = tally.get(sid, {})
        best = sorted(counts, key=lambda label: (-counts[label], label))[0] if counts else "ARBITRATE"
        out.append([sid, best])
    return out


def _neg52_headcount(votes, weights):
    tally, seen = {}, []
    for sample, annotator, label in votes:
        tally.setdefault(sample, {})
        seen.append(sample)
        if annotator in weights:
            tally[sample][label] = tally[sample].get(label, 0) + 1
    out = []
    for sid in sorted(set(seen)):
        counts = tally[sid]
        top = max(counts.values())
        winners = [l for l, c in counts.items() if c == top]
        out.append([sid, winners[0] if len(winners) == 1 else "ARBITRATE"])
    return out


def _neg52_input_order(votes, weights):
    return [row for sid in dict.fromkeys(v[0] for v in votes) for row in merge_labels(
        [v for v in votes if v[0] == sid], weights)]


def _rand52(rng, n_samples, n_annot, ghost_ratio=0.1):
    votes = []
    for s in range(n_samples):
        for a in range(n_annot):
            if rng.random() < 0.9:
                who = f"ghost{a}" if rng.random() < ghost_ratio else f"ann{a}"
                votes.append([f"s{s:04d}", who, rng.choice(["pos", "neg", "neu"])])
    rng.shuffle(votes)
    return votes


P52 = problem(
    title="多标注员标签合并与仲裁",
    theme="label_merge", ability="数据处理与标注", knowledge="标注结果合并与仲裁规则",
    fn="merge_labels", params=["votes", "weights"],
    description="""
### 一、题目描述

一批数字人客服语料由多名标注员独立标注情感倾向。请按下面的规则把多人标签合并成最终标签：

1. 对每个样本，统计各标签的加权票数：标注员 a 投给某标签一票，记 `weights[a]` 分；
2. 得分最高的标签为该样本的最终标签；
3. 出现并列最高分，或该样本没有任何有效票（所有票都来自不在 `weights` 中的标注员）时，最终标签记为 `"ARBITRATE"`，转人工仲裁。

函数返回 `[[样本id, 最终标签], ...]`，按样本 id 字典序升序。

### 二、输入说明

- `votes`：列表，每项 `[样本id, 标注员id, 标签]`，顺序打乱；同一标注员对同一样本最多出现一次；
- `weights`：字典 `{标注员id: 权重}`，权重为正数，且都能用二进制浮点数精确表示（整数或 0.5、0.25 这类）；
- `votes` 可能为空；标注员可能不在 `weights` 中。样本数量不超过 5000，每个样本的票数不超过 20。

### 三、示例

```text
votes   = [["s1","ann","pos"],["s1","bob","pos"],["s1","cat","neg"],
           ["s2","ann","neg"],["s2","bob","pos"],["s2","cat","pos"]]
weights = {"ann": 2, "bob": 1, "cat": 1}
返回    = [["s1","pos"],["s2","ARBITRATE"]]
```

`s1`：pos 3 分、neg 1 分，取 pos；`s2`：neg 2 分、pos 2 分，并列，转仲裁。
""",
    sample=[[["s1", "ann", "pos"], ["s1", "bob", "pos"], ["s1", "cat", "neg"], ["s2", "ann", "neg"],
             ["s2", "bob", "pos"], ["s2", "cat", "pos"]], {"ann": 2, "bob": 1, "cat": 1}],
    cases=lambda: [
        [[["s1", "ann", "pos"], ["s1", "bob", "pos"], ["s1", "cat", "neg"], ["s2", "ann", "neg"],
          ["s2", "bob", "pos"], ["s2", "cat", "pos"]], {"ann": 2, "bob": 1, "cat": 1}],
        [[], {"ann": 1}],
        [[["s1", "ghost", "pos"], ["s2", "ghost", "neg"]], {"ann": 1}],
        [[["s1", "a", "pos"], ["s1", "b", "neg"], ["s1", "c", "neg"], ["s2", "a", "neg"],
          ["s2", "b", "pos"], ["s2", "c", "pos"]], {"a": 1.5, "b": 0.5, "c": 0.5}],
        [[["t", "a", "x"], ["t", "b", "y"], ["t", "c", "z"]], {"a": 1, "b": 1, "c": 1}],
        [[["s3", "a", "neg"], ["s1", "a", "pos"], ["s2", "b", "neu"]], {"a": 1, "b": 2}],
        [[["only", "a", "lab"]], {"a": 5}],
        [[["s1", "a", "pos"], ["s1", "b", "neg"], ["s1", "c", "neg"], ["s1", "d", "neg"]],
         {"a": 5, "b": 1, "c": 1, "d": 1}],
        [_rand52(random.Random(21), 600, 4), {"ann0": 2, "ann1": 1, "ann2": 1, "ann3": 0.5}],
        [_rand52(random.Random(22), 700, 5, 0.3), {"ann0": 3, "ann1": 2, "ann2": 1, "ann3": 1, "ann4": 0.5, "ann5": 0.5}],
    ],
    reference=merge_labels,
    alt=_alt52,
    fuzz=lambda rng: [_rand52(rng, rng.randint(1, 7), rng.randint(1, 4)),
                      {"ann0": 2, "ann1": 1, "ann2": 0.5, "ann3": 2}],
    negatives={
        "并列时取字典序最小的标签，而不是转仲裁": _tie_smallest,
        "只数人头，不按权重计票": _neg52_headcount,
        "按输入顺序输出，没有按样本 id 排序": _neg52_input_order,
    },
    explanation="""
    用「样本 id → {标签: 加权票数}」的嵌套字典一次遍历完成统计；注意两件事：
    1. 样本一经出现就要登记，哪怕它的票全部无效，最后也要输出 "ARBITRATE"；
    2. 最高分可能不止一个标签，必须把并列与唯一最高分区分开。
    
    最后按样本 id 排序输出。这套规则对应标注审核里的「多数表决 + 仲裁」：置信度不足的样本不硬合并，留给人工，比强行取一个标签更可靠。
    """,
)


# ---------------------------------------------------------------- 53 分组泄漏
def group_leakage(train_ids, test_ids, groups):
    train_groups = {groups[i] for i in train_ids if i in groups}
    leaked = sorted(i for i in test_ids if i in groups and groups[i] in train_groups)
    leaked_groups = sorted({groups[i] for i in leaked})
    rate = round(len(leaked) / len(test_ids), 4) if test_ids else 0.0
    return {"leaked_test_ids": leaked, "leaked_groups": leaked_groups, "leak_rate": rate}


def _alt53(train_ids, test_ids, groups):
    train_counter = Counter(groups[i] for i in train_ids if i in groups)
    leaked, seen = [], set()
    for sid in test_ids:
        gid = groups.get(sid)
        if gid is not None and train_counter[gid] > 0:
            leaked.append(sid)
            seen.add(gid)
    return {
        "leaked_test_ids": sorted(leaked),
        "leaked_groups": sorted(seen),
        "leak_rate": round(len(leaked) / len(test_ids), 4) if test_ids else 0.0,
    }


def _neg53_both_sides(train_ids, test_ids, groups):
    report = group_leakage(train_ids, test_ids, groups)
    shared = {groups[i] for i in train_ids if i in groups} & {groups[i] for i in test_ids if i in groups}
    report["leaked_test_ids"] = sorted(i for i in list(train_ids) + list(test_ids) if i in groups and groups[i] in shared)
    return report


def _neg53_no_get(train_ids, test_ids, groups):
    train_groups = {groups[i] for i in train_ids}
    leaked = sorted(i for i in test_ids if groups[i] in train_groups)
    return {"leaked_test_ids": leaked, "leaked_groups": sorted({groups[i] for i in leaked}),
            "leak_rate": round(len(leaked) / len(test_ids), 4) if test_ids else 0.0}


def _neg53_denominator(train_ids, test_ids, groups):
    report = group_leakage(train_ids, test_ids, groups)
    report["leak_rate"] = round(len(report["leaked_test_ids"]) / (len(train_ids) + len(test_ids)), 4)
    return report


def _rand53(rng, n, n_groups):
    ids = [f"x{i:05d}" for i in range(n)]
    groups = {i: f"g{rng.randrange(n_groups):03d}" for i in ids if rng.random() < 0.85}
    rng.shuffle(ids)
    cut = int(n * 0.8)
    return ids[:cut], ids[cut:], groups


P53 = problem(
    title="训练测试集分组泄漏检查",
    theme="leakage", ability="智能训练", knowledge="训练集与测试集的维护",
    fn="group_leakage", params=["train_ids", "test_ids", "groups"],
    description="""
### 一、题目描述

数字人对话语料按「会话」组织，同一场会话里的多轮对话高度相似。划分训练集与测试集时，同一场会话的样本必须落在同一侧，否则测试指标会被高估，这叫分组泄漏。

请检查测试集，找出所有泄漏样本（所属会话同时出现在训练集中），返回一份报告字典：

```text
{
  "leaked_test_ids":  按字典序升序的泄漏样本 id 列表,
  "leaked_groups":    涉及的会话 id 列表（去重、字典序升序）,
  "leak_rate":        泄漏样本数 / 测试集样本数，
                      用 round(x, 4) 保留 4 位小数；测试集为空时为 0.0
}
```

### 二、输入说明

- `train_ids` / `test_ids`：样本 id 列表，各自内部不重复，顺序任意，可能为空；
- `groups`：`{样本id: 会话id}`。不在 `groups` 中的样本视为独立会话，不会造成泄漏；
- 样本总数不超过 20000。

### 三、示例

```text
train_ids = ["u1","u2","u5"]
test_ids  = ["u3","u4","u6"]
groups    = {"u1":"c1","u2":"c2","u3":"c1","u4":"c3","u5":"c2","u6":"c9"}
返回      = {"leaked_test_ids": ["u3"], "leaked_groups": ["c1"],
            "leak_rate": 0.3333}
```

`u3` 属于 `c1`，而 `c1` 的 `u1` 在训练集，所以 `u3` 泄漏。
""",
    sample=[["u1", "u2", "u5"], ["u3", "u4", "u6"],
            {"u1": "c1", "u2": "c2", "u3": "c1", "u4": "c3", "u5": "c2", "u6": "c9"}],
    cases=lambda: [
        [["u1", "u2", "u5"], ["u3", "u4", "u6"],
         {"u1": "c1", "u2": "c2", "u3": "c1", "u4": "c3", "u5": "c2", "u6": "c9"}],
        [["a", "b"], ["c", "d"], {"a": "1", "b": "1", "c": "2", "d": "3"}],
        [["a", "b"], [], {"a": "1", "b": "1"}],
        [["a"], ["b", "c"], {"a": "g1"}],
        [["p", "q"], ["z", "a", "m"], {"p": "g", "q": "h", "z": "g", "a": "g", "m": "h"}],
        [["a", "b"], ["c", "d"], {"a": "s", "b": "s", "c": "s", "d": "s"}],
        [["a", "b"], ["b", "c"], {"a": "s", "b": "s", "c": "t"}],
        list(_rand53(random.Random(31), 400, 25)),
        list(_rand53(random.Random(32), 3000, 120)),
        list(_rand53(random.Random(33), 5000, 40)),
    ],
    reference=group_leakage,
    alt=_alt53,
    fuzz=lambda rng: list(_rand53(rng, rng.randint(0, 30), rng.randint(1, 6))),
    negatives={
        "把训练集里的同会话样本也列进了泄漏列表": _neg53_both_sides,
        "直接用 groups[样本id] 取值，没有处理缺失的样本": _neg53_no_get,
        "泄漏率的分母用了训练集与测试集之和": _neg53_denominator,
    },
    explanation="""
    先用集合收集训练集涉及的会话（注意过滤不在 groups 里的样本），再遍历测试集：属于这些会话的就是泄漏样本。要点：
    1. 查找方向是单向的——只标记测试集样本；
    2. 缺失的样本用 dict.get 或先判断 in，不能直接下标；
    3. 泄漏率先 round 再返回，测试集为空时避免除零。
    
    发现泄漏后的正确处理是「按会话重新划分」，而不是简单删掉几条测试样本，否则同一会话的其余轮次仍然留在测试集里。
    """,
)


# ---------------------------------------------------------------- 54 显存容量测算
def gpu_plan(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    usable = gpu_mem_gb - reserved_gb
    replicas = int(usable // model_mem_gb)
    qps_per_gpu = round(replicas * batch_size * 1000 / latency_ms, 3)
    gpus_needed = math.ceil(target_qps / qps_per_gpu) if qps_per_gpu > 0 else 0
    return [replicas, qps_per_gpu, gpus_needed]


def _alt54(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    from fractions import Fraction

    def frac(x):
        return Fraction(str(x))

    usable = frac(gpu_mem_gb) - frac(reserved_gb)
    replicas = usable // frac(model_mem_gb)
    qps_per_gpu = round(float(replicas * frac(batch_size) * 1000 / frac(latency_ms)), 3)
    gpus_needed = math.ceil(frac(target_qps) / frac(qps_per_gpu))
    return [int(replicas), qps_per_gpu, int(gpus_needed)]


def _neg54_no_reserve(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    return gpu_plan(model_mem_gb, gpu_mem_gb, 0, latency_ms, batch_size, target_qps)


def _neg54_round_gpus(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    replicas, qps_per_gpu, _ = gpu_plan(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps)
    return [replicas, qps_per_gpu, round(target_qps / qps_per_gpu)]


def _neg54_no_batch(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, batch_size, target_qps):
    return gpu_plan(model_mem_gb, gpu_mem_gb, reserved_gb, latency_ms, 1, target_qps)


P54 = problem(
    title="推理服务显存容量测算",
    theme="capacity", ability="智能系统设计", knowledge="智能系统监控与容量规划",
    fn="gpu_plan", params=["model_mem_gb", "gpu_mem_gb", "reserved_gb", "latency_ms", "batch_size", "target_qps"],
    imports="import math",
    description="""
### 一、题目描述

数字人语音合成推理服务部署在 GPU 上，上线前要测算需要多少张卡。已知：

- 每张 GPU 显存 `gpu_mem_gb`，其中 `reserved_gb` 要预留给框架和缓存，不能给模型实例使用；
- 每个模型实例常驻 `model_mem_gb` 显存；单卡能放下的实例数越多，吞吐越高；
- 单个实例处理一个批次耗时 `latency_ms` 毫秒，每批 `batch_size` 条请求。

请求持续到达时，请返回 `[replicas_per_gpu, qps_per_gpu, gpus_needed]`：

1. `replicas_per_gpu`：单卡可部署的模型实例数（向下取整）。保证单卡至少能放下 1 个实例；
2. `qps_per_gpu`：单卡持续吞吐（条/秒）= 实例数 × `batch_size` × 1000 / `latency_ms`，用 `round(x, 3)` 保留 3 位小数；
3. `gpus_needed`：支撑 `target_qps` 所需的最少 GPU 数量，按第 2 步得到的 `qps_per_gpu` 向上取整。

### 二、输入说明

各参数均为正数（`batch_size`、`target_qps` 为正整数，其余可能是小数），小数最多一位。

### 三、示例

```text
gpu_plan(6, 24, 2, 40, 4, 100) → [3, 300.0, 1]
```

可用显存 22，放 3 个实例；单卡吞吐 3 × 4 × 1000 / 40 = 300；100 QPS 只需 1 张卡。
""",
    sample=[6, 24, 2, 40, 4, 100],
    cases=lambda: [
        [6, 24, 2, 40, 4, 100],
        [1.5, 16, 1, 20, 2, 500],
        [2.5, 24, 3, 50, 8, 900],
        [7, 80, 6, 125, 16, 2000],
        [4, 80, 6, 125, 16, 2560],
        [3, 80, 20, 33, 4, 200],
        [1, 80, 0, 10, 1, 7000],
        [12, 96, 24, 200, 32, 1000],
        [0.5, 8, 0.5, 25, 1, 100],
        [5, 40, 5, 8, 2, 2100],
    ],
    reference=gpu_plan,
    alt=_alt54,
    negatives={
        "没有扣除预留显存": _neg54_no_reserve,
        "GPU 数量四舍五入而不是向上取整": _neg54_round_gpus,
        "吞吐忘了乘 batch_size": _neg54_no_batch,
    },
    explanation="""
    容量测算要分清「存量」和「流量」：显存决定能同时放几个实例（容量），延迟和批大小决定每个实例每秒能吐出多少条（吞吐）。
    1. 实例数 = (显存 − 预留) // 单实例显存，用向下取整；
    2. 单实例每秒处理 1000 / latency_ms 个批次，每批 batch_size 条；
    3. 卡数 = ceil(目标 QPS / 单卡 QPS)：差一点也要多加一张卡，四舍五入会让容量不足。
    
    训练师在提出扩容或降级需求时，需要用这样的测算给出量化依据，对应《标准》三级 3.1「智能系统监控和优化」。
    """,
)


# ---------------------------------------------------------------- 55 路由阈值
def route_threshold(scores, labels, min_auto_rate, min_precision):
    n = len(scores)
    pairs = sorted(zip(scores, labels), key=lambda p: -p[0])
    feasible = []
    auto = correct = 0
    for i, (score, is_correct) in enumerate(pairs):
        auto += 1
        correct += 1 if is_correct else 0
        # 置信度相同的会话必须同进同出，只在这一组的最后一条处评估
        if i + 1 < n and pairs[i + 1][0] == score:
            continue
        if auto / n >= min_auto_rate and correct / auto >= min_precision:
            feasible.append(score)
    if not feasible:
        return [None, 0.0, 0.0]
    threshold = min(feasible)
    picked = [ok for score, ok in pairs if score >= threshold]
    return [threshold, round(len(picked) / n, 4), round(sum(picked) / len(picked), 4)]


def _alt55(scores, labels, min_auto_rate, min_precision):
    best = None
    for threshold in sorted(set(scores)):
        picked = [ok for score, ok in zip(scores, labels) if score >= threshold]
        if len(picked) / len(scores) >= min_auto_rate and sum(picked) / len(picked) >= min_precision:
            best = threshold
            break  # 阈值从小到大试，第一个满足的就是最小的
    if best is None:
        return [None, 0.0, 0.0]
    picked = [ok for score, ok in zip(scores, labels) if score >= best]
    return [best, round(len(picked) / len(scores), 4), round(sum(picked) / len(picked), 4)]


def _neg55_ignore_rate(scores, labels, min_auto_rate, min_precision):
    return route_threshold(scores, labels, 0.0, min_precision)


def _neg55_largest(scores, labels, min_auto_rate, min_precision):
    best = None
    for threshold in sorted(set(scores), reverse=True):  # 从高往低找，第一个可行的是最大的
        picked = [ok for score, ok in zip(scores, labels) if score >= threshold]
        if len(picked) / len(scores) >= min_auto_rate and sum(picked) / len(picked) >= min_precision:
            best = threshold
            break
    if best is None:
        return [None, 0.0, 0.0]
    picked = [ok for score, ok in zip(scores, labels) if score >= best]
    return [best, round(len(picked) / len(scores), 4), round(sum(picked) / len(picked), 4)]


def _neg55_recall(scores, labels, min_auto_rate, min_precision):
    n, total_correct = len(scores), sum(1 for ok in labels if ok)
    best = None
    for threshold in sorted(set(scores)):
        hit = [1 for score, ok in zip(scores, labels) if score >= threshold and ok]
        if sum(1 for s in scores if s >= threshold) / n >= min_auto_rate and sum(hit) / total_correct >= min_precision:
            best = threshold
            break
    if best is None:
        return [None, 0.0, 0.0]
    picked = [ok for score, ok in zip(scores, labels) if score >= best]
    return [best, round(len(picked) / n, 4), round(sum(picked) / total_correct, 4)]


def _rand55(rng, n):
    scores, labels = [], []
    for _ in range(n):
        score = rng.choice([0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95])
        scores.append(score)
        labels.append(rng.random() < score)
    return scores, labels


P55 = problem(
    title="人机协同路由阈值测算",
    theme="routing", ability="智能系统设计", knowledge="人机交互流程设计",
    fn="route_threshold", params=["scores", "labels", "min_auto_rate", "min_precision"],
    description="""
### 一、题目描述

数字人客服给每条会话打一个意图置信度 `score`（0 到 1）。路由规则：置信度不低于阈值 `t` 的会话由数字人自动应答，其余转人工。

`labels[i]` 为 `True` 表示第 i 条会话数字人的回答正确。业务对自动应答提出两项要求：

- 自动应答率 = 自动应答的会话数 / 总会话数，不低于 `min_auto_rate`；
- 自动应答准确率 = 自动应答且回答正确的会话数 / 自动应答的会话数，不低于 `min_precision`。

为了让数字人多接管一些会话，请在同时满足两项要求的阈值中取最小的 `t`。阈值只能取 `scores` 中出现过的数值。

返回 `[t, 自动应答率, 自动应答准确率]`，后两项用 `round(x, 4)` 保留 4 位小数；不存在满足要求的阈值时返回 `[None, 0.0, 0.0]`。

### 二、输入说明

- `scores` 与 `labels` 等长（1 ≤ 长度 ≤ 5000），`scores` 里的数值可能有重复；重复的置信度必须一起进或一起出；
- `scores` 保留至多两位小数。

### 三、示例

```text
scores       = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45]
labels       = [True, True, True, True, True, False, True, False, False, False]
min_auto_rate = 0.5，min_precision = 0.8
返回         = [0.6, 0.7, 0.8571]
```

`t = 0.6` 时自动应答 7 条、其中 6 条正确，自动应答率 0.7、准确率约 0.857，两项都满足；再低的阈值准确率会掉到 0.8 以下。
""",
    sample=[[0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45],
            [True, True, True, True, True, False, True, False, False, False], 0.5, 0.8],
    cases=lambda: [
        [[0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45],
         [True, True, True, True, True, False, True, False, False, False], 0.5, 0.8],
        [[0.9, 0.8, 0.7], [False, False, False], 0.5, 0.5],
        [[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
         [True, True, True, True, True, True, True, True, True, False], 0.9, 0.8],
        [[0.8, 0.8, 0.6, 0.6], [True, False, True, True], 0.5, 0.75],
        [[5, 4, 3, 2, 1], [True, True, False, True, False], 0.4, 0.5],
        [[0.7], [False], 1.0, 0.0],
        [[0.9, 0.8, 0.7], [True, True, False], 0.6667, 0.5],
        [[0.9, 0.9, 0.6, 0.6, 0.6, 0.6], [True, True, False, False, False, False], 0.5, 0.6],
        [*_rand55(random.Random(51), 300), 0.6, 0.8],
        [*_rand55(random.Random(52), 2000), 0.5, 0.75],
    ],
    reference=route_threshold,
    alt=_alt55,
    fuzz=lambda rng: [*_rand55(rng, rng.randint(1, 14)), rng.choice([0.2, 0.3, 0.5, 0.6, 0.7, 0.8]),
                      rng.choice([0.5, 0.6, 0.7, 0.8, 0.9])],
    negatives={
        "只看准确率，忽略了自动应答率下限": _neg55_ignore_rate,
        "取了最大的可行阈值": _neg55_largest,
        "把准确率算成了召回率": _neg55_recall,
    },
    explanation="""
    思路：把会话按置信度从高到低排好，阈值从高往低移动时，自动应答的会话一条条加入，用两个计数器（已接管数、其中正确数）就能边扫边算，复杂度 O(n log n)。易错点有三个：
    1. 置信度相同的会话是一个整体，要扫到这一组的最后一条才能评估这个阈值；
    2. 题目要的是「满足要求的最小阈值」，即数字人接管得最多的那个方案，不是最保守的；
    3. 准确率的分母是「自动应答的会话数」，不是全部会话，也不是全部正确会话。
    
    这正是人机协同流程设计的核心：用数据找到「机器多接一点」与「接得住」之间的平衡点，对应《标准》三级 3.2。
    """,
)


# ---------------------------------------------------------------- 56 配额分配
def allocate_quotas(strata, total, min_each):
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
    return quota


def _alt56(strata, total, min_each):
    from fractions import Fraction

    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    if remaining > 0 and sum(capacity) > 0:
        shares = [Fraction(remaining) * c / sum(capacity) for c in capacity]
        floors = [s.numerator // s.denominator for s in shares]
        quota = [q + f for q, f in zip(quota, floors)]
        left = remaining - sum(floors)
        ranked = sorted(range(len(strata)), key=lambda i: (floors[i] - shares[i], i))
        for i in ranked[:left]:
            quota[i] += 1
    return quota


def _floor_only56(strata, total, min_each):
    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    pool = sum(capacity)
    if remaining > 0 and pool > 0:
        quota = [q + remaining * c // pool for q, c in zip(quota, capacity)]
    return quota


def _neg56_tie_later(strata, total, min_each):
    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    pool = sum(capacity)
    if remaining > 0 and pool > 0:
        base = [remaining * c // pool for c in capacity]
        remainder = [remaining * c % pool for c in capacity]
        quota = [q + b for q, b in zip(quota, base)]
        left = remaining - sum(base)
        for i in sorted(range(len(strata)), key=lambda i: (-remainder[i], -i))[:left]:
            quota[i] += 1
    return quota


def _neg56_float_remainder(strata, total, min_each):
    quota = [min(min_each, size) for _, size in strata]
    capacity = [size - q for (_, size), q in zip(strata, quota)]
    remaining = total - sum(quota)
    pool = sum(capacity)
    if remaining > 0 and pool > 0:
        shares = [remaining * c / pool for c in capacity]
        quota = [q + math.floor(s) for q, s in zip(quota, shares)]
        left = remaining - sum(math.floor(s) for s in shares)
        for i in sorted(range(len(strata)), key=lambda i: (-(shares[i] - math.floor(shares[i])), i))[:left]:
            quota[i] += 1
    return quota


def _rand56(rng, n):
    strata = [[f"L{i:03d}", rng.randint(0, 60)] for i in range(n)]
    size_sum = sum(s for _, s in strata)
    return [strata, rng.randint(0, size_sum), rng.randint(0, 6)]


P56 = problem(
    title="分层抽样配额分配",
    theme="sampling", ability="智能训练", knowledge="评测集构建与分层抽样",
    fn="allocate_quotas", params=["strata", "total", "min_each"],
    description="""
### 一、题目描述

要从数字人各业务线的数据中抽取 `total` 条做评测集。`strata` 的每项是 `[层名, 该层样本数]`。请按下面的规则给每层分配抽取条数：

1. 保底：每层先分 `min(min_each, 该层样本数)` 条；
2. 剩余名额 R = total − 各层保底之和，按各层「剩余容量」（样本数 − 保底）占比分配，使用最大余数法：先分 `floor(R × 该层剩余容量 / 剩余容量总和)`，再把因取整少分的名额按小数余数从大到小各加 1；余数相同时，层数组中下标小的优先。

函数返回与 `strata` 顺序一致的配额列表。保证 `total` 不超过各层样本数之和。

### 二、输入说明

- `strata`：1 ≤ 层数 ≤ 500，样本数为不超过 10^5 的非负整数（可以是 0）；`min_each` 为非负整数；
- 请用整数运算（`//` 与 `%`）计算取整和余数：直接用浮点数比较余数，会因精度误差在并列时排错顺序。

### 三、示例

```text
strata   = [["短对话", 52], ["长对话", 23], ["闲聊", 25]]
total    = 50，min_each = 0
返回     = [26, 12, 12]
```

R = 50，占比 0.52、0.23、0.25，先取 26、11、12，还差 1 条；余数为 0、0.5、0.5，并列取下标小的「长对话」。
""",
    sample=[[["短对话", 52], ["长对话", 23], ["闲聊", 25]], 50, 0],
    cases=lambda: [
        [[["短对话", 52], ["长对话", 23], ["闲聊", 25]], 50, 0],
        [[["A", 300], ["B", 200], ["C", 500]], 100, 0],
        [[["A", 1], ["B", 99]], 10, 5],
        [[["A", 10], ["B", 10]], 20, 10],
        [[["A", 0], ["B", 30], ["C", 10]], 20, 4],
        [[["x", 10], ["y", 10], ["z", 10]], 10, 0],
        [[["a", 50], ["b", 1], ["c", 1], ["d", 48]], 10, 0],
        [[["a", 6], ["b", 16], ["c", 8]], 3, 0],
        _rand56(random.Random(61), 40),
        _rand56(random.Random(62), 500),
    ],
    reference=allocate_quotas,
    alt=_alt56,
    fuzz=lambda rng: _rand56(rng, rng.randint(1, 7)),
    negatives={
        "只做向下取整，没有分配少掉的名额": _floor_only56,
        "余数并列时下标大的层优先": _neg56_tie_later,
        "用浮点数计算和比较余数": _neg56_float_remainder,
    },
    explanation="""
    最大余数法（汉密尔顿法）是配额分配的标准做法：先按占比取整，再把因取整丢掉的名额补给余数最大的层。
    1. 先扣掉保底，后面的一切都基于「剩余容量」而不是原始样本数；
    2. floor 与余数都用整数运算：R × 容量 // 总容量、R × 容量 % 总容量，这样余数并列就是真正的并列；
    3. 排序键写成 (−余数, 下标)，一次 sorted 同时处理「余数大优先」和「并列下标小优先」。
    
    第 8 个测试点里，两层的余数在数学上相等，浮点数却一个 0.6、一个 0.6000000000000001，这是很多实现翻车的地方。
    """,
)


# ---------------------------------------------------------------- 57 告警聚合
def aggregate_alerts(alerts, window_sec):
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
                top = min(top, severity)  # P1 < P2 < P3，字典序最小的级别最高
            else:
                incidents.append([service, metric, start, prev, count, top])
                start, count, top = ts, 1, severity
            prev = ts
        incidents.append([service, metric, start, prev, count, top])
    return incidents


def _alt57(alerts, window_sec):
    ordered = sorted((service, metric, ts, severity) for ts, service, metric, severity in alerts)
    incidents, current = [], None
    for service, metric, ts, severity in ordered:
        if current and current[0] == service and current[1] == metric and ts - current[3] <= window_sec:
            current[3] = ts
            current[4] += 1
            current[5] = min(current[5], severity)
        else:
            if current:
                incidents.append(current)
            current = [service, metric, ts, ts, 1, severity]
    if current:
        incidents.append(current)
    return incidents


def _neg57_strict(alerts, window_sec):
    by_key = {}
    for ts, service, metric, severity in alerts:
        by_key.setdefault((service, metric), []).append((ts, severity))
    incidents = []
    for service, metric in sorted(by_key):
        group = sorted(by_key[(service, metric)])
        start = prev = group[0][0]
        count, top = 1, group[0][1]
        for ts, severity in group[1:]:
            if ts - prev < window_sec:
                count += 1
                top = min(top, severity)
            else:
                incidents.append([service, metric, start, prev, count, top])
                start, count, top = ts, 1, severity
            prev = ts
        incidents.append([service, metric, start, prev, count, top])
    return incidents


def _merge_chain(group, window_sec, service, metric, sort_first=True, highest=min):
    chain = sorted(group) if sort_first else list(group)
    incidents, start, prev, count, top = [], chain[0][0], chain[0][0], 1, chain[0][1]
    for ts, severity in chain[1:]:
        if ts - prev <= window_sec:
            count += 1
            top = highest(top, severity)
        else:
            incidents.append([service, metric, start, prev, count, top])
            start, count, top = ts, 1, severity
        prev = ts
    incidents.append([service, metric, start, prev, count, top])
    return incidents


def _neg57_unsorted(alerts, window_sec):
    by_key = {}
    for ts, service, metric, severity in alerts:
        by_key.setdefault((service, metric), []).append((ts, severity))
    return [row for key in sorted(by_key) for row in _merge_chain(by_key[key], window_sec, key[0], key[1], sort_first=False)]


def _neg57_severity_max(alerts, window_sec):
    by_key = {}
    for ts, service, metric, severity in alerts:
        by_key.setdefault((service, metric), []).append((ts, severity))
    return [row for key in sorted(by_key) for row in _merge_chain(by_key[key], window_sec, key[0], key[1], highest=max)]


def _rand57(rng, n, n_services, metrics, span):
    return [[rng.randrange(span), f"svc{i:02d}", rng.choice(metrics), rng.choice(["P1", "P2", "P3", "P3", "P3"])]
            for i in range(n)]


P57 = problem(
    title="告警聚合抑制与值班负载测算",
    theme="alerts", ability="智能系统设计", knowledge="智能系统监控与告警治理",
    fn="aggregate_alerts", params=["alerts", "window_sec"],
    description="""
### 一、题目描述

数字人平台的监控每隔几秒就可能发出一条告警，同一个小故障往往会刷出很多条。值班员需要的是「事件」而不是「告警」。请把告警聚合成事件：

1. 按 (服务名, 指标名) 分组，组内按时间先后排列；
2. 组内相邻两条告警的时间间隔不超过 `window_sec` 时，合并成同一个事件（只要相邻间隔都满足，事件可以一直延续）；
3. 每个事件输出 `[服务名, 指标名, 首次时间, 末次时间, 告警条数, 最高级别]`。级别为 `"P1"`、`"P2"`、`"P3"`，P1 最高。

函数返回事件列表，按 (服务名, 指标名) 字典序升序，同一组内按首次时间升序。

### 二、输入说明

- `alerts`：列表，每项 `[时间戳, 服务名, 指标名, 级别]`。时间戳为整数（秒），可能相同；输入顺序是打乱的；
- `window_sec` 为非负整数；告警总数不超过 20000。

### 三、示例

```text
alerts = [[0,"tts","p99","P2"],[30,"tts","p99","P3"],[45,"tts","p99","P1"],
          [100,"tts","p99","P2"],[200,"asr","err","P3"],[260,"asr","err","P2"]]
window_sec = 20
```

`tts/p99` 分为三段：`[0,0]`、`[30,45]`、`[100,100]`；`asr/err` 的两条间隔 60，互不合并。

```text
返回 = [["asr","err",200,200,1,"P3"],["asr","err",260,260,1,"P2"],
        ["tts","p99",0,0,1,"P2"],["tts","p99",30,45,2,"P1"],
        ["tts","p99",100,100,1,"P2"]]
```
""",
    sample=[[[0, "tts", "p99", "P2"], [30, "tts", "p99", "P3"], [45, "tts", "p99", "P1"], [100, "tts", "p99", "P2"],
             [200, "asr", "err", "P3"], [260, "asr", "err", "P2"]], 20],
    cases=lambda: [
        [[[0, "tts", "p99", "P2"], [30, "tts", "p99", "P3"], [45, "tts", "p99", "P1"], [100, "tts", "p99", "P2"],
          [200, "asr", "err", "P3"], [260, "asr", "err", "P2"]], 20],
        [[], 60],
        [[[50, "a", "m", "P3"], [10, "a", "m", "P1"], [30, "a", "m", "P2"]], 20],
        [[[5, "s", "m", "P2"], [5, "s", "m", "P3"], [6, "s", "m", "P1"]], 0],
        [[[0, "svc", "cpu", "P2"], [1, "svc", "mem", "P3"], [2, "svc", "cpu", "P1"]], 10],
        [[[0, "k", "m", "P3"], [20, "k", "m", "P3"], [40, "k", "m", "P3"], [41, "k", "m", "P1"]], 20],
        [[[0, "k", "m", "P3"], [21, "k", "m", "P3"]], 20],
        [[[5, "zeta", "m", "P3"], [1, "alpha", "m", "P2"], [3, "Beta", "m", "P1"]], 100],
        [_rand57(random.Random(71), 1500, 40, ["cpu", "mem", "p99", "err", "qps", "disk"], 3600), 3600],
        [_rand57(random.Random(72), 4000, 60, ["cpu", "mem", "p99", "err", "qps", "disk"], 86400), 1800],
    ],
    reference=aggregate_alerts,
    alt=_alt57,
    fuzz=lambda rng: [_rand57(rng, rng.randint(1, 25), rng.randint(1, 3), ["a", "b"], 40), rng.randint(0, 12)],
    negatives={
        "间隔小于 window_sec 才合并，漏掉了恰好等于窗口的边界": _neg57_strict,
        "没有先按时间排序，按输入顺序合并": _neg57_unsorted,
        "用字符串比较取最高级别（得到 P3）": _neg57_severity_max,
    },
    explanation="""
    这是「分组 + 排序 + 一次线性扫描」的标准套路：
    1. 用 (服务, 指标) 作字典键分组，组内先按时间排序——输入顺序不可信；
    2. 扫描时维护「当前事件的起点、上一条时间、条数、最高级别」；与上一条的间隔 ≤ window 就延续，否则结算上一个事件并开新的；
    3. 结束后别漏掉最后一个事件。级别 "P1" < "P2" < "P3" 的字符串顺序恰好是「越高越小」，取 min 即可。
    
    告警聚合的价值在于降低值班负载：把重复告警压成事件，值班员面对的才是可以处理的故障数量，对应《标准》三级 3.1 的系统监控要求。
    """,
)


PROBLEMS = [P51, P52, P53, P54, P55, P56, P57]
