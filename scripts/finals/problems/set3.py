"""第 3 套编程题（51–57）。字段含义见 scripts/finals/build.py 的文件说明。

多参数用例统一写成元组再展开（sample=[*S51]），避免手数括号出错。
"""
import random
from collections import Counter, defaultdict
from fractions import Fraction

import common


def problem(**spec):
    return spec


def _ms(names, durations, deps):
    """模块内共用：按最早开始时间算完工时间（参考解里另有一份内嵌实现）。"""
    index = {name: i for i, name in enumerate(names)}
    n = len(names)
    succ = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in deps:
        succ[index[a]].append(index[b])
        indeg[index[b]] += 1
    finish = [0] * n
    stack = [i for i in range(n) if indeg[i] == 0]
    while stack:
        v = stack.pop()
        finish[v] = max(finish[v], durations[v])
        for w in succ[v]:
            finish[w] = max(finish[w], finish[v] + durations[w])
            indeg[w] -= 1
            if indeg[w] == 0:
                stack.append(w)
    return max(finish, default=0)


# ---------------------------------------------------------------- 51 流程提速方案
def speedup_plan(names, durations, deps, max_cut, budget):
    def makespan(durs):
        index = {name: i for i, name in enumerate(names)}
        succ = [[] for _ in names]
        indeg = [0] * len(names)
        for a, b in deps:
            succ[index[a]].append(index[b])
            indeg[index[b]] += 1
        finish = [0] * len(names)
        stack = [i for i in range(len(names)) if indeg[i] == 0]
        while stack:
            v = stack.pop()
            finish[v] = max(finish[v], durs[v])
            for w in succ[v]:
                finish[w] = max(finish[w], finish[v] + durs[w])
                indeg[w] -= 1
                if indeg[w] == 0:
                    stack.append(w)
        return max(finish, default=0)

    best = None
    for i in range(len(names)):
        trial = list(durations)
        trial[i] -= min(max_cut[i], budget)  # 环节 i 最多压缩到 min(自身可压缩量, 预算)
        candidate = (makespan(trial), i)
        if best is None or candidate < best:
            best = candidate
    return [names[best[1]], best[0]]


def _alt51(names, durations, deps, max_cut, budget):
    # 暴力：枚举全部「入点到出点」的路径，压缩某个环节后逐条路径求和
    n = len(names)
    succ = [[] for _ in range(n)]
    has_pred = [False] * n
    for a, b in deps:
        succ[names.index(a)].append(names.index(b))
        has_pred[names.index(b)] = True
    paths = []

    def walk(path):
        v = path[-1]
        if not succ[v]:
            paths.append(list(path))
        for w in succ[v]:
            walk(path + [w])

    for s in range(n):
        if not has_pred[s]:
            walk([s])

    def span(target):
        return max(sum(durations[v] - min(max_cut[v], budget) if v == target else durations[v] for v in path)
                   for path in paths)

    value, i = min((span(i), i) for i in range(n))
    return [names[i], value]


def _neg51_biggest(names, durations, deps, max_cut, budget):
    i = min(range(len(names)), key=lambda v: (-durations[v], v))  # 只挑耗时最大的环节
    trial = list(durations)
    trial[i] -= min(max_cut[i], budget)
    return [names[i], _ms(names, trial, deps)]


def _neg51_no_budget(names, durations, deps, max_cut, budget):
    best = None
    for i in range(len(names)):
        trial = list(durations)
        trial[i] -= max_cut[i]  # 不管预算，按可压缩量压满
        candidate = (_ms(names, trial, deps), i)
        if best is None or candidate < best:
            best = candidate
    return [names[best[1]], best[0]]


def _neg51_later(names, durations, deps, max_cut, budget):
    best = None
    for i in range(len(names)):
        trial = list(durations)
        trial[i] -= min(max_cut[i], budget)
        candidate = (_ms(names, trial, deps), -i)  # 并列时下标大者优先
        if best is None or candidate < best:
            best = candidate
    return [names[-best[1]], best[0]]


def _rand51(rng, count):
    names, durations, deps = common.rand_dag(rng, count, 0.3 if count < 100 else 0.08)
    return names, durations, deps, [d - 1 for d in durations], rng.randint(0, 6)


S51 = (["a", "b", "c", "d"], [2, 3, 4, 1], [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]], [0, 1, 2, 1], 2)

