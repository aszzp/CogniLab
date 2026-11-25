"""第 4 套编程题（51–57）。字段含义见 scripts/finals/build.py 的文件说明。

多参数用例统一写成元组再展开（sample=[*S51]），避免手数括号出错。
"""
import math
import random
from collections import Counter, defaultdict
from fractions import Fraction

import common


def problem(**spec):
    return spec


# ---------------------------------------------------------------- 51 有限人手的排程
def schedule_workers(names, durations, deps, workers):
    index = {name: i for i, name in enumerate(names)}
    n = len(names)
    successors = [[] for _ in range(n)]
    waiting = [0] * n  # 还没完成的前驱数
    for a, b in deps:
        successors[index[a]].append(index[b])
        waiting[index[b]] += 1
    start = [0] * n
    ready = [i for i in range(n) if waiting[i] == 0]  # 已就绪、还没开工的环节，按下标升序
    running = []  # [结束时间, 环节]
    time, finished, idle = 0, 0, workers
    while finished < n:
        while ready and idle > 0:  # 有空闲工人：就绪环节中下标最小的先开工
            v = ready.pop(0)
            start[v] = time
            running.append([time + durations[v], v])
            idle -= 1
        time = min(r[0] for r in running)  # 跳到最近的一个完成时刻
        for item in [r for r in running if r[0] == time]:  # 同一时刻完成的环节一起结算
            running.remove(item)
            idle += 1
            finished += 1
            for w in successors[item[1]]:
                waiting[w] -= 1
                if waiting[w] == 0:
                    ready.append(w)
        ready.sort()
    return [time, start]


def _alt51(names, durations, deps, workers):
    # 逐个单位时间推进：每一时刻先看有几个工人空着，再让就绪环节按下标从小到大开工
    index = {name: i for i, name in enumerate(names)}
    n = len(names)
    preds = [[] for _ in range(n)]
    for a, b in deps:
        preds[index[b]].append(index[a])
    start, finish = [None] * n, [None] * n
    time = 0
    while any(s is None for s in start):
        busy = sum(1 for i in range(n) if start[i] is not None and finish[i] > time)
        for i in range(n):
            if start[i] is None and busy < workers and all(finish[p] is not None and finish[p] <= time for p in preds[i]):
                start[i] = time
                finish[i] = time + durations[i]
                busy += 1
        time += 1
    return [max(finish), start]


def _time_stepped(names, durations, deps, key=None, limit=None):
    """按单位时间推进的通法：key 是就绪环节的排序依据，limit 为 None 时不限工人数。"""
    index = {name: i for i, name in enumerate(names)}
    n = len(names)
    preds = [[] for _ in range(n)]
    for a, b in deps:
        preds[index[b]].append(index[a])
    start, finish = [None] * n, [None] * n
    time = 0
    while any(s is None for s in start):
        busy = sum(1 for i in range(n) if start[i] is not None and finish[i] > time)
        ready = [i for i in range(n) if start[i] is None
                 and all(finish[p] is not None and finish[p] <= time for p in preds[i])]
        if key:
            ready.sort(key=key)
        for i in ready:
            if limit is not None and busy >= limit:
                break
            start[i] = time
            finish[i] = time + durations[i]
            busy += 1
        time += 1
    return [max(finish), start]


def _neg51_unlimited(names, durations, deps, workers):
    return _time_stepped(names, durations, deps, limit=None)


def _neg51_longest(names, durations, deps, workers):
    return _time_stepped(names, durations, deps, key=lambda i: (-durations[i], i), limit=workers)


def _neg51_shortest(names, durations, deps, workers):
    # 用「耗时最短优先」排程，同样不符合题目规定的下标优先
    return _time_stepped(names, durations, deps, key=lambda i: (durations[i], i), limit=workers)


S51 = (["a", "b", "c", "d", "e"], [3, 2, 4, 1, 2], [["a", "c"], ["b", "d"]], 2)

P51 = problem(
    title="有限人手下的流水线排程",
    theme="critical_path", ability="业务分析", knowledge="业务流程设计与资源排程",
    fn="schedule_workers", params=["names", "durations", "deps", "workers"],
    description=r'''
    ### 一、题目描述

    一条数字人语料处理流水线由 n 个环节组成，环节之间有先后依赖，现在只有 `workers` 名工人。请模拟整个执行过程：

    - 每名工人同一时刻只做一个环节，环节一旦开始不会中断；
    - 环节的所有前驱都完成后才算「就绪」；
    - 每当有工人空闲且有就绪环节时，在就绪环节中选**下标最小**的开工，开始时间就是当前时刻。

    返回 `[完工时间, [每个环节的开始时间]]`，开始时间与 `names` 顺序一致。

    ### 二、输入说明

    - `names`：长度为 n（1 ≤ n ≤ 2000）的字符串列表，环节名称互不相同，顺序不保证是拓扑序；
    - `durations`：与 `names` 等长的整数列表，耗时（1 ≤ durations[i] ≤ 9）；
    - `deps`：依赖列表，每项 `[a, b]` 表示 a 完成之后 b 才能开始。保证无环、无重复依赖；
    - `workers`：工人数，1 ≤ workers ≤ 50。

    ### 三、示例

    ```text
    names      = ["a", "b", "c", "d", "e"]
    durations  = [3, 2, 4, 1, 2]
    deps       = [["a","c"],["b","d"]]
    workers    = 2
    返回       = [7, [0, 0, 3, 2, 3]]
    ```

    时刻 0：`a`、`b` 开工。时刻 2：`b` 完成，`d` 和 `e` 都已就绪，`d` 下标小，先开工（2 到 3）。时刻 3：`a`、`d` 完成，`c`、`e` 开工。`c` 在时刻 7 完成。
    ''',
    sample=[*S51],
    cases=lambda: [
        [*S51],
        [["x", "y", "z"], [2, 1, 3], [], 1],
        [*S51[:3], 5],
        [["s", "l", "r", "t"], [1, 5, 2, 1], [["s", "l"], ["s", "r"], ["l", "t"], ["r", "t"]], 2],
        [["long", "short"], [9, 1], [], 1],
        [["z", "m", "a"], [1, 2, 3], [["a", "m"], ["m", "z"]], 2],
        [["a", "b", "c", "d", "e", "f"], [2, 2, 2, 3, 1, 1], [["a", "d"], ["b", "e"], ["c", "f"]], 2],
        [["only"], [4], [], 3],
        list(common.rand_dag(random.Random(401), 200, 0.06)) + [6],
        list(common.rand_dag(random.Random(402), 2000, 0.01)) + [12],
    ],
    reference=schedule_workers,
    alt=_alt51,
    alt_case_ok=lambda args: len(args[0]) <= 400,
    fuzz=lambda rng: list(common.rand_dag(rng, rng.randint(1, 9), rng.uniform(0.1, 0.9))) + [rng.randint(1, 4)],
    negatives={
        "没有考虑工人数上限，所有就绪环节同时开工": _neg51_unlimited,
        "就绪环节里耗时最长的先开工": _neg51_longest,
        "就绪环节里耗时最短的先开工": _neg51_shortest,
    },
    explanation=r'''
    这是「事件驱动」的模拟：维护当前时刻、正在运行的环节（及其结束时刻）、已就绪环节列表和空闲工人数。每一轮：

    1. 只要有空闲工人且存在就绪环节，就让下标最小的就绪环节开工；
    2. 把时间跳到最近的结束时刻，把这一时刻完成的环节一起结算，释放工人、给后继减前驱计数，新就绪的环节加入列表并排序。

    逐个单位时间推进也能做对（耗时都是整数），但环节多时更慢。易错点是开工顺序：题目规定按**下标**优先，不是耗时最长或最短优先。
    ''',
)


# ---------------------------------------------------------------- 52 语音切分一致性
def span_agreement(a_spans, b_spans):
    def iou(x, y):
        overlap = min(x[1], y[1]) - max(x[0], y[0])
        if overlap <= 0:
            return 0.0
        return overlap / (x[1] - x[0] + (y[1] - y[0]) - overlap)

    order = sorted(range(len(a_spans)), key=lambda i: (a_spans[i][0], a_spans[i][1]))
    used, matched, total = set(), 0, 0.0
    for i in order:
        best = None
        for j, span in enumerate(b_spans):
            if j in used:
                continue
            value = iou(a_spans[i], span)
            if value <= 0:
                continue
            key = (-value, span[0], j)  # IoU 大者优先；并列取开始时间早者，再并列取输入下标小者
            if best is None or key < best[0]:
                best = (key, j, value)
        if best and best[2] >= 0.5:
            used.add(best[1])
            matched += 1
            total += best[2]
    average = round(total / matched, 4) if matched else 0.0
    return [matched, average, len(a_spans) - matched, len(b_spans) - matched]


def _alt52(a_spans, b_spans):
    def iou(x, y):
        overlap = min(x[1], y[1]) - max(x[0], y[0])
        return Fraction(overlap, x[1] - x[0] + y[1] - y[0] - overlap) if overlap > 0 else Fraction(0)

    pending = list(range(len(b_spans)))
    matched, total = 0, Fraction(0)
    for i in sorted(range(len(a_spans)), key=lambda i: (a_spans[i][0], a_spans[i][1])):
        candidates = [(-iou(a_spans[i], b_spans[j]), b_spans[j][0], j) for j in pending
                      if iou(a_spans[i], b_spans[j]) > 0]
        if candidates:
            negative, _, j = min(candidates)
            if -negative >= Fraction(1, 2):
                pending.remove(j)
                matched += 1
                total += -negative
    return [matched, round(float(total / matched), 4) if matched else 0.0,
            len(a_spans) - matched, len(b_spans) - matched]


def _exact_mean(a_spans, b_spans):
    """按同样的贪心规则，用分数精确算出平均 IoU。"""
    def iou(x, y):
        overlap = min(x[1], y[1]) - max(x[0], y[0])
        return Fraction(overlap, x[1] - x[0] + y[1] - y[0] - overlap) if overlap > 0 else Fraction(0)

    used, matched, total = set(), 0, Fraction(0)
    for i in sorted(range(len(a_spans)), key=lambda i: (a_spans[i][0], a_spans[i][1])):
        best = None
        for j, span in enumerate(b_spans):
            if j in used:
                continue
            value = iou(a_spans[i], span)
            key = (-value, span[0], j)
            if value > 0 and (best is None or key < best[0]):
                best = (key, j, value)
        if best and best[2] >= Fraction(1, 2):
            used.add(best[1])
            matched += 1
            total += best[2]
    return total / matched if matched else Fraction(0)


def _fuzz52(rng):
    while True:
        args = _rand52(rng, rng.randint(0, 12))
        # 平均 IoU 恰好是 x.xxxx5 时 round(x, 4) 的结果有歧义，随机用例避开
        if (_exact_mean(*args) * 10000).denominator != 2:
            return args


def _wrong52(a_spans, b_spans, strict, reuse, overlap_coefficient):
    def score(x, y):
        overlap = min(x[1], y[1]) - max(x[0], y[0])
        if overlap <= 0:
            return 0.0
        if overlap_coefficient:
            return overlap / min(x[1] - x[0], y[1] - y[0])
        return overlap / (x[1] - x[0] + (y[1] - y[0]) - overlap)

    used, matched, total = set(), 0, 0.0
    for a in sorted(a_spans):
        best = None
        for j, b in enumerate(b_spans):
            if j in used and not reuse:
                continue
            value = score(a, b)
            key = (-value, b[0], j)
            if value > 0 and (best is None or key < best[0]):
                best = (key, j, value)
        if best and (best[2] > 0.5 if strict else best[2] >= 0.5):
            used.add(best[1])
            matched += 1
            total += best[2]
    return [matched, round(total / matched, 4) if matched else 0.0,
            len(a_spans) - matched, len(b_spans) - matched]