P51 = problem(
    title="流程提速方案与预算分配",
    theme="critical_path", ability="业务分析", knowledge="业务流程设计与优化",
    fn="speedup_plan", params=["names", "durations", "deps", "max_cut", "budget"],
    description=r'''
    ### 一、题目描述

    一条数字人语料处理流水线由 n 个环节组成，环节之间有先后依赖，互不依赖的环节可以并行。现在有 `budget` 个单位的提速预算：每把**某一个**环节的耗时压缩 1 个单位，花费 1 个单位预算。

    第 i 个环节最多可压缩 `max_cut[i]` 个单位。只能选择一个环节，把它压缩 `min(max_cut[i], budget)` 个单位。请选择让完工时间下降最多的环节，返回 `[环节名称, 压缩后的完工时间]`；效果相同时取 `names` 中下标较小的环节。

    ### 二、输入说明

    - `names`：长度为 n（1 ≤ n ≤ 500）的字符串列表，环节名称互不相同；
    - `durations`：与 `names` 等长的整数列表，耗时（1 ≤ durations[i] ≤ 50）；
    - `deps`：依赖列表，每项 `[a, b]` 表示 a 完成之后 b 才能开始。保证无环、无重复依赖；
    - `max_cut`：与 `names` 等长，0 ≤ max_cut[i] < durations[i]；`budget` 为非负整数。

    ### 三、示例

    ```text
    names      = ["a", "b", "c", "d"]
    durations  = [2, 3, 4, 1]
    deps       = [["a","b"],["a","c"],["b","d"],["c","d"]]
    max_cut    = [0, 1, 2, 1]，budget = 2
    返回       = ["c", 6]
    ```

    关键路径是 `a → c → d`（耗时 7），`a` 不可压缩。把 `c` 压缩 2 个单位后，`a → c → d` 变成 5，但 `a → b → d` 仍是 6，所以完工时间为 6；压缩 `d` 1 个单位后完工时间同样是 6，并列时取下标较小的 `c`；压缩 `b` 不起作用。
    ''',
    sample=[*S51],
    cases=lambda: [
        [*S51],
        [["only"], [5], [], [2], 3],
        [["x", "y"], [4, 4], [["x", "y"]], [4, 4], 1],
        [["a", "b", "c"], [1, 9, 1], [["a", "b"], ["b", "c"]], [0, 5, 0], 5],
        [["a", "c", "e", "b", "d"], [1, 3, 1, 2, 1], [["a", "c"], ["c", "e"], ["b", "d"]], [1, 2, 1, 1, 0], 2],
        [["p", "q"], [3, 3], [["p", "q"]], [2, 2], 2],
        [["a", "b", "c"], [2, 2, 2], [["a", "b"], ["b", "c"]], [1, 1, 1], 0],
        [["z", "m", "a"], [1, 2, 3], [["a", "m"], ["m", "z"]], [1, 2, 3], 9],
        _rand51(random.Random(301), 40),
        _rand51(random.Random(302), 500),
    ],
    reference=speedup_plan,
    alt=_alt51,
    alt_case_ok=lambda args: len(args[0]) <= 10,
    fuzz=lambda rng: _rand51(rng, rng.randint(1, 8)),
    negatives={
        "只挑耗时最大的环节，没有看它是否在关键路径上": _neg51_biggest,
        "没有受预算约束，按可压缩量压满": _neg51_no_budget,
        "效果并列时取了下标较大的环节": _neg51_later,
    },
    explanation=r'''
    最直接的做法是逐个环节试：把它的耗时减去 `min(max_cut, budget)`，重新算一遍完工时间，取最小值。n ≤ 500 时最多 500 次计算，每次用「拓扑序 + 最早开始时间」的动态规划求完工时间，完全来得及。

    背后的业务结论很重要：只有压缩**关键路径**上的环节才能缩短总工期，压缩非关键环节只是浪费预算。另外注意预算不够时只能压缩一部分，以及并列时取下标较小的环节。
    ''',
)


# ---------------------------------------------------------------- 52 Cohen's Kappa
def _level(kappa):
    if kappa == 1:
        return "完全一致"
    for edge, name in ((0.8, "很强"), (0.6, "较强"), (0.4, "中等"), (0.2, "较弱"), (0.0, "极弱")):
        if kappa >= edge:
            return name
    return "差"


def kappa_report(ann_a, ann_b, categories):
    n = len(ann_a)
    matrix = {c: {d: 0 for d in categories} for c in categories}  # matrix[a 的标签][b 的标签] = 条数
    for a, b in zip(ann_a, ann_b):
        matrix[a][b] += 1
    observed = sum(matrix[c][c] for c in categories) / n
    expected = sum(sum(matrix[c].values()) * sum(matrix[d][c] for d in categories)
                   for c in categories) / (n * n)
    kappa = 1.0 if observed == 1 else (observed - expected) / (1 - expected)
    label = "完全一致" if kappa == 1 else "很强" if kappa >= 0.8 else "较强" if kappa >= 0.6 \
        else "中等" if kappa >= 0.4 else "较弱" if kappa >= 0.2 else "极弱" if kappa >= 0 else "差"
    return {"po": round(observed, 4), "pe": round(expected, 4), "kappa": round(kappa, 4), "level": label}


def _alt52(ann_a, ann_b, categories):
    n = len(ann_a)
    agree = sum(1 for a, b in zip(ann_a, ann_b) if a == b)
    po = Fraction(agree, n)
    pe = sum(Fraction(ann_a.count(c) * ann_b.count(c)) for c in categories) / (n * n)
    kappa = Fraction(1) if po == 1 else (po - pe) / (1 - pe)
    return {"po": round(float(po), 4), "pe": round(float(pe), 4), "kappa": round(float(kappa), 4),
            "level": _level(float(kappa))}


def _fuzz52(rng):
    # 题面声明不考「kappa 恰好落在等级边界」，随机用例避开 0.2 / 0.4 / 0.6 / 0.8
    edges = (Fraction(1, 5), Fraction(2, 5), Fraction(3, 5), Fraction(4, 5))
    while True:
        a, b, cats = _rand52(rng, rng.randint(1, 15), rng.randint(1, 4))
        n = len(a)
        po = Fraction(sum(x == y for x, y in zip(a, b)), n)
        pe = sum(Fraction(a.count(c) * b.count(c)) for c in cats) / (n * n)
        kappa = Fraction(1) if po == 1 else (po - pe) / (1 - pe)
        if kappa not in edges:
            return a, b, cats


def _neg52_no_correction(ann_a, ann_b, categories):
    report = kappa_report(ann_a, ann_b, categories)
    report["kappa"], report["level"] = report["po"], _level(report["po"])
    return report


def _neg52_formula(ann_a, ann_b, categories):
    report = kappa_report(ann_a, ann_b, categories)
    kappa = (report["po"] - report["pe"]) / (1 + report["pe"])
    report["kappa"], report["level"] = round(kappa, 4), _level(kappa)
    return report


def _neg52_level_from_po(ann_a, ann_b, categories):
    report = kappa_report(ann_a, ann_b, categories)
    report["level"] = _level(report["po"])
    return report


def _rand52(rng, count, k):
    cats = [f"c{i}" for i in range(k)]
    a = [rng.choice(cats) for _ in range(count)]
    b = [x if rng.random() < 0.7 else rng.choice(cats) for x in a]
    return a, b, cats


S52 = (["pos", "pos", "neg", "neu", "pos", "neg"], ["pos", "neg", "neg", "neu", "neu", "neg"], ["pos", "neg", "neu"])

P52 = problem(
    title="标注一致性报告（Cohen's Kappa）",
    theme="label_merge", ability="数据处理与标注", knowledge="标注一致性评估",
    fn="kappa_report", params=["ann_a", "ann_b", "categories"],
    description=r'''
    ### 一、题目描述

    两位标注员对同一批语料独立打类别标签。训练师要写一份一致性报告，用 Cohen's Kappa 扣除「碰巧一致」的部分：

    1. 观察一致率 `po` = 两人标签相同的条数 ÷ 总条数；
    2. 期望一致率 `pe` = 对每个类别 c，(a 标成 c 的条数 × b 标成 c 的条数 ÷ 总条数²) 之和；
    3. `kappa = (po − pe) ÷ (1 − pe)`；若 `po = 1`（两人完全一致），kappa 记为 1。

    返回 `{"po", "pe", "kappa", "level"}`：前三项用 `round(x, 4)` 保留 4 位小数；`level` 是按 kappa 的一致使等级：

    ```text
    kappa = 1        完全一致
    0.8 ≤ kappa < 1  很强
    0.6 ≤ kappa      较强
    0.4 ≤ kappa      中等
    0.2 ≤ kappa      较弱
    0   ≤ kappa      极弱
    kappa < 0        差
    ```

    ### 二、输入说明

    - `ann_a`、`ann_b` 等长（1 ≤ 长度 ≤ 5000），每个元素都是 `categories` 中的类别；
    - `categories` 为类别列表（1 到 8 个，互不相同），用例中不会出现 kappa 恰好落在等级边界上的情况。

    ### 三、示例

    ```text
    ann_a     = ["pos","pos","neg","neu","pos","neg"]
    ann_b     = ["pos","neg","neg","neu","neu","neg"]
    categories = ["pos","neg","neu"]
    返回      = {"po": 0.6667, "pe": 0.3056, "kappa": 0.52, "level": "中等"}
    ```

    两人一致 4 条，po = 4/6；a 的类别分布为 pos 3、neg 2、neu 1，b 为 pos 1、neg 3、neu 2，pe = (3×1 + 2×3 + 1×2) ÷ 36 ≈ 0.3056；kappa = (0.6667 − 0.3056) ÷ (1 − 0.3056) = 0.52。
    ''',
    sample=[*S52],
    cases=lambda: [
        [*S52],
        [["a", "b"], ["a", "b"], ["a", "b"]],
        [["a", "a"], ["a", "a"], ["a", "b"]],
        [["a", "a", "b", "b"], ["a", "b", "a", "b"], ["a", "b"]],
        [["a", "b"], ["b", "a"], ["a", "b"]],
        [["x", "x", "y", "z", "w", "x"], ["x", "y", "z", "w", "z", "x"], ["w", "x", "y", "z"]],
        [["a"] * 9 + ["b"], ["a"] * 8 + ["b", "a"], ["a", "b"]],
        _rand52(random.Random(311), 40, 3),
        _rand52(random.Random(312), 300, 5),
        _rand52(random.Random(313), 5000, 4),
    ],
    reference=kappa_report,
    alt=_alt52,
    fuzz=_fuzz52,
    negatives={
        "直接把观察一致率当成 kappa": _neg52_no_correction,
        "公式写成了 (po − pe) ÷ (1 + pe)": _neg52_formula,
        "一致使等级按 po 而不是 kappa 判断": _neg52_level_from_po,
    },
    explanation=r'''
    先数出混淆矩阵：`matrix[a标签][b标签]`。对角线之和除以 n 是观察一致率；每行的合计乘以对应列的合计，加总后除以 n² 是「两人随机标注时的期望一致率」。两者之差再除以（1 − 期望一致率），就把运气成分去掉了。

    Kappa 比「一致率」更可靠：当某个类别占绝对多数时，两个人乱标也能有很高的一致率，Kappa 会把这部分扣掉。等级判断要看 kappa 而不是 po。
    ''',
)


# ---------------------------------------------------------------- 53 时间穿越检查
def temporal_leakage(train_times, test_times, delay_hours):
    cutoff = max(train_times) + delay_hours * 3600 if train_times else None
    violated = [i for i, t in enumerate(test_times) if cutoff is not None and t < cutoff]
    return [violated, cutoff]


def _alt53(train_times, test_times, delay_hours):
    if not train_times:
        return [[], None]
    cutoff = Fraction(max(train_times)) + Fraction(str(delay_hours)) * 3600
    violated = [i for i, t in enumerate(test_times) if Fraction(t) < cutoff]
    return [violated, float(cutoff) if cutoff.denominator != 1 else int(cutoff)]


def _wrong53(train_times, test_times, delay_hours, use_mean, allow_equal):
    if not train_times:
        return [[], None]
    base = sum(train_times) / len(train_times) if use_mean else max(train_times)
    cutoff = base + delay_hours * 3600
    violated = [i for i, t in enumerate(test_times) if (t <= cutoff if allow_equal else t < cutoff)]
    return [violated, cutoff]


def _neg53_no_delay(train_times, test_times, delay_hours):
    return _wrong53(train_times, test_times, 0, use_mean=False, allow_equal=False)


def _neg53_mean(train_times, test_times, delay_hours):
    return _wrong53(train_times, test_times, delay_hours, use_mean=True, allow_equal=False)


def _neg53_equal(train_times, test_times, delay_hours):
    return _wrong53(train_times, test_times, delay_hours, use_mean=False, allow_equal=True)


def _rand53(rng, count, spread):
    return [1700000000 + rng.randrange(spread) for _ in range(count)]


S53 = ([1700000000, 1700036000, 1700100000], [1700030000, 1700137000, 1700100100], 1)