def _neg52_strict(a_spans, b_spans):
    return _wrong52(a_spans, b_spans, strict=True, reuse=False, overlap_coefficient=False)


def _neg52_reuse(a_spans, b_spans):
    return _wrong52(a_spans, b_spans, strict=False, reuse=True, overlap_coefficient=False)


def _neg52_overlap(a_spans, b_spans):
    return _wrong52(a_spans, b_spans, strict=False, reuse=False, overlap_coefficient=True)


def _rand52(rng, count):
    """两人切的是同一段录音：边界大体一致、各自有偏移，b 还会合并或切分出一些片段；顺序打乱。"""
    length = 60 + 50 * count
    cuts_a = sorted(rng.sample(range(1, length), count))
    cuts_b = {max(1, c + rng.randint(-2, 2)) for c in cuts_a if rng.random() < 0.85}
    cuts_b |= set(rng.sample(range(1, length), rng.randint(0, max(1, count // 4))))
    a = [[s, e] for s, e in zip([0] + cuts_a, cuts_a + [length])]
    b = [[s, e] for s, e in zip([0] + sorted(cuts_b), sorted(cuts_b) + [length])]
    rng.shuffle(a)
    rng.shuffle(b)
    return a, b


S52 = ([[0, 100], [100, 200], [200, 300]], [[0, 80], [150, 210], [220, 300]])

P52 = problem(
    title="语音切分标注一致性比对",
    theme="label_merge", ability="数据处理与标注", knowledge="标注质量评估与仲裁规则",
    fn="span_agreement", params=["a_spans", "b_spans"],
    description=r'''
    ### 一、题目描述

    两名标注员对同一段语音分别做了切分，`a_spans`、`b_spans` 是各自的片段列表，每项 `[开始毫秒, 结束毫秒]`（整数，同一个人的片段互不重叠）。请用贪心策略比对：

    1. 把 a 的片段按开始时间升序（并列时结束早者在前）逐个处理；
    2. 对每个 a 片段，在 b 中**尚未被匹配**、且与它有时间重叠（交集大于 0）的片段里，选交并比 IoU 最大的一个；IoU 并列时取开始时间早的，再并列取输入下标小的；
    3. 若选出的 IoU **不低于** 0.5，则匹配成功，这个 b 片段不再参与后续匹配。

    IoU = 交集时长 ÷ 并集时长。返回 `[匹配对数, 平均 IoU, 未匹配的 a 片段数, 未匹配的 b 片段数]`，平均 IoU 只统计匹配成功的对，用 `round(x, 4)` 保留 4 位小数，没有匹配时为 0.0。

    ### 二、输入说明

    - 两个列表各不超过 800 个片段，开始时间小于结束时间；输入顺序可能是打乱的；
    - 同一标注员的片段互不重叠。

    ### 三、示例

    ```text
    a_spans = [[0, 100], [100, 200], [200, 300]]
    b_spans = [[0, 80], [150, 210], [220, 300]]
    返回    = [2, 0.8, 1, 1]
    ```

    a 的第 1 段与 b 的第 1 段：交集 80、并集 100，IoU = 0.8，匹配。a 的第 2 段与 b 的第 2 段：交集 50、并集 110，IoU ≈ 0.455，不到 0.5，不匹配。a 的第 3 段与 b 的第 2 段：交集 10、并集 150，IoU ≈ 0.067；与 b 的第 3 段：交集 80、并集 100，IoU = 0.8，匹配。两边各有 1 段没有匹配，平均 IoU = (0.8 + 0.8) ÷ 2 = 0.8。
    ''',
    sample=[*S52],
    cases=lambda: [
        [*S52],
        [[], []],
        [[], [[0, 10]]],
        [[[0, 10]], [[0, 20]]],
        [[[300, 400], [0, 100]], [[250, 400], [0, 80]]],
        [[[0, 10]], [[0, 5], [5, 10]]],
        [[[0, 10], [10, 20], [20, 30]], [[0, 20], [20, 30]]],
        [[[0, 10], [20, 30]], [[100, 200]]],
        _rand52(random.Random(411), 200),
        _rand52(random.Random(412), 700),
    ],
    reference=span_agreement,
    alt=_alt52,
    fuzz=_fuzz52,
    negatives={
        "IoU 等于 0.5 不算匹配": _neg52_strict,
        "同一个 b 片段可以被重复匹配": _neg52_reuse,
        "相似度用交集除以较短片段的长度": _neg52_overlap,
    },
    explanation=r'''
    先把 a 的片段排好序，逐个在 b 的未匹配片段里找最佳对象：算交集与并集，取 IoU 最大者，再用（开始时间、下标）处理并列。一个 b 片段一旦匹配成功就从候选里拿走，这保证了结果是「一对一」的。

    易错点：交集为 0 的片段不参与比较（不要在并集上算出 0 再去比较大小）；阈值是不低于 0.5；平均 IoU 的分母是匹配对数，不是片段总数。切分一致性低，通常说明标注规范里对「停顿是否切断」的约定不够清楚。
    ''',
)


# ---------------------------------------------------------------- 53 分组泄漏修复
def fix_split(samples):
    side = {}
    for sample_id, group, split in samples:
        counts = side.setdefault(group, {"train": 0, "test": 0})
        counts[split] += 1
    home = {g: ("test" if c["test"] > c["train"] else "train") for g, c in side.items()}
    train, test, moved = [], [], 0
    for sample_id, group, split in samples:
        target = home[group]
        moved += target != split
        (train if target == "train" else test).append(sample_id)
    return {"train": sorted(train), "test": sorted(test), "moved": moved}


def _alt53(samples):
    tally = Counter((group, split) for _, group, split in samples)
    train, test, moved = [], [], 0
    for sample_id, group, split in samples:
        keep = tally[(group, "train")] >= tally[(group, "test")]
        if (split == "train") != keep:
            moved += 1
        (train if keep else test).append(sample_id)
    return {"train": sorted(train), "test": sorted(test), "moved": moved}


def _reassign(samples, tie, do_move=True, sort_ids=True):
    side = defaultdict(Counter)
    for sample_id, group, split in samples:
        side[group][split] += 1
    train, test, moved = [], [], 0
    for sample_id, group, split in samples:
        if side[group]["test"] > side[group]["train"] or (tie == "test" and side[group]["test"] == side[group]["train"]):
            target = "test"
        else:
            target = "train"
        if not do_move:
            target = split
        moved += target != split
        (train if target == "train" else test).append(sample_id)
    if sort_ids:
        train, test = sorted(train), sorted(test)
    return {"train": train, "test": test, "moved": moved}


def _neg53_tie_test(samples):
    return _reassign(samples, tie="test")


def _neg53_keep(samples):
    return _reassign(samples, tie="train", do_move=False)


def _neg53_unsorted(samples):
    return _reassign(samples, tie="train", sort_ids=False)


def _rand53(rng, count, groups):
    rows = [[f"s{i:05d}", f"g{rng.randrange(groups):03d}", rng.choice(["train", "test"])] for i in range(count)]
    rng.shuffle(rows)
    return rows


S53 = [["s1", "c1", "train"], ["s2", "c1", "test"], ["s3", "c1", "test"], ["s4", "c2", "train"], ["s5", "c2", "test"]]

P53 = problem(
    title="分组泄漏的自动修复",
    theme="leakage", ability="智能训练", knowledge="训练集与测试集的维护",
    fn="fix_split", params=["samples"],
    description=r'''
    ### 一、题目描述

    检查发现数字人对话语料的训练集和测试集里有分组泄漏：同一场会话的样本被分到了两边。请自动修复：对每一场会话，看它的样本在哪一边更多，就把这场会话的**全部**样本挪到那一边；两边数量相同时归训练集。

    返回一份字典：

    ```text
    {
      "train": 修复后训练集的样本 id（字典序升序）,
      "test":  修复后测试集的样本 id（字典序升序）,
      "moved": 被挪动的样本数
    }
    ```

    ### 二、输入说明

    - `samples` 每项 `[样本id, 会话id, 当前划分]`，当前划分为 `"train"` 或 `"test"`，顺序打乱；样本 id 互不相同；
    - 样本总数不超过 6000，可能为空。

    ### 三、示例

    ```text
    samples = [["s1","c1","train"],["s2","c1","test"],["s3","c1","test"],
               ["s4","c2","train"],["s5","c2","test"]]
    返回    = {"train": ["s4", "s5"], "test": ["s1", "s2", "s3"], "moved": 2}
    ```

    会话 `c1` 在测试集有 2 条、训练集 1 条，整体归测试集，`s1` 被挪动；会话 `c2` 两边各 1 条，并列归训练集，`s5` 被挪动。共挪动 2 条。
    ''',
    sample=[S53],
    cases=lambda: [
        [S53],
        [[]],
        [[["a", "g", "train"]]],
        [[["a", "g", "train"], ["b", "g", "test"]]],
        [[["b", "g", "train"], ["a", "g", "test"], ["d", "h", "train"], ["c", "h", "test"]]],
        [[["x1", "g", "test"], ["x2", "g", "test"], ["x3", "g", "test"]]],
        [[["s10", "g", "test"], ["s2", "g", "train"], ["s1", "g", "train"]]],
        [[["a", "g1", "train"], ["b", "g1", "train"], ["c", "g2", "test"], ["d", "g2", "test"], ["e", "g2", "train"]]],
        [_rand53(random.Random(421), 500, 30)],
        [_rand53(random.Random(422), 6000, 300)],
    ],
    reference=fix_split,
    alt=_alt53,
    fuzz=lambda rng: [_rand53(rng, rng.randint(0, 15), rng.randint(1, 4))],
    negatives={
        "两边数量相同时归了测试集": _neg53_tie_test,
        "只统计没有挪动样本": _neg53_keep,
        "结果没有按样本 id 排序": _neg53_unsorted,
    },
    explanation=r'''
    分两遍：第一遍统计每场会话在两边的数量，决定它最终归哪一边；第二遍按决定把样本放进结果，同时统计挪动数。最后对两个 id 列表排序。

    关键在于「按会话整体搬迁」：只把少数那几条挪走，剩下的样本仍属于同一场会话，泄漏依然存在。并列时归训练集，因为训练集多一些通常没有坏处，而测试集里混进泄漏样本会让指标虚高。
    ''',
)


# ---------------------------------------------------------------- 54 批大小选择
def choose_batch(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps):
    for batch in range(max_batch, 0, -1):  # 从大到小找第一个满足时延要求的批次
        latency = base_ms + per_item_ms * batch
        if latency <= latency_budget_ms:
            qps = batch * 1000 / latency
            return [batch, round(qps, 3)] if qps >= min_qps else [0, 0.0]
    return [0, 0.0]


def _alt54(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps):
    feasible = [b for b in range(1, max_batch + 1) if base_ms + per_item_ms * b <= latency_budget_ms]
    if not feasible:
        return [0, 0.0]
    batch = max(feasible)
    qps = Fraction(batch * 1000, base_ms + per_item_ms * batch)
    return [batch, round(float(qps), 3)] if qps >= Fraction(str(min_qps)) else [0, 0.0]


def _wrong54(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps, ignore_latency, smallest):
    batch = max_batch if ignore_latency else max(
        (b for b in range(1, max_batch + 1) if base_ms + per_item_ms * b <= latency_budget_ms), default=None)
    if batch is None:
        return [0, 0.0]
    if smallest and not ignore_latency:
        batch = min(b for b in range(1, max_batch + 1) if base_ms + per_item_ms * b <= latency_budget_ms)
    qps = batch * 1000 / (base_ms + per_item_ms * batch)
    return [batch, round(qps, 3)]


def _neg54_latency(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps):
    return _wrong54(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps, ignore_latency=True, smallest=False)


def _neg54_qps(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps):
    return _wrong54(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps, ignore_latency=False, smallest=False)


def _neg54_small(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps):
    return _wrong54(max_batch, base_ms, per_item_ms, latency_budget_ms, min_qps, ignore_latency=False, smallest=True)


S54 = (32, 20, 5, 100, 10)

P54 = problem(
    title="推理批大小与时延预算",
    theme="capacity", ability="智能系统设计", knowledge="智能系统监控与容量规划",
    fn="choose_batch", params=["max_batch", "base_ms", "per_item_ms", "latency_budget_ms", "min_qps"],
    description=r'''
    ### 一、题目描述

    数字人推理服务按批处理请求。处理一个大小为 `b` 的批次，耗时（毫秒）= `base_ms + per_item_ms × b`，吞吐（条/秒）= `b × 1000 ÷ 耗时`。批次越大吞吐越高，但时延也越长。

    请在 `1 ≤ b ≤ max_batch` 且**耗时不超过** `latency_budget_ms` 的批次里，选最大的 `b`：

    - 找不到满足时延要求的批次，返回 `[0, 0.0]`；
    - 找到的 `b` 吞吐低于 `min_qps`，同样返回 `[0, 0.0]`；
    - 否则返回 `[b, 吞吐]`，吞吐用 `round(x, 3)` 保留 3 位小数。

    ### 二、输入说明

    各参数均为非负整数，`max_batch ≥ 1`；`min_qps` 可以是小数。用例中不会出现吞吐恰好落在舍入边界上的情况。

    ### 三、示例

    ```text
    choose_batch(32, 20, 5, 100, 10) → [16, 160.0]
    ```

    `b = 16` 时耗时 20 + 5 × 16 = 100 毫秒，恰好不超过预算；`b = 17` 时耗时 105 毫秒，超出预算。`b = 16` 的吞吐为 16 × 1000 ÷ 100 = 160，不低于 10。
    ''',
    sample=[*S54],
    cases=lambda: [
        [*S54],
        [8, 10, 2, 100, 1],
        [10, 200, 1, 100, 1],
        [4, 50, 10, 100, 50],
        [100, 1, 1, 50, 0],
        [7, 3, 9, 200, 0],
        [10, 0, 10, 100, 100],
        [1, 5, 5, 10, 1],
        [3, 10, 30, 0, 1],
        [64, 12, 7, 150, 40.5],
    ],
    reference=choose_batch,
    alt=_alt54,
    negatives={
        "没有考虑时延预算，直接取最大批次": _neg54_latency,
        "没有检查吞吐下限": _neg54_qps,
        "取了满足要求的最小批次": _neg54_small,
    },
    explanation=r'''
    吞吐随批大小单调不降：批次越大，时延越长，吞吐也越高（或持平）。所以从 `max_batch` 开始往下找，第一个满足时延预算的就是满足条件的最大批次，再核对一下吞吐下限。

    这道题的业务含义是「批大小是在时延和吞吐之间做取舍」：数字人对话对首字时延很敏感，批大小不能一味求大。另外别忘了两种返回 `[0, 0.0]` 的情况：根本放不下任何一个批次，或者吞吐太低。
    ''',
)


# ---------------------------------------------------------------- 55 坐席缺口测算
def staffing_hours(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour):
    gaps = []
    for volume, staff in zip(volumes, staff_per_hour):
        needed = math.ceil(volume * (1 - auto_rate) / 3600 * aht_seconds / occupancy)
        gaps.append(max(0, needed - staff))
    return [gaps, sum(1 for g in gaps if g > 0)]


def _alt55(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour):
    def frac(x):
        return Fraction(str(x))

    gaps = []
    for volume, staff in zip(volumes, staff_per_hour):
        needed = math.ceil(frac(volume) * (1 - frac(auto_rate)) / 3600 * frac(aht_seconds) / frac(occupancy))
        gaps.append(max(0, needed - staff))
    return [gaps, sum(1 for g in gaps if g > 0)]


def _wrong55(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour, full_human, rounding, clamp):
    gaps = []
    for volume, staff in zip(volumes, staff_per_hour):
        load = volume if full_human else volume * (1 - auto_rate)
        needed = (round if rounding else math.ceil)(load / 3600 * aht_seconds / occupancy)
        gaps.append(max(0, needed - staff) if clamp else needed - staff)
    return [gaps, sum(1 for g in gaps if g > 0)]


def _neg55_full(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour):
    return _wrong55(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour, full_human=True, rounding=False, clamp=True)


def _neg55_round(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour):
    return _wrong55(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour, full_human=False, rounding=True, clamp=True)


def _neg55_raw(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour):
    return _wrong55(volumes, auto_rate, aht_seconds, occupancy, staff_per_hour, full_human=False, rounding=False, clamp=False)


def _clear_of_integer(x):
    return abs(x - round(x)) > 1e-6  # 远离整数边界，ceil 的结果不存在浮点歧义


def _rand55(rng, hours):
    while True:
        volumes = [rng.randint(100, 3000) for _ in range(hours)]
        auto, aht, occupancy = rng.choice([0.5, 0.75, 0.8, 0.9]), rng.choice([120, 180, 240, 300]), rng.choice([0.5, 0.75, 0.8])
        if all(_clear_of_integer(v * (1 - auto) / 3600 * aht / occupancy) for v in volumes):
            staff = [rng.randint(0, 60) for _ in range(hours)]
            return volumes, auto, aht, occupancy, staff


S55 = ([360, 720, 180], 0.5, 180, 0.75, [10, 30, 5])

P55 = problem(
    title="转人工坐席缺口测算",
    theme="routing", ability="智能系统设计", knowledge="人机交互流程设计",
    fn="staffing_hours", params=["volumes", "auto_rate", "aht_seconds", "occupancy", "staff_per_hour"],
    imports="import math",
    description=r'''
    ### 一、题目描述

    数字人客服上线后，仍有部分会话要转给人工坐席。训练师要测算每个小时的坐席缺口：

    1. 第 h 小时有 `volumes[h]` 条会话进线，其中比例为 `auto_rate` 的部分由数字人处理，其余转人工；
    2. 转人工的会话平均处理时长为 `aht_seconds` 秒。由利特尔法则，同时在线的会话数 = 转人工的进线速率（条/秒） × 平均处理时长；
    3. 每名坐席的并发利用率最多为 `occupancy`，所以需要的坐席数 = `ceil(转人工会话数 ÷ 3600 × aht_seconds ÷ occupancy)`；
    4. 该小时的缺口 = `max(0, 需要的坐席数 − staff_per_hour[h])`。

    返回 `[每小时缺口的列表, 存在缺口的小时数]`。

    ### 二、输入说明

    - `volumes` 与 `staff_per_hour` 等长（1 ≤ 长度 ≤ 720），`volumes` 为非负整数，`staff_per_hour[h]` 为非负整数；
    - `auto_rate` 在 `[0, 1]` 内，`aht_seconds`、`occupancy` 为正数。用例中所需坐席数的中间结果都离整数足够远，按浮点数计算、用 `math.ceil` 取整即可。

    ### 三、示例

    ```text
    volumes          = [360, 720, 180]
    auto_rate = 0.5，aht_seconds = 180，occupancy = 0.75
    staff_per_hour   = [10, 30, 5]
    返回             = [[2, 0, 1], 2]
    ```

    第 1 小时：转人工 180 条，进线速率 0.05 条/秒，同时在线 0.05 × 180 = 9 路，除以利用率 0.75 需要 12 名坐席，现有 10 名，缺口 2。第 2 小时需要 24 名，现有 30 名，缺口 0。第 3 小时需要 6 名，缺口 1。
    ''',
    sample=[*S55],
    cases=lambda: [
        [*S55],
        [[0, 0], 0.8, 120, 0.5, [0, 0]],
        [[3600], 0.75, 240, 0.8, [59]],
        [[1200, 2400], 0.9, 180, 0.75, [10, 10]],
        [[100, 200, 300], 0.0, 60, 0.5, [100, 0, 0]],
        _rand55(random.Random(431), 24),
        _rand55(random.Random(432), 24),
        _rand55(random.Random(433), 168),
        _rand55(random.Random(434), 720),
        _rand55(random.Random(435), 720),
    ],
    reference=staffing_hours,
    alt=_alt55,
    negatives={
        "没有扣除数字人自动处理的部分": _neg55_full,
        "所需坐席数四舍五入而不是向上取整": _neg55_round,
        "缺口没有截断为 0，出现负数": _neg55_raw,
    },
    explanation=r'''
    每个小时独立计算：先扣掉数字人自动处理的部分，把每小时的进线量换算成「条/秒」，乘以平均处理时长得到同时在线的会话数，再除以利用率得到需要的坐席数，向上取整后与当班人数比较。

    易错点：不要漏掉 `(1 − auto_rate)`，否则会高估人工压力；坐席只能多不能少，要向上取整；人手有富余时缺口记 0 而不是负数。
    ''',
)


# ---------------------------------------------------------------- 56 抽样误差与样本量
def moe_sample_sizes(sizes, rates, moe, z):
    result = []
    for size, rate in zip(sizes, rates):
        base = z * z * rate * (1 - rate) / (moe * moe)  # 不考虑总体规模时的样本量
        if base < 1:
            result.append(0)
        else:
            result.append(math.ceil(base / (1 + (base - 1) / size)))  # 有限总体校正
    return [result, sum(result)]


def _alt56(sizes, rates, moe, z):
    def frac(x):
        return Fraction(str(x))

    result = []
    for size, rate in zip(sizes, rates):
        base = frac(z) ** 2 * frac(rate) * (1 - frac(rate)) / frac(moe) ** 2
        result.append(0 if base < 1 else math.ceil(base / (1 + (base - 1) / size)))
    return [result, sum(result)]


def _wrong56(sizes, rates, moe, z, correction, rounding):
    result = []
    for size, rate in zip(sizes, rates):
        base = z * z * rate * (1 - rate) / (moe * moe)
        if base < 1:
            result.append(0)
        else:
            result.append((round if rounding else math.ceil)(base / (1 + (base - 1) / size) if correction else base))
    return [result, sum(result)]


def _neg56_no_fpc(sizes, rates, moe, z):
    return _wrong56(sizes, rates, moe, z, correction=False, rounding=False)


def _neg56_round(sizes, rates, moe, z):
    return _wrong56(sizes, rates, moe, z, correction=True, rounding=True)


def _neg56_p(sizes, rates, moe, z):
    # 把 p(1 − p) 写成了 p
    result = [math.ceil((z * z * rate / (moe * moe)) / (1 + (z * z * rate / (moe * moe) - 1) / size)) if rate > 0 else 0
              for size, rate in zip(sizes, rates)]
    return [result, sum(result)]


def _rand56(rng, count):
    while True:
        sizes = [rng.randint(5, 5000) for _ in range(count)]
        rates = [round(rng.uniform(0.02, 0.98), 2) for _ in range(count)]
        moe, z = rng.choice([0.03, 0.05, 0.08, 0.1]), rng.choice([1.5, 1.96, 2.0, 2.58])
        base = [z * z * r * (1 - r) / (moe * moe) for r in rates]
        if all(b < 1 or _clear_of_integer(b / (1 + (b - 1) / s)) for b, s in zip(base, sizes)):
            return sizes, rates, moe, z


S56 = ([1000, 100, 50], [0.5, 0.5, 0.5], 0.1, 2)

P56 = problem(
    title="抽样误差与样本量测算",
    theme="sampling", ability="智能训练", knowledge="评测集构建与分层抽样",
    fn="moe_sample_sizes", params=["sizes", "rates", "moe", "z"],
    imports="import math",
    description=r'''
    ### 一、题目描述

    评测集要估计数字人回答中「有问题」的比例。每层总体的规模为 `sizes[i]`，预估的问题比例为 `rates[i]`。希望置信水平对应的临界值为 `z`（95% 置信水平约为 1.96），允许的误差幅度为 `moe`。请计算每层需要的样本量：

    1. 不考虑总体规模时的样本量 `n0 = z² × p × (1 − p) ÷ moe²`；
    2. 若 `n0 < 1`，所需样本量为 0；
    3. 否则做有限总体校正：`n = ceil(n0 ÷ (1 + (n0 − 1) ÷ N))`。

    返回 `[每层所需样本量的列表, 合计]`，两个数都是整数。

    ### 二、输入说明

    - `sizes` 与 `rates` 等长（1 ≤ 长度 ≤ 500）；`sizes[i]` 为正整数，`rates[i]` 在 `[0, 1]` 内且最多两位小数；
    - `moe`、`z` 为正数。用例中样本量的中间结果都离整数足够远，按浮点数计算、用 `math.ceil` 取整即可。

    ### 三、示例

    ```text
    sizes = [1000, 100, 50]
    rates = [0.5, 0.5, 0.5]
    moe = 0.1，z = 2
    返回 = [[91, 51, 34], 176]
    ```

    三层的 `n0` 都是 2² × 0.5 × 0.5 ÷ 0.1² = 100。总体规模 1000 时，n = 100 ÷ (1 + 99 ÷ 1000) ≈ 90.99，向上取整为 91；总体规模 100 时 n ≈ 50.25，取 51；总体规模 50 时 n ≈ 33.56，取 34。总体越小，需要抽的比例越大。
    ''',
    sample=[*S56],
    cases=lambda: [
        [*S56],
        [[1000, 1000, 1000], [0.1, 0.2, 0.8], 0.1, 2],
        [[500], [0.5], 0.05, 1.96],
        [[100, 200], [0.0, 1.0], 0.05, 2],
        [[1, 2, 3], [0.5, 0.5, 0.5], 0.1, 2],
        [[4000, 1500, 600], [0.3, 0.45, 0.6], 0.03, 1.96],
        [[250, 250], [0.25, 0.75], 0.06, 2.58],
        [[10000], [0.5], 0.01, 2],
        _rand56(random.Random(441), 50),
        _rand56(random.Random(442), 500),
    ],
    reference=moe_sample_sizes,
    alt=_alt56,
    negatives={
        "没有做有限总体校正": _neg56_no_fpc,
        "样本量四舍五入而不是向上取整": _neg56_round,
        "把 p × (1 − p) 写成了 p": _neg56_p,
    },
    explanation=r'''
    这是评测中最常用的样本量公式。先算出「总体无限大」时需要的样本量 `n0`，它只取决于置信水平、误差幅度和比例的方差（p 取 0.5 时方差最大，样本量也最保守）。总体较小时，抽样比例本身就能带来确定性，所以要用有限总体校正把样本量压下来。

    注意比例接近 0 或 1 时方差很小，`n0` 可能小于 1，此时直接取 0；样本量要向上取整，否则达不到要求的误差幅度。
    ''',
)


# ---------------------------------------------------------------- 57 抖动检测
def flapping_services(alerts, window_sec, flaps, suppress_sec):
    events = {}
    for ts, service, state in alerts:
        events.setdefault(service, []).append((ts, state))
    result = []
    for service in sorted(events):
        timeline = sorted(events[service], key=lambda item: item[0])  # 稳定排序：时间相同按输入顺序
        flips = [0] * len(timeline)  # flips[k]：到第 k 条为止（含）发生过的状态翻转次数
        for k in range(1, len(timeline)):
            flips[k] = flips[k - 1] + (timeline[k][1] != timeline[k - 1][1])
        left = 0
        for right in range(len(timeline)):
            while timeline[right][0] - timeline[left][0] > window_sec:
                left += 1
            if flips[right] - flips[left] >= flaps:  # 窗口 (left, right] 内的翻转次数达到阈值
                result.append([service, timeline[right][0] + suppress_sec])
                break
    return result


def _alt57(alerts, window_sec, flaps, suppress_sec):
    events = defaultdict(list)
    for ts, service, state in alerts:
        events[service].append((ts, state))
    result = []
    for service in sorted(events):
        timeline = sorted(events[service], key=lambda item: item[0])
        hit = None
        for j in range(len(timeline)):  # 暴力：枚举窗口的右端点 j 和左端点 i
            for i in range(j):
                if timeline[j][0] - timeline[i][0] <= window_sec and \
                        sum(1 for k in range(i + 1, j + 1) if timeline[k][1] != timeline[k - 1][1]) >= flaps:
                    hit = timeline[j][0] + suppress_sec
                    break
            if hit is not None:
                break
        if hit is not None:
            result.append([service, hit])
    return result


def _wrong57(alerts, window_sec, flaps, suppress_sec, no_window, strict_more):
    events = defaultdict(list)
    for ts, service, state in alerts:
        events[service].append((ts, state))
    result = []
    for service in sorted(events):
        timeline = sorted(events[service], key=lambda item: item[0])
        flips = [0] * len(timeline)
        for k in range(1, len(timeline)):
            flips[k] = flips[k - 1] + (timeline[k][1] != timeline[k - 1][1])
        hit = None
        for right in range(len(timeline)):
            left = 0 if no_window else max(
                (i for i in range(right + 1) if timeline[right][0] - timeline[i][0] <= window_sec), default=0)
            reached = flips[right] - flips[left] > flaps if strict_more else flips[right] - flips[left] >= flaps
            if reached:
                hit = timeline[right][0] + suppress_sec
                break
        if hit is not None:
            result.append([service, hit])
    return result


def _neg57_no_window(alerts, window_sec, flaps, suppress_sec):
    return _wrong57(alerts, window_sec, flaps, suppress_sec, no_window=True, strict_more=False)


def _neg57_more(alerts, window_sec, flaps, suppress_sec):
    return _wrong57(alerts, window_sec, flaps, suppress_sec, no_window=False, strict_more=True)


def _unsorted57(alerts, window_sec, flaps, suppress_sec):
    events = defaultdict(list)
    for ts, service, state in alerts:
        events[service].append((ts, state))
    result = []
    for service, timeline in sorted(events.items()):
        flips = [0] * len(timeline)
        for k in range(1, len(timeline)):
            flips[k] = flips[k - 1] + (timeline[k][1] != timeline[k - 1][1])
        for right in range(len(timeline)):
            left = 0
            while timeline[right][0] - timeline[left][0] > window_sec:
                left += 1
            if flips[right] - flips[left] >= flaps:
                result.append([service, timeline[right][0] + suppress_sec])
                break
    return result


def _neg57_unsorted(alerts, window_sec, flaps, suppress_sec):
    return _unsorted57(alerts, window_sec, flaps, suppress_sec)


def _rand57(rng, count, services):
    states = ["UP", "DOWN"]
    rows, current = {}, {}
    for i in range(count):
        service = f"svc{rng.randrange(services):02d}"
        state = states[rng.random() < 0.25] if service in current else "UP"
        current[service] = state
        rows.setdefault(service, []).append([rng.randrange(60000), service, state])
    alerts = [row for service in rows for row in rows[service]]
    rng.shuffle(alerts)
    return alerts


S57 = ([[0, "a", "UP"], [10, "a", "DOWN"], [20, "a", "UP"], [30, "a", "DOWN"], [40, "a", "UP"],
        [0, "b", "UP"], [50, "b", "DOWN"]], 35, 3, 120)

P57 = problem(
    title="服务抖动检测与抑制",
    theme="alerts", ability="智能系统设计", knowledge="智能系统监控与告警治理",
    fn="flapping_services", params=["alerts", "window_sec", "flaps", "suppress_sec"],
    description=r'''
    ### 一、题目描述

    数字人平台的健康检查每隔一段时间上报一次服务状态。如果一个服务在短时间内反复「UP → DOWN → UP」，说明它在抖动，这时候逐条告警只会打扰值班员，应当直接抑制一段时间。

    `alerts` 每项 `[时间秒, 服务名, 状态]`，状态为 `"UP"` 或 `"DOWN"`。对每个服务：

    1. 把它的记录按时间升序排列（时间相同按输入顺序）；
    2. 相邻两条记录状态不同，记一次「翻转」；
    3. 从左到右看每条记录，如果存在一个长度不超过 `window_sec` 的时间窗口，窗口内的翻转次数**达到** `flaps`，就判定为抖动，并抑制到「窗口内最后一条记录的时间 + `suppress_sec`」；取最早出现这种情况的位置。

    返回 `[[服务名, 抑制截止时间], ...]`，只包含被判为抖动的服务，按服务名字典序升序。

    ### 二、输入说明

    - 告警总数不超过 8000，输入顺序打乱；`window_sec`、`suppress_sec` 为非负整数，`flaps` 为正整数。

    ### 三、示例

    ```text
    alerts  = [[0,"a","UP"],[10,"a","DOWN"],[20,"a","UP"],[30,"a","DOWN"],
               [40,"a","UP"],
               [0,"b","UP"],[50,"b","DOWN"]]
    window_sec = 35，flaps = 3，suppress_sec = 120
    返回    = [["a", 150]]
    ```

    服务 `a` 在第 30 秒时，往前 35 秒的窗口里（第 0 到 30 秒）已经翻转了 3 次，判定抖动，抑制到 30 + 120 = 150。服务 `b` 只翻转 1 次。
    ''',
    sample=[*S57],
    cases=lambda: [
        [*S57],
        [[[0, "a", "UP"], [10, "a", "UP"], [20, "a", "DOWN"]], 100, 3, 60],
        [[], 10, 2, 60],
        [[[0, "s", "UP"], [10, "s", "DOWN"], [20, "s", "UP"]], 100, 3, 60],
        [[[0, "s", "UP"], [100, "s", "DOWN"], [110, "s", "UP"], [120, "s", "DOWN"]], 15, 3, 60],
        [[[30, "s", "DOWN"], [0, "s", "UP"], [10, "s", "DOWN"], [20, "s", "UP"]], 35, 3, 120],
        [[[0, "s", "UP"], [5, "s", "UP"], [6, "s", "UP"], [10, "s", "DOWN"], [20, "s", "UP"], [30, "s", "DOWN"], [40, "s", "UP"]], 60, 4, 5],
        [[[0, "x", "UP"], [1, "x", "DOWN"], [2, "y", "UP"], [3, "y", "DOWN"], [4, "z", "UP"]], 10, 1, 0],
        [_rand57(random.Random(451), 2000, 20), 600, 4, 1800],
        [_rand57(random.Random(452), 8000, 40), 300, 3, 900],
    ],
    reference=flapping_services,
    alt=_alt57,
    alt_case_ok=lambda args: len(args[0]) <= 600,
    fuzz=lambda rng: [_rand57(rng, rng.randint(0, 25), rng.randint(1, 6)), rng.randint(0, 60), rng.randint(1, 5), rng.randint(0, 120)],
    negatives={
        "没有滑动窗口，按全部翻转次数判断": _neg57_no_window,
        "窗口内翻转次数严格大于阈值才算抖动": _neg57_more,
        "没有先按时间排序": _neg57_unsorted,
    },
    explanation=r'''
    对每个服务先排序，再记录「到第 k 条为止的累计翻转次数」`flips[k]`。以每条记录为窗口右端点，用双指针把左端点推到窗口内最早的记录：窗口 `(left, right]` 内的翻转次数就是 `flips[right] − flips[left]`。从左到右第一次达到阈值就记录并停止。整体是 O(n log n)。

    累计翻转次数相当于「前缀和」，是把「统计窗口内的变化次数」做成 O(1) 查询的常用技巧。抖动检测的价值在于把「反复出现的同一问题」压成一条告警，让值班员关注真正的故障。
    ''',
)


PROBLEMS = [P51, P52, P53, P54, P55, P56, P57]