P53 = problem(
    title="训练测试集时间穿越检查",
    theme="leakage", ability="智能训练", knowledge="训练集与测试集的维护",
    fn="temporal_leakage", params=["train_times", "test_times", "delay_hours"],
    description=r'''
    ### 一、题目描述

    数字人客服的意图标签不是即时产生的：一条会话结束后，要过 `delay_hours` 小时才有人工标注结果可用。如果测试样本的时间早于「训练集最晚样本 + 标注延迟」，模型上线时根本拿不到它的标签，这叫时间穿越，线上指标会被高估。

    请返回 `[违规的测试样本下标, cutoff]`：

    1. `cutoff` = 训练集中最晚的时间戳 + `delay_hours × 3600`；
    2. 时间戳**早于** `cutoff` 的测试样本算违规（等于 `cutoff` 不算），下标升序；
    3. 训练集为空时返回 `[[], None]`。

    ### 二、输入说明

    - `train_times`、`test_times`：Unix 时间戳（秒）列表，顺序打乱，可能为空；各不超过 10000 条；
    - `delay_hours` 为非负数，最多一位小数。

    ### 三、示例

    ```text
    train_times = [1700000000, 1700036000, 1700100000]
    test_times  = [1700030000, 1700137000, 1700100100]
    delay_hours = 1
    返回        = [[0, 2], 1700103600]
    ```

    训练集最晚是 1700100000，加 1 小时得到 cutoff = 1700103600。第 0、2 条测试样本早于它，违规；第 1 条不违规。
    ''',
    sample=[*S53],
    cases=lambda: [
        [*S53],
        [[100, 200], [3800, 3799, 3801], 1],
        [[50, 90], [], 2],
        [[], [1, 2], 3],
        [[0], [5399, 5400], 1.5],
        [[10, 50], [49, 50, 51], 0],
        [[500, 100, 900, 300], [9360, 2000, 9361], 1],
        [[10], [9, 8, 7, 6], 0],
        [_rand53(random.Random(321), 3000, 3000000), _rand53(random.Random(322), 2000, 5000000), 6],
        [_rand53(random.Random(323), 10000, 8000000), _rand53(random.Random(324), 10000, 10000000), 12],
    ],
    reference=temporal_leakage,
    alt=_alt53,
    fuzz=lambda rng: [_rand53(rng, rng.randint(0, 15), 500), _rand53(rng, rng.randint(0, 15), 900),
                      rng.choice([0, 1, 2, 6, 0.5, 1.5])],
    negatives={
        "没有计入标注延迟": _neg53_no_delay,
        "用训练集的平均时间而不是最晚时间": _neg53_mean,
        "时间等于 cutoff 也算违规": _neg53_equal,
    },
    explanation=r'''
    题目本身只有三步：取训练集的最大值、加上延迟、过滤测试集。真正的考点是理解「标签产生的时间」这件事：模型的训练数据只能来自上线前已经标注好的样本，所以时间界限应该用训练集的**最晚**时间，而不是平均时间；延迟也不能漏掉。

    另外注意训练集为空的边界情况，以及「早于」是严格小于，等于 cutoff 的样本不算违规。
    ''',
)


# ---------------------------------------------------------------- 54 降级档位决策
def degrade_tier(metrics, rules):
    for index, (metric, op, threshold, tier) in enumerate(rules):
        if metric not in metrics:
            continue
        value = metrics[metric]
        if value >= threshold if op == ">=" else value <= threshold:
            return [tier, index]
    return ["NORMAL", -1]


def _alt54(metrics, rules):
    hit = next((i for i, (metric, op, threshold, _) in enumerate(rules)
                if metric in metrics and (metrics[metric] >= threshold if op == ">=" else metrics[metric] <= threshold)), None)
    return ["NORMAL", -1] if hit is None else [rules[hit][3], hit]


def _wrong54(metrics, rules, last_wins, flip, missing_is_zero):
    result = ["NORMAL", -1]
    for index, (metric, op, threshold, tier) in enumerate(rules):
        value = metrics.get(metric, 0 if missing_is_zero else None)
        if value is None:
            continue
        if value <= threshold if (op == ">=") == flip else value >= threshold:
            result = [tier, index]
            if not last_wins:
                break
    return result


def _neg54_last(metrics, rules):
    return _wrong54(metrics, rules, last_wins=True, flip=False, missing_is_zero=False)


def _neg54_flip(metrics, rules):
    return _wrong54(metrics, rules, last_wins=False, flip=True, missing_is_zero=False)


def _neg54_missing(metrics, rules):
    return _wrong54(metrics, rules, last_wins=False, flip=False, missing_is_zero=True)


def _rand54(rng, rule_count, metric_count):
    metrics = {f"m{i:02d}": round(rng.uniform(0, 100), 1) for i in range(metric_count)}
    rules = [[f"m{rng.randrange(metric_count):02d}", rng.choice([">=", "<="]), round(rng.uniform(20, 80), 1), f"T{i:02d}"]
             for i in range(rule_count)]
    return metrics, rules


S54 = ({"p95_ms": 1200, "error_rate": 0.02, "gpu_mem": 0.9},
       [["error_rate", ">=", 0.05, "FALLBACK"], ["p95_ms", ">=", 1000, "SMALL_MODEL"], ["gpu_mem", ">=", 0.95, "QUEUE"]])

P54 = problem(
    title="推理服务降级档位决策",
    theme="capacity", ability="智能系统设计", knowledge="智能系统监控与降级预案",
    fn="degrade_tier", params=["metrics", "rules"],
    description=r'''
    ### 一、题目描述

    数字人推理服务上线后，训练师要根据监控指标决定是否降级。`metrics` 是当前指标值 `{指标名: 数值}`；`rules` 是按**优先级从高到低**排列的规则列表，每项 `[指标名, 比较符, 阈值, 档位名]`，比较符为 `">="` 或 `"<="`。

    从第一条规则开始逐条检查：指标存在且满足比较条件，就采用它的档位并停止；指标不存在则跳过这条规则。所有规则都不满足时返回 `"NORMAL"`。

    返回 `[档位名, 触发的规则下标]`；没有任何规则触发时下标为 -1。

    ### 二、输入说明

    - `metrics` 的键是指标名，值是数值，可能为空；
    - `rules` 不超过 500 条，规则里的指标名不一定出现在 `metrics` 中。

    ### 三、示例

    ```text
    metrics = {"p95_ms": 1200, "error_rate": 0.02, "gpu_mem": 0.9}
    rules   = [["error_rate", ">=", 0.05, "FALLBACK"],
               ["p95_ms",    ">=", 1000, "SMALL_MODEL"],
               ["gpu_mem",   ">=", 0.95, "QUEUE"]]
    返回    = ["SMALL_MODEL", 1]
    ```

    错误率 0.02 没有达到 0.05，第一条不触发；P95 延迟 1200 ≥ 1000，第二条触发，返回它的档位和下标 1，后面的规则不再检查。
    ''',
    sample=[*S54],
    cases=lambda: [
        [*S54],
        [{"p95_ms": 900, "error_rate": 0.2, "gpu_mem": 0.9}, S54[1]],
        [{"p95_ms": 900, "error_rate": 0.01}, S54[1]],
        [{"success_rate": 0.97, "qps": 8}, [["success_rate", "<=", 0.95, "ALERT"], ["qps", "<=", 10, "SCALE_OUT"]]],
        [{"latency": 900}, [["qps", "<=", 10, "SCALE_DOWN"], ["latency", ">=", 800, "DEGRADE"]]],
        [{"a": 1}, []],
        [{"latency": 800}, [["latency", ">=", 800, "DEGRADE"]]],
        [{"x": 5, "y": 50}, [["y", "<=", 10, "LOW"], ["x", "<=", 5, "XSMALL"], ["y", ">=", 50, "HIGH"]]],
        _rand54(random.Random(331), 30, 20),
        _rand54(random.Random(332), 500, 60),
    ],
    reference=degrade_tier,
    alt=_alt54,
    fuzz=lambda rng: _rand54(rng, rng.randint(0, 6), rng.randint(1, 5)),
    negatives={
        "检查了全部规则，后面的规则覆盖前面的": _neg54_last,
        "比较符方向弄反": _neg54_flip,
        "缺失的指标当成 0 参与比较": _neg54_missing,
    },
    explanation=r'''
    这是一道「按规格实现」的题：规则有序、命中即停、缺失指标跳过、都不命中有默认值。用 `for` 循环配 `enumerate` 顺序扫描最清楚，命中就 `return`，循环结束还没返回就返回默认档位。

    易错点：降级规则是有优先级的，找到第一条命中的就必须停下来；指标缺失表示「没法判断」，不能当成 0，否则所有限制下限的规则都会误触发。
    ''',
)


# ---------------------------------------------------------------- 55 置信度校准
def calibration_bins(scores, labels, n_bins):
    n = len(scores)
    rows, ece = [], 0.0
    for b in range(n_bins):
        picked = [(s, ok) for s, ok in zip(scores, labels) if min(int(s * n_bins), n_bins - 1) == b]
        if not picked:
            continue
        confidence = sum(s for s, _ in picked) / len(picked)
        accuracy = sum(1 for _, ok in picked if ok) / len(picked)
        ece += len(picked) / n * abs(accuracy - confidence)
        rows.append([round(b / n_bins, 4), round((b + 1) / n_bins, 4), len(picked),
                     round(confidence, 4), round(accuracy, 4)])
    return [round(ece, 4), rows]


def _alt55(scores, labels, n_bins):
    bins = defaultdict(list)
    for s, ok in zip(scores, labels):
        exact = Fraction(str(s))
        bins[next((b for b in range(n_bins) if exact < Fraction(b + 1, n_bins)), n_bins - 1)].append((s, ok))
    rows, ece = [], Fraction(0)
    for b in range(n_bins):
        if not bins[b]:
            continue
        confidence = sum(Fraction(str(s)) for s, _ in bins[b]) / len(bins[b])
        accuracy = Fraction(sum(1 for _, ok in bins[b] if ok), len(bins[b]))
        ece += Fraction(len(bins[b]), len(scores)) * abs(accuracy - confidence)
        rows.append([round(b / n_bins, 4), round((b + 1) / n_bins, 4), len(bins[b]),
                     round(float(confidence), 4), round(float(accuracy), 4)])
    return [round(float(ece), 4), rows]


def _on_rounding_edge(scores, labels, n_bins):
    """某个统计量恰好是 x.xxxx5 时，浮点数 round(x, 4) 的结果依赖实现细节。题面声明不考这种情况。"""
    def on_edge(value):
        return (value * 10000).denominator == 2

    bins = defaultdict(list)
    for s, ok in zip(scores, labels):
        exact = Fraction(str(s))
        index = next((b for b in range(n_bins) if exact < Fraction(b + 1, n_bins)), n_bins - 1)
        bins[index].append((exact, ok))
    ece = Fraction(0)
    for items in bins.values():
        confidence = sum(f for f, _ in items) / len(items)
        accuracy = Fraction(sum(1 for _, ok in items if ok), len(items))
        if on_edge(confidence) or on_edge(accuracy):
            return True
        ece += Fraction(len(items), len(scores)) * abs(accuracy - confidence)
    return on_edge(ece)


def _fuzz55(rng):
    while True:
        args = _rand55(rng, rng.randint(1, 25), rng.choice([2, 3, 4, 5, 6, 8, 10]))
        if not _on_rounding_edge(*args):
            return args


def _neg55_mce(scores, labels, n_bins):
    ece, rows = calibration_bins(scores, labels, n_bins)
    return [round(max(abs(row[4] - row[3]) for row in rows), 4) if rows else 0.0, rows]


def _neg55_unweighted(scores, labels, n_bins):
    ece, rows = calibration_bins(scores, labels, n_bins)
    return [round(sum(abs(row[4] - row[3]) for row in rows) / len(rows), 4) if rows else 0.0, rows]


def _rand55(rng, count, n_bins):
    edges = {round(i / n_bins, 2) for i in range(n_bins + 1)}  # 避开分箱边界，边界归属另由手写用例覆盖
    scores = []
    while len(scores) < count:
        s = round(rng.uniform(0, 1), 2)
        if s not in edges:
            scores.append(s)
    return scores, [rng.random() < s for s in scores], n_bins


S55 = ([0.9, 0.8, 0.8, 0.6, 0.6, 0.4, 0.2, 0.2], [True, True, False, True, False, True, False, True], 5)

P55 = problem(
    title="意图置信度校准分析",
    theme="routing", ability="智能系统设计", knowledge="人机交互流程设计",
    fn="calibration_bins", params=["scores", "labels", "n_bins"],
    description=r'''
    ### 一、题目描述

    数字人客服用置信度决定哪些会话由自己应答。如果「置信度 0.8 的会话实际只有 60% 答对」，这个置信度就不可信。请做一份校准分析：把 `[0, 1]` 等分成 `n_bins` 个区间（第 b 个区间为 `[b/n_bins, (b+1)/n_bins)`，最后一个区间包含 1），每条会话按置信度落入一个区间。

    对每个**非空**区间统计：条数、平均置信度、实际准确率。返回 `[ECE, 分箱明细]`：

    1. `ECE`（期望校准误差）= 对每个非空区间，「条数 ÷ 总条数 × |准确率 − 平均置信度|」之和，用 `round(x, 4)` 保留 4 位小数；
    2. 分箱明细是列表，每个非空区间一项 `[区间下限, 区间上限, 条数, 平均置信度, 准确率]`，按区间从低到高；后四个数中涉及小数的用 `round(x, 4)` 保留 4 位小数。

    ### 二、输入说明

    - `scores` 与 `labels` 等长（1 ≤ 长度 ≤ 5000），`scores` 在 `[0, 1]` 内且保留两位小数，`labels[i]` 为 `True` 表示第 i 条回答正确；
    - `n_bins` 为 1 到 10 的整数。用例中不会出现除不尽导致舍入歧义的情况。

    ### 三、示例

    ```text
    scores  = [0.9, 0.8, 0.8, 0.6, 0.6, 0.4, 0.2, 0.2]
    labels  = [True, True, False, True, False, True, False, True]
    n_bins  = 5
    ECE     = 0.2375
    ```

    ```text
    分箱明细 = [[0.2, 0.4, 2, 0.2, 0.5],
               [0.4, 0.6, 1, 0.4, 1.0],
               [0.6, 0.8, 2, 0.6, 0.5],
               [0.8, 1.0, 3, 0.8333, 0.6667]]
    ```

    `[0, 0.2)` 没有样本，不出现在明细里。以最后一个区间为例：3 条样本，平均置信度 (0.9 + 0.8 + 0.8) ÷ 3 ≈ 0.8333，准确率 2/3 ≈ 0.6667，权重 3/8，对 ECE 的贡献是 3/8 × |0.6667 − 0.8333| ≈ 0.0625。
    ''',
    sample=[*S55],
    cases=lambda: [
        [*S55],
        [[0.5, 0.5], [True, False], 4],
        [[0.31, 0.35, 0.39], [True, False, True], 3],
        [[0.0, 1.0], [False, True], 4],
        [[0.9, 0.9, 0.9], [False, False, False], 1],
        [[0.1, 0.2, 0.4, 0.6, 0.8, 1.0], [False, False, True, True, True, True], 5],
        [[0.25, 0.75, 0.5, 0.5], [True, False, True, False], 4],
        _rand55(random.Random(341), 60, 5),
        _rand55(random.Random(342), 300, 4),
        _rand55(random.Random(343), 3000, 10),
    ],
    reference=calibration_bins,
    alt=_alt55,
    fuzz=_fuzz55,
    negatives={
        "算的是最大校准误差（各区间差距的最大值）": _neg55_mce,
        "各区间取简单平均，没有按条数加权": _neg55_unweighted,
    },
    explanation=r'''
    分箱的归属用 `min(int(score × n_bins), n_bins − 1)`：乘以箱数后向下取整，末尾的 `min` 是为了保证 1.0 落在最后一个区间。随后对每个区间做一次小统计，注意空区间直接跳过。

    ECE 是「按样本量加权」的平均差距，样本多的大区间权重大。它比「最大差距」更能反映整体校准情况，也比「各区间简单平均」更合理——只有一个样本的区间不应该和上千样本的区间一样重要。
    ''',
)


# ---------------------------------------------------------------- 56 分层加权估计
def stratified_mean(strata):
    total = sum(size for _, size, _, _ in strata)
    weights = [size / drawn for _, size, _, drawn in strata]
    estimate = sum(size * mean for _, size, mean, _ in strata) / total
    simple = sum(mean for _, _, mean, _ in strata) / len(strata)
    return {
        "weights": [round(w, 4) for w in weights],
        "estimate": round(estimate, 4),
        "simple_mean": round(simple, 4),
        "self_weighting": max(weights) - min(weights) < 1e-9,
    }


def _alt56(strata):
    def frac(x):
        return Fraction(str(x))

    weights = [frac(size) / drawn for _, size, _, drawn in strata]
    estimate = sum(frac(size) * frac(mean) for _, size, mean, _ in strata) / sum(size for _, size, _, _ in strata)
    simple = sum(frac(mean) for _, _, mean, _ in strata) / len(strata)
    return {
        "weights": [round(float(w), 4) for w in weights],
        "estimate": round(float(estimate), 4),
        "simple_mean": round(float(simple), 4),
        "self_weighting": len(set(weights)) == 1,
    }


def _neg56_simple(strata):
    report = stratified_mean(strata)
    report["estimate"] = report["simple_mean"]
    return report


def _neg56_inverse(strata):
    report = stratified_mean(strata)
    report["weights"] = [round(drawn / size, 4) for _, size, _, drawn in strata]
    return report


def _neg56_by_sample(strata):
    report = stratified_mean(strata)
    report["self_weighting"] = len({drawn for _, _, _, drawn in strata}) == 1
    return report


def _rand56(rng, count):
    rows = []
    for i in range(count):
        size = rng.randint(1, 500)
        rows.append([f"L{i:03d}", size, round(rng.uniform(0, 10), 1), rng.randint(1, size)])
    return rows


S56 = [["短", 600, 4.0, 60], ["中", 300, 3.0, 100], ["长", 100, 2.0, 40]]

P56 = problem(
    title="分层抽样的加权估计",
    theme="sampling", ability="智能训练", knowledge="评测集构建与分层抽样",
    fn="stratified_mean", params=["strata"],
    description=r'''
    ### 一、题目描述

    评测集是分层抽取的：各层抽样比例不同，不能把样本均值直接平均。`strata` 每项为 `[层名, 总体规模 N, 样本均值, 样本量 n]`。请完成一份估计报告：

    1. 设计权重 `w = N ÷ n`（每个样本代表总体中的多少条）；
    2. 分层估计量 = Σ(N × 样本均值) ÷ ΣN，即用总体规模加权的均值；
    3. 简单平均 = 各层样本均值的算术平均，用来对照；
    4. `self_weighting`：各层设计权重是否全部相同（相差小于 10⁻⁹ 即视为相同）。

    返回 `{"weights": [...], "estimate": ..., "simple_mean": ..., "self_weighting": ...}`：`weights` 与 `strata` 顺序一致，三个数值结果都用 `round(x, 4)` 保留 4 位小数，`self_weighting` 为布尔值。

    ### 二、输入说明

    - `strata`：1 ≤ 层数 ≤ 500；总体规模与样本量为正整数（样本量不超过总体规模）；样本均值为不超过 1000 的数，最多一位小数。

    ### 三、示例

    ```text
    strata = [["短", 600, 4.0, 60], ["中", 300, 3.0, 100], ["长", 100, 2.0, 40]]
    返回   = {"weights": [10.0, 3.0, 2.5], "estimate": 3.5,
              "simple_mean": 3.0, "self_weighting": false}
    ```

    三层的设计权重分别是 10、3、2.5，并不相同；分层估计量 = (600×4 + 300×3 + 100×2) ÷ 1000 = 3.5。简单平均是 3.0，被过度抽样的「中」层拉低了。
    ''',
    sample=[S56],
    cases=lambda: [
        [S56],
        [[["a", 200, 1.5, 20], ["b", 100, 2.5, 10]]],
        [[["one", 50, 7.25, 10]]],
        [[["big", 1000, 1.0, 10], ["tiny", 1, 100.0, 1]]],
        [[["x", 100, 2.0, 3]]],
        [[["a", 50, 0.0, 5], ["b", 50, 0.5, 5]]],
        [[["p", 10, 1.0, 2], ["q", 30, 2.0, 6], ["r", 45, 4.5, 9]]],
        [[["m", 7, 3.3, 7], ["n", 8, 4.4, 8]]],
        [_rand56(random.Random(351), 40)],
        [_rand56(random.Random(352), 500)],
    ],
    reference=stratified_mean,
    alt=_alt56,
    fuzz=lambda rng: [_rand56(rng, rng.randint(1, 6))],
    negatives={
        "估计量用了各层样本均值的简单平均": _neg56_simple,
        "设计权重算成了 n ÷ N": _neg56_inverse,
        "用样本量是否相同判断自加权": _neg56_by_sample,
    },
    explanation=r'''
    抽样比例不同的各层，「一条样本代表多少人」也不同，这个放大倍数就是设计权重 N/n。把它乘回去再加总，得到的才是总体均值的无偏估计；直接平均样本均值，等于默认每层一样重要，会让过度抽样的层被高估。

    判断是否「自加权」要看设计权重是否一致（等价于各层抽样比例相同），而不是看样本量是否相同。
    ''',
)


# ---------------------------------------------------------------- 57 值班负载统计
def oncall_load(alerts, acks, sla):
    stats = {}
    for alert_id, person, level, _ in alerts:
        row = stats.setdefault(person, [0, 0, 0, 0])  # 告警数、超时数、已响应数、响应时间合计
        row[0] += 1
        seconds = acks.get(alert_id)
        if seconds is None or seconds > sla[level]:
            row[1] += 1
        if seconds is not None:
            row[2] += 1
            row[3] += seconds
    result = []
    for person in sorted(stats):
        count, late, answered, total = stats[person]
        average = round(total / answered, 1) if answered else 0.0
        result.append([person, count, late, average])
    return result


def _alt57(alerts, acks, sla):
    grouped = defaultdict(list)
    for alert_id, person, level, _ in alerts:
        grouped[person].append((alert_id, level))
    result = []
    for person, items in sorted(grouped.items()):
        seconds = [acks[a] for a, _ in items if a in acks]
        late = sum(1 for a, level in items if a not in acks or acks[a] > sla[level])
        result.append([person, len(items), late, round(sum(seconds) / len(seconds), 1) if seconds else 0.0])
    return result


def _wrong57(alerts, acks, sla, count_missing, average_with):
    grouped = defaultdict(list)
    for alert_id, person, level, _ in alerts:
        grouped[person].append((alert_id, level))
    result = []
    for person, items in sorted(grouped.items()):
        seconds = [acks[a] for a, _ in items if a in acks]
        late = sum(1 for a, level in items if a in acks and acks[a] > sla[level]) if not count_missing \
            else sum(1 for a, level in items if a not in acks or acks[a] > sla[level])
        if average_with == "zero":
            average = round(sum(acks.get(a, 0) for a, _ in items) / len(items), 1)
        elif average_with == "sla":
            average = round(sum(acks.get(a, sla[level]) for a, level in items) / len(items), 1)
        else:
            average = round(sum(seconds) / len(seconds), 1) if seconds else 0.0
        result.append([person, len(items), late, average])
    return sorted(result, key=lambda row: (-row[1], row[0])) if average_with == "unsorted" else result


def _neg57_missing(alerts, acks, sla):
    return _wrong57(alerts, acks, sla, count_missing=False, average_with="answered")


def _neg57_zero(alerts, acks, sla):
    return _wrong57(alerts, acks, sla, count_missing=True, average_with="zero")


def _neg57_unsorted(alerts, acks, sla):
    return _wrong57(alerts, acks, sla, count_missing=True, average_with="unsorted")


def _rand57(rng, count, people_count):
    people = [f"oncall{i:02d}" for i in range(people_count)]
    return ([[f"al{i:05d}", rng.choice(people), rng.choice(["P1", "P2", "P3"]), rng.randrange(10080)]
             for i in range(count)],
            {f"al{i:05d}": rng.randrange(1, 1200) for i in range(count) if rng.random() < 0.8},
            {"P1": 60, "P2": 300, "P3": 900})


S57 = ([["a1", "张三", "P1", 10], ["a2", "张三", "P2", 20], ["a3", "李四", "P1", 30], ["a4", "李四", "P3", 40]],
       {"a1": 45, "a2": 300, "a3": 90}, {"P1": 60, "P2": 300, "P3": 900})

P57 = problem(
    title="告警响应时效与值班负载",
    theme="alerts", ability="智能系统设计", knowledge="智能系统监控与告警治理",
    fn="oncall_load", params=["alerts", "acks", "sla"],
    description=r'''
    ### 一、题目描述

    数字人平台每周复盘值班情况。`alerts` 每项 `[告警id, 值班人, 级别, 发生分钟]`；`acks` 是 `{告警id: 响应用时秒}`，没有出现在其中的告警视为「未响应」；`sla` 是 `{级别: 响应时限秒}`。

    请按值班人统计：

    1. 告警数；
    2. 超时数：未响应，或响应用时**大于**该级别的时限；
    3. 平均响应用时：只统计已响应的告警（包括超时才响应的），用 `round(x, 1)` 保留 1 位小数；一条都没响应时为 0.0。

    返回 `[[值班人, 告警数, 超时数, 平均响应用时], ...]`，按值班人字典序升序。

    ### 二、输入说明

    - 告警总数不超过 6000，告警 id 互不相同；`acks` 里可能出现没有对应告警的 id，忽略即可；
    - 响应用时、时限都是正整数；`alerts` 可能为空。

    ### 三、示例

    ```text
    alerts = [["a1","张三","P1",10], ["a2","张三","P2",20],
              ["a3","李四","P1",30], ["a4","李四","P3",40]]
    acks   = {"a1": 45, "a2": 300, "a3": 90}
    sla    = {"P1": 60, "P2": 300, "P3": 900}
    返回   = [["张三", 2, 0, 172.5], ["李四", 2, 2, 90.0]]
    ```

    李四：`a3` 响应用了 90 秒，超过 P1 的 60 秒时限；`a4` 没有响应。两条都超时，平均响应用时只有 `a3` 的 90.0。张三：`a2` 用了 300 秒，恰好等于时限，不算超时；平均 (45 + 300) ÷ 2 = 172.5。
    ''',
    sample=[*S57],
    cases=lambda: [
        [*S57],
        [[], {}, {"P1": 60}],
        [[["x", "甲", "P1", 1]], {}, {"P1": 60}],
        [[["x", "甲", "P1", 1]], {"x": 60}, {"P1": 60}],
        [[["x", "甲", "P1", 1], ["y", "乙", "P2", 2]], {"x": 61, "y": 299}, {"P1": 60, "P2": 300}],
        [[["x", "乙", "P1", 1], ["y", "甲", "P2", 2], ["z", "丙", "P3", 3], ["w", "甲", "P1", 4]], {"x": 1, "y": 1, "z": 1, "w": 2},
         {"P1": 60, "P2": 300, "P3": 900}],
        [[["x", "甲", "P1", 1], ["y", "甲", "P1", 2], ["z", "甲", "P1", 3], ["w", "甲", "P1", 4]], {"x": 61, "y": 62, "z": 63, "w": 64}, {"P1": 60}],
        [[["x", "甲", "P1", 1], ["y", "甲", "P2", 2]], {"x": 61, "y": 301, "ghost": 5}, {"P1": 60, "P2": 300}],
        list(_rand57(random.Random(361), 2000, 8)),
        list(_rand57(random.Random(362), 6000, 30)),
    ],
    reference=oncall_load,
    alt=_alt57,
    fuzz=lambda rng: _rand57(rng, rng.randint(0, 20), rng.randint(1, 4)),
    negatives={
        "未响应的告警没有计入超时": _neg57_missing,
        "平均响应用时把未响应当成 0 秒一起平均": _neg57_zero,
        "结果按告警数排序而不是按值班人排序": _neg57_unsorted,
    },
    explanation=r'''
    用「值班人 → [告警数, 超时数, 已响应数, 响应用时合计]」的字典一次遍历完成统计，最后按值班人排序输出。要分清两件事：

    1. 超时与否看「未响应或用时大于时限」，时限按每条告警自己的级别查；
    2. 平均值只在已响应的告警上计算，分母不能是全部告警，否则没响应的告警会被当成「0 秒响应」，把平均值拉低。

    「响应慢」和「没响应」是两类问题：前者可能是负载过高，后者可能是告警被淹没，复盘时要分开看。
    ''',
)


PROBLEMS = [P51, P52, P53, P54, P55, P56, P57]
