"""第 5 套编程题（51–57）。字段含义见 scripts/finals/build.py 的文件说明。

多参数用例统一写成元组再展开（sample=[*S51]），避免手数括号出错。
"""
import math
import random
import re
import statistics
from fractions import Fraction

import common


def problem(**spec):
    return spec


# ---------------------------------------------------------------- 51 串行流水线的瓶颈
def line_throughput(stages, demand):
    capacity = [per_worker * workers for _, per_worker, workers in stages]
    bottleneck = min(range(len(stages)), key=lambda i: capacity[i])  # 并列时 min 取靠前的
    output = min(demand, capacity[bottleneck])
    return [output, stages[bottleneck][0],
            {name: round(output / size, 4) for (name, _, _), size in zip(stages, capacity)}]


def _alt51(stages, demand):
    capacity = {}
    for name, per_worker, workers in stages:
        capacity[name] = Fraction(str(per_worker)) * workers
    least = min(capacity.values())
    output = min(Fraction(str(demand)), least)
    bottleneck = next(name for name in capacity if capacity[name] == least)
    return [float(output), bottleneck,
            {name: round(float(output / size), 4) for name, size in capacity.items()}]


def _capacity51(stages, with_workers):
    return [per * (workers if with_workers else 1) for _, per, workers in stages]


def _report51(stages, capacity, bottleneck, output, basis):
    return [output, stages[bottleneck][0],
            {name: round(basis / size, 4) for (name, _, _), size in zip(stages, capacity)}]


def _neg51_demand(stages, demand):
    # 利用率按「需求 ÷ 产能」算，没有用流水线的实际产出
    capacity = _capacity51(stages, with_workers=True)
    bottleneck = min(range(len(stages)), key=lambda i: capacity[i])
    return _report51(stages, capacity, bottleneck, min(demand, capacity[bottleneck]), demand)


def _neg51_average(stages, demand):
    # 产出取各环节产能的平均值
    capacity = _capacity51(stages, with_workers=True)
    bottleneck = min(range(len(stages)), key=lambda i: capacity[i])
    output = min(demand, sum(capacity) / len(capacity))
    return _report51(stages, capacity, bottleneck, output, output)


def _neg51_first(stages, demand):
    # 瓶颈一律取第一个环节
    capacity = _capacity51(stages, with_workers=True)
    output = min(demand, min(capacity))
    return _report51(stages, capacity, 0, output, output)


def _neg51_single(stages, demand):
    # 有效产能忘了乘人数
    capacity = _capacity51(stages, with_workers=False)
    bottleneck = min(range(len(stages)), key=lambda i: capacity[i])
    output = min(demand, capacity[bottleneck])
    return _report51(stages, capacity, bottleneck, output, output)


def _fuzz51(rng):
    while True:
        stages = [[f"s{i}", rng.choice([10, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200]), rng.randint(1, 5)]
                  for i in range(rng.randint(1, 8))]
        demand = rng.choice([0, 50, 100, 120, 150, 200, 240, 300, 400, 500, 800])
        capacity = [per * workers for _, per, workers in stages]
        output = min([demand] + capacity)
        # 利用率恰好是 x.xxxx5 时 round(x, 4) 有歧义，随机用例避开
        if all((Fraction(output, size) * 10000).denominator != 2 for size in capacity):
            return stages, demand


S51 = ([["collect", 120, 2], ["clean", 200, 1], ["label", 90, 3]], 400)

P51 = problem(
    title="串行流水线的产能瓶颈与利用率",
    theme="critical_path", ability="业务分析", knowledge="业务流程设计与瓶颈分析",
    fn="line_throughput", params=["stages", "demand"],
    description=r'''
    ### 一、题目描述

    数字人短视频团队按「脚本 → 配音 → 剪辑」这样的串行工序生产内容。`stages` 给出每个环节的产能，`demand` 是每小时需要产出的条数。请找出瓶颈环节，并算出每个环节的利用率：

    - 环节的有效产能 = `单人产能 × 人数`；
    - 流水线的产出 = `min(demand, 各环节有效产能的最小值)`，最慢的环节决定了整体；
    - 瓶颈环节 = 有效产能最小的环节，并列时取 `stages` 中靠前的；
    - 每个环节的利用率 = 产出 ÷ 该环节有效产能，用 `round(x, 4)` 保留 4 位小数。

    返回 `[产出, 瓶颈环节名称, {环节名称: 利用率}]`，字典要包含全部环节。

    ### 二、输入说明

    - `stages` 每项 `[名称, 单人产能, 人数]`，1 ≤ 环节数 ≤ 3000；名称互不相同；单人产能为正数（整数或一位小数），人数为正整数；
    - `demand` 为非负数（整数或一位小数）。用例中不会出现利用率恰好落在舍入边界上的情况。

    ### 三、示例

    ```text
    stages = [["collect", 120, 2], ["clean", 200, 1], ["label", 90, 3]]
    demand = 400
    返回   = [200, "clean", {"collect": 0.8333, "clean": 1.0, "label": 0.7407}]
    ```

    三个环节的有效产能分别是 240、200、270，最小的是 `clean`，需求 400 无法全部满足，产出是 200。利用率：200 ÷ 240 ≈ 0.8333，200 ÷ 200 = 1.0，200 ÷ 270 ≈ 0.7407。
    ''',
    sample=[*S51],
    cases=lambda: [
        [*S51],
        [[["a", 100, 1], ["b", 50, 2]], 80],
        [[["x", 60, 1], ["y", 30, 2], ["z", 60, 1]], 1000],
        [[["solo", 100, 1], ["team", 30, 4]], 500],
        [[["a", 300, 1], ["b", 250, 1], ["c", 90, 2]], 10000],
        [[["only", 40, 3]], 100],
        [[["a", 12.5, 4], ["b", 60, 1]], 70],
        [[["a", 10, 1], ["b", 20, 1]], 0],
        _fuzz51(random.Random(511)),
        [[["s%04d" % i, 50 + (i * 7) % 150, 1 + i % 4] for i in range(3000)], 100000],
    ],
    reference=line_throughput,
    alt=_alt51,
    fuzz=_fuzz51,
    negatives={
        "利用率按需求而不是实际产出计算": _neg51_demand,
        "产出取各环节产能的平均值": _neg51_average,
        "瓶颈一律取第一个环节": _neg51_first,
        "有效产能没有乘人数": _neg51_single,
    },
    explanation=r'''
    串行流水线的产出由最慢的环节决定。先算出每个环节的有效产能并找出最小值，产出就是需求与这个最小值中较小的那个；再逐个环节用产出除以产能，得到利用率。

    易错点：利用率的分子是流水线的**实际产出**，需求超过产能时如果拿需求做分子，会算出大于 1 的利用率。另外，需求充足时瓶颈环节的利用率一定是 1，其他环节则有空闲，这正是「瓶颈决定整体、非瓶颈环节有富余」的体现。
    ''',
)


# ---------------------------------------------------------------- 52 人机标注的槽位融合
def reconcile_slots(ann_a, ann_b, reliability):
    tied = reliability[0] == reliability[1]
    preferred = ann_a if reliability[0] >= reliability[1] else ann_b  # 可靠度高的那一方
    if ann_a[0] == ann_b[0]:
        intent = ann_a[0]
    else:
        intent = "INTENT_CONFLICT" if tied else preferred[0]
    slots_a, slots_b = dict(ann_a[1]), dict(ann_b[1])
    slots, review = {}, []
    for slot in sorted(set(slots_a) | set(slots_b)):
        if slot not in slots_b:
            slots[slot] = slots_a[slot]
        elif slot not in slots_a:
            slots[slot] = slots_b[slot]
        elif slots_a[slot] == slots_b[slot]:
            slots[slot] = slots_a[slot]
        elif tied:
            review.append(slot)
        else:
            slots[slot] = dict(preferred[1])[slot]
    return {"intent": intent, "slots": slots, "review": review}


def _alt52(ann_a, ann_b, reliability):
    higher = "A" if reliability[0] >= reliability[1] else "B"  # 可靠度相同时视作 A，冲突另行处理
    table = {}
    for who, annotation in (("A", ann_a), ("B", ann_b)):
        for slot, value in annotation[1]:
            table.setdefault(slot, {})[who] = value
    slots, review = {}, []
    for slot in sorted(table):
        votes = table[slot]
        if len(votes) == 1 or votes["A"] == votes["B"]:
            slots[slot] = votes[next(iter(votes))]
        elif reliability[0] == reliability[1]:
            review.append(slot)
        else:
            slots[slot] = votes[higher]
    if ann_a[0] == ann_b[0]:
        intent = ann_a[0]
    elif reliability[0] == reliability[1]:
        intent = "INTENT_CONFLICT"
    else:
        intent = {"A": ann_a, "B": ann_b}[higher][0]
    return {"intent": intent, "slots": slots, "review": review}


def _wrong52(ann_a, ann_b, reliability, trust_a_only, tie_takes_a):
    reliability = [1.0, 0.0] if trust_a_only else reliability
    higher = ann_a if reliability[0] >= reliability[1] else ann_b
    intent = ann_a[0] if ann_a[0] == ann_b[0] else higher[0]
    slots, review = dict(ann_a[1]), []
    for slot, value in ann_b[1]:
        if slot not in slots:
            slots[slot] = value
        elif slots[slot] != value:
            if reliability[0] == reliability[1] and not tie_takes_a:
                review.append(slot)
            elif higher is ann_b:
                slots[slot] = value
    return {"intent": intent, "slots": {slot: slots[slot] for slot in sorted(slots)}, "review": review}


def _neg52_trust_a(ann_a, ann_b, reliability):
    # 一律采信人工标注 ann_a
    return _wrong52(ann_a, ann_b, reliability, trust_a_only=True, tie_takes_a=True)


def _neg52_tie_a(ann_a, ann_b, reliability):
    # 可靠度并列时直接取 ann_a，没有送审
    return _wrong52(ann_a, ann_b, reliability, trust_a_only=False, tie_takes_a=True)


def _neg52_conflict(ann_a, ann_b, reliability):
    # 意图不同就报冲突，没有按可靠度裁决
    merged = reconcile_slots(ann_a, ann_b, reliability)
    if ann_a[0] != ann_b[0]:
        merged["intent"] = "INTENT_CONFLICT"
    return merged


def _neg52_missing(ann_a, ann_b, reliability):
    # 只保留可靠度较高一方标出的槽位
    preferred = ann_a if reliability[0] >= reliability[1] else ann_b
    return {"intent": preferred[0], "slots": dict(preferred[1]), "review": []}


def _rand52(rng, slots_count):
    intents = ["QUERY_ORDER", "CHANGE_ORDER", "COMPLAIN", "CHAT"]
    pool = [f"slot{i}" for i in range(slots_count)]
    values = ["北京", "上海", "明天", "后天", "上午", "下午", "手机", "耳机"]

    def annotate():
        chosen = rng.sample(pool, rng.randint(0, min(slots_count, 5)))
        return [rng.choice(intents), [[slot, rng.choice(values)] for slot in chosen]]

    return annotate(), annotate(), [rng.choice([0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) for _ in range(2)]


A52 = ["QUERY_ORDER", [["city", "北京"], ["date", "明天"]]]
B52 = ["QUERY_ORDER", [["city", "上海"], ["time", "上午"]]]
S52 = (A52, B52, [0.8, 0.9])

P52 = problem(
    title="人机标注结果的槽位融合",
    theme="label_merge", ability="数据处理与标注", knowledge="标注结果合并与冲突仲裁",
    fn="reconcile_slots", params=["ann_a", "ann_b", "reliability"],
    description=r'''
    ### 一、题目描述

    数字人对话语料采用「模型预标注 + 人工修订」。同一条话术有两份标注：`ann_a` 是人工标注，`ann_b` 是模型预标注，`reliability = [人工的可靠度, 模型的可靠度]`。请把它们融合成一份结果：

    - **意图**：两份意图相同就取它；不同时取可靠度高的一方的意图；可靠度相同时取 `"INTENT_CONFLICT"`；
    - **槽位**：取两份标注中出现过的全部槽位。只有一方标了，就取这一方的值；两方都标了且值相同，取该值；值不同时取可靠度高的一方的值；可靠度相同时无法裁决，不放进结果，把槽位名加入 `review`。

    返回一个字典：

    ```text
    {
      "intent": 融合后的意图,
      "slots":  {槽位名: 槽位值, ...},
      "review": 需要人工仲裁的槽位名（字典序升序）
    }
    ```

    ### 二、输入说明

    - `ann_a`、`ann_b` 的格式均为 `[意图, [[槽位名, 槽位值], ...]]`，槽位列表可以为空；同一份标注内槽位名不重复；
    - 意图、槽位名、槽位值都是非空字符串；每份标注的槽位不超过 2000 个；
    - `reliability` 是两个 0 到 1 之间的数。

    ### 三、示例

    ```text
    ann_a       = ["QUERY_ORDER", [["city", "北京"], ["date", "明天"]]]
    ann_b       = ["QUERY_ORDER", [["city", "上海"], ["time", "上午"]]]
    reliability = [0.8, 0.9]
    返回        = {"intent": "QUERY_ORDER",
                   "slots": {"city": "上海", "date": "明天", "time": "上午"},
                   "review": []}
    ```

    意图一致。`city` 两方取值不同，模型的可靠度更高（0.9 > 0.8），取「上海」；`date` 只有人工标了，`time` 只有模型标了，都保留。
    ''',
    sample=[*S52],
    cases=lambda: [
        [*S52],
        [A52, B52, [0.95, 0.8]],
        [A52, B52, [0.85, 0.85]],
        [A52, ["CHANGE_ORDER", [["city", "上海"]]], [0.85, 0.85]],
        [A52, ["CHANGE_ORDER", [["city", "上海"]]], [0.6, 0.9]],
        [["CHAT", []], ["CHAT", []], [0.7, 0.7]],
        [["CHAT", [["city", "北京"], ["date", "明天"]]], ["CHAT", [["date", "明天"], ["city", "北京"]]], [0.3, 0.9]],
        [["CHAT", [["city", "北京"]]], ["COMPLAIN", [["city", "北京"]]], [0.7, 0.7]],
        _rand52(random.Random(521), 40),
        _rand52(random.Random(522), 2000),
    ],
    reference=reconcile_slots,
    alt=_alt52,
    fuzz=lambda rng: _rand52(rng, rng.randint(1, 8)),
    negatives={
        "一律采信人工标注": _neg52_trust_a,
        "可靠度并列时直接取人工的值": _neg52_tie_a,
        "意图不同就报冲突，不按可靠度裁决": _neg52_conflict,
        "只保留可靠度较高一方标出的槽位": _neg52_missing,
    },
    explanation=r'''
    分「意图」和「槽位」两部分处理。意图只有一对值，比较简单。槽位要先取两份标注的并集，再分四种情况：只有一方有、两方相同、两方不同且可靠度有高低、两方不同且可靠度并列。前三种都能按规则直接定，最后一种机器定不了，应该交给人。

    易错点：不要因为 `ann_a` 是人工标注就一律采信它，题目给的规则是看可靠度；一方独有的槽位不能丢；`review` 是列表，要排序。这和「多标注员标签合并与仲裁」是同一个思路：能按规则裁决的自动裁决，裁决不了的才送人工。
    ''',
)


# ---------------------------------------------------------------- 53 泄漏综合体检
DROP = set(" \t\n\r,.!?;:'\"-()，。！？；：、「」（）")


def _normalize(text):
    return "".join(ch for ch in text.lower() if ch not in DROP)


def leakage_report(train, test):
    marks = " \t\n\r,.!?;:'\"-()，。！？；：、「」（）"  # 要去掉的空白和标点

    def normalize(text):
        return "".join(ch for ch in text.lower() if ch not in marks)

    train_groups = {group for _, group, _ in train}
    train_texts = {normalize(text) for _, _, text in train}
    test_groups = {group for _, group, _ in test}
    test_texts = {normalize(text) for _, _, text in test}
    group_leaks = len(train_groups & test_groups)
    duplicate_leaks = len(train_texts & test_texts)
    drop = sum(1 for _, group, text in test if group in train_groups or normalize(text) in train_texts)
    clean = group_leaks == 0 and duplicate_leaks == 0
    return {"group_leaks": group_leaks, "duplicate_leaks": duplicate_leaks,
            "drop_from_test": drop, "verdict": "PASS" if clean else "FAIL"}


def _alt53(train, test):
    canon = lambda text: re.sub(r'[\s,.!?;:\'"()，。！？；：、「」（）-]', "", text.lower())
    train_rows = [(group, canon(text)) for _, group, text in train]
    leaked_groups, leaked_texts, drop = set(), set(), 0
    for _, group, text in test:  # 暴力：测试集每条样本都去训练集里逐条找
        same_group = any(group == g for g, _ in train_rows)
        same_text = any(canon(text) == t for _, t in train_rows)
        if same_group:
            leaked_groups.add(group)
        if same_text:
            leaked_texts.add(canon(text))
        drop += same_group or same_text
    clean = not leaked_groups and not leaked_texts
    return {"group_leaks": len(leaked_groups), "duplicate_leaks": len(leaked_texts),
            "drop_from_test": drop, "verdict": "PASS" if clean else "FAIL"}


def _wrong53(train, test, normalize, count_samples, add_up, groups_only):
    def key(text):
        return _normalize(text) if normalize else text

    train_groups = {group for _, group, _ in train}
    train_texts = {key(text) for _, _, text in train}
    by_group = [group in train_groups for _, group, _ in test]
    by_text = [key(text) in train_texts for _, _, text in test]
    if count_samples:  # 按测试集里命中泄漏的样本条数统计
        group_leaks = sum(by_group)
    else:
        group_leaks = len({group for (_, group, _), hit in zip(test, by_group) if hit})
    duplicate_leaks = len({key(text) for (_, _, text), hit in zip(test, by_text) if hit})
    drop = sum(int(a) + int(b) for a, b in zip(by_group, by_text)) if add_up else \
        sum(a or b for a, b in zip(by_group, by_text))
    clean = group_leaks == 0 and (groups_only or duplicate_leaks == 0)
    return {"group_leaks": group_leaks, "duplicate_leaks": duplicate_leaks,
            "drop_from_test": drop, "verdict": "PASS" if clean else "FAIL"}


def _neg53_raw(train, test):
    return _wrong53(train, test, normalize=False, count_samples=False, add_up=False, groups_only=False)


def _neg53_count(train, test):
    return _wrong53(train, test, normalize=True, count_samples=True, add_up=False, groups_only=False)


def _neg53_add(train, test):
    return _wrong53(train, test, normalize=True, count_samples=False, add_up=True, groups_only=False)


def _neg53_verdict(train, test):
    return _wrong53(train, test, normalize=True, count_samples=False, add_up=False, groups_only=True)


def _rand53(rng, count):
    words = ["查", "余额", "天气", "转", "人工", "hello", "WORLD", "orders", "退款", "abc", "123"]
    marks = [",", ".", "!", "?", " ", "，", "。", "！"]

    def text():
        pieces = []
        for _ in range(rng.randint(1, 4)):
            word = rng.choice(words)
            roll = rng.random()
            if roll < 0.12:
                word = word.upper()
            elif roll < 0.24:
                word = word.lower()
            pieces.append(word + (rng.choice(marks) if rng.random() < 0.25 else ""))
        return " ".join(pieces)

    pool = [text() for _ in range(count + 5)]  # 两边从同一个文本池里取样，才会出现重复
    rows = lambda prefix, size: [[f"{prefix}{i:05d}", f"c{rng.randrange(6):02d}", rng.choice(pool)] for i in range(size)]
    return rows("t", rng.randint(0, count)), rows("e", rng.randint(0, count))


S53 = ([["t1", "c1", "帮我查一下余额"], ["t2", "c1", "今天天气怎么样"], ["t3", "c2", "转人工"]],
       [["e1", "c1", "帮我查一下余额。"], ["e2", "c3", "我要投诉"], ["e3", "c2", "明天会下雨吗"]])

P53 = problem(
    title="训练测试集泄漏综合体检",
    theme="leakage", ability="智能训练", knowledge="训练集与测试集的维护",
    fn="leakage_report", params=["train", "test"],
    description=r'''
    ### 一、题目描述

    交付评测集之前要做一次「泄漏体检」。训练集 `train` 和测试集 `test` 中每条样本是 `[样本id, 会话id, 文本]`。请检查两类泄漏，并给出处理建议：

    1. **分组泄漏**：同一个会话的样本同时出现在训练集和测试集。统计出现在两边的**不同会话**的数量；
    2. **重复泄漏**：文本规范化之后相同的样本同时出现在两边。统计出现在两边的**不同规范化文本**的数量。

    文本规范化：转成小写，去掉所有空白字符和下面的 20 个标点。

    ```text
    ,  .  !  ?  ;  :  '  "  -  (  )
    ，  。  ！  ？  ；  ：  、  「  」  （  ）
    ```

    处理建议：测试集中「会话出现在训练集，或者规范化文本出现在训练集」的样本都要剔除。统计这类样本的数量 `drop_from_test`，同一条样本同时命中两类也只算一次。

    返回字典：

    ```text
    {
      "group_leaks":     出现在两边的不同会话数,
      "duplicate_leaks": 出现在两边的不同规范化文本数,
      "drop_from_test":  测试集中需要剔除的样本数,
      "verdict":         "PASS"（没有任何泄漏）或 "FAIL"
    }
    ```

    ### 二、输入说明

    - `train`、`test` 各不超过 10000 条，可以为空；样本 id 互不相同；文本非空，只含字母、数字、汉字、空白和上述标点；规范化之后至少剩一个字符。

    ### 三、示例

    ```text
    train = [["t1","c1","帮我查一下余额"],
             ["t2","c1","今天天气怎么样"],
             ["t3","c2","转人工"]]
    test  = [["e1","c1","帮我查一下余额。"],
             ["e2","c3","我要投诉"],
             ["e3","c2","明天会下雨吗"]]
    返回  = {"group_leaks": 2, "duplicate_leaks": 1,
             "drop_from_test": 2, "verdict": "FAIL"}
    ```

    会话 `c1`、`c2` 两边都有，是 2 处分组泄漏。`e1` 去掉句号后与 `t1` 相同，是 1 处重复泄漏。测试集里 `e1`（同时命中两类，只算一次）和 `e3`（会话泄漏）需要剔除，共 2 条。
    ''',
    sample=[*S53],
    cases=lambda: [
        [*S53],
        [[], [["e1", "c1", "x"]]],
        [[], []],
        [[["t1", "c1", "Hello  world"]], [["e1", "c9", "hello, WORLD!"]]],
        [[["t1", "c1", "a b"]], [["e1", "c1", "A B"], ["e2", "c9", "a,b"]]],
        [[["t1", "c1", "甲"], ["t2", "c1", "乙"], ["t3", "c2", "丙"]],
         [["e1", "c1", "丁"], ["e2", "c1", "戊"], ["e3", "c2", "己"]]],
        [[["t1", "c1", "你好"]], [["e1", "c9", "你 好"]]],
        [[["t1", "c1", "你好世界"]], [["e1", "c9", "你好"], ["e2", "c9", "世界"]]],
        _rand53(random.Random(531), 12),
        _rand53(random.Random(532), 10000),
    ],
    reference=leakage_report,
    alt=_alt53,
    alt_case_ok=lambda args: len(args[0]) * len(args[1]) <= 40000,  # 独立实现是暴力比对，大用例只跑参考解
    fuzz=lambda rng: _rand53(rng, rng.randint(0, 20)),
    negatives={
        "文本没有规范化就直接比较": _neg53_raw,
        "分组泄漏按样本条数统计": _neg53_count,
        "剔除数把两类泄漏简单相加": _neg53_add,
        "只看分组泄漏就下结论": _neg53_verdict,
    },
    explanation=r'''
    分组泄漏和重复泄漏是两类独立的问题：前者看会话 id，后者看文本内容。两类都可以把两边各自放进集合再取交集，这样数出来的是「不同的会话（文本）」有多少个，不会把同一个会话数成好几次。

    易错点：查重之前要做规范化，否则大小写、空格、标点的差异会让同一句话逃过检查；剔除数按样本统计，一条样本同时命中两类只算一次；只要有一类泄漏就不能通过。
    ''',
)


# ---------------------------------------------------------------- 54 推理实例选型
def pick_instance(types, target_qps, p95_limit, min_count):
    best = None
    for name, qps, p95, cost in sorted(types):  # 按名称排序：费用并列时取字典序小的
        if p95 > p95_limit:
            continue
        count = max(min_count, math.ceil(target_qps / qps))
        total = round(float(count) * cost, 2)  # 费用统一返回小数
        if best is None or total < best[2]:
            best = [name, count, total]
    return best or ["NONE", 0, 0.0]


def _alt54(types, target_qps, p95_limit, min_count):
    plans = []
    for name, qps, p95, cost in types:
        if p95 <= p95_limit:
            need = Fraction(str(target_qps)) / Fraction(str(qps))
            count = max(min_count, -(-need // 1))
            plans.append((count * Fraction(str(cost)), name, count))
    if not plans:
        return ["NONE", 0, 0.0]
    total, name, count = min(plans)
    return [name, count, round(float(total), 2)]


def _wrong54(types, target_qps, p95_limit, min_count, check_latency, use_min, floor, pick):
    best = None
    for order, (name, qps, p95, cost) in enumerate(types):
        if check_latency and p95 > p95_limit:
            continue
        exact = math.floor(target_qps / qps) if floor else math.ceil(target_qps / qps)
        count = max(min_count, exact) if use_min else exact
        total = round(count * cost, 2)
        rank = {"cheapest": (total, name), "fastest": (-qps, name), "first": (order,)}[pick]
        if best is None or rank < best[0]:
            best = (rank, [name, count, total])
    return best[1] if best else ["NONE", 0, 0.0]


def _neg54_latency(types, target_qps, p95_limit, min_count):
    return _wrong54(types, target_qps, p95_limit, min_count, False, True, False, "cheapest")


def _neg54_min(types, target_qps, p95_limit, min_count):
    return _wrong54(types, target_qps, p95_limit, min_count, True, False, False, "cheapest")


def _neg54_floor(types, target_qps, p95_limit, min_count):
    return _wrong54(types, target_qps, p95_limit, min_count, True, True, True, "cheapest")


def _neg54_fastest(types, target_qps, p95_limit, min_count):
    return _wrong54(types, target_qps, p95_limit, min_count, True, True, False, "fastest")


def _neg54_first(types, target_qps, p95_limit, min_count):
    return _wrong54(types, target_qps, p95_limit, min_count, True, True, False, "first")


def _fuzz54(rng):
    while True:
        types = [[f"t{i:02d}", rng.choice([0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 4, 8, 20, 50, 120, 300]),
                  rng.randint(10, 400), rng.choice([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10])]
                 for i in range(rng.randint(0, 12))]
        target = rng.choice([0.5, 1, 3, 7, 10, 25, 64, 100, 333, 500, 1000])
        limit, min_count = rng.choice([50, 100, 150, 200, 300, 400]), rng.randint(1, 4)
        fine = all(math.ceil(target / qps) == -(-(Fraction(str(target)) / Fraction(str(qps))) // 1)
                   for _, qps, _, _ in types)  # 浮点除法与精确值不一致的入参跳过
        if fine:
            return types, target, limit, min_count


S54 = ([["small", 50, 80, 4], ["medium", 120, 150, 9], ["large", 300, 260, 20]], 500, 200, 2)

P54 = problem(
    title="推理实例选型与成本测算",
    theme="capacity", ability="智能系统设计", knowledge="智能系统监控与容量规划",
    fn="pick_instance", params=["types", "target_qps", "p95_limit", "min_count"],
    imports="import math",
    description=r'''
    ### 一、题目描述

    数字人推理服务要部署到云上。候选机型 `types` 每项是 `[名称, 单机每秒请求数, 单机P95延迟毫秒, 每小时费用]`。给定目标吞吐 `target_qps`、延迟上限 `p95_limit`、最少副本数 `min_count`，请选出总费用最低的方案：

    1. 先排除 P95 延迟**超过** `p95_limit` 的机型；
    2. 对剩下的每种机型，副本数 = `max(min_count, ceil(target_qps ÷ 单机每秒请求数))`；
    3. 总费用 = 副本数 × 每小时费用，用 `round(x, 2)` 保留 2 位小数；
    4. 取总费用最小的机型；并列时取名称字典序小的。

    返回 `[名称, 副本数, 总费用]`；没有任何机型满足延迟要求时返回 `["NONE", 0, 0.0]`。

    ### 二、输入说明

    - `types` 不超过 200 项，名称互不相同，可以为空；单机每秒请求数为正数（整数或 0.25 的整数倍），P95 延迟为正整数，每小时费用为正数且是 0.25 的整数倍；
    - `target_qps` 为正数，`p95_limit` 为正整数，`min_count ≥ 1`。用例中的除法不受浮点误差影响。

    ### 三、示例

    ```text
    types       = [["small", 50, 80, 4], ["medium", 120, 150, 9],
                   ["large", 300, 260, 20]]
    target_qps  = 500，p95_limit = 200，min_count = 2
    返回        = ["small", 10, 40.0]
    ```

    `large` 的延迟 260 超过上限，排除。`small` 需要 ceil(500 ÷ 50) = 10 个副本，费用 40；`medium` 需要 ceil(500 ÷ 120) = 5 个副本，费用 45。选费用更低的 `small`。
    ''',
    sample=[*S54],
    cases=lambda: [
        [*S54],
        [[["big", 1000, 100, 50]], 100, 200, 3],
        [[["a", 10, 300, 1]], 100, 200, 1],
        [[], 100, 200, 1],
        [[["beta", 100, 100, 5], ["alpha", 100, 100, 5]], 100, 200, 1],
        [[["a", 30, 100, 1]], 100, 200, 1],
        [[["fast", 200, 90, 30], ["cheap", 150, 180, 12]], 300, 200, 1],
        [[["a", 2.5, 100, 0.75], ["b", 4, 100, 1.25]], 10, 100, 1],
        _fuzz54(random.Random(541)),
        [[[f"t{i:03d}", 1 + i, 100 + i, 1 + (i % 20) * 0.25] for i in range(200)], 1000, 400, 2],
    ],
    reference=pick_instance,
    alt=_alt54,
    fuzz=_fuzz54,
    negatives={
        "没有排除超过延迟上限的机型": _neg54_latency,
        "没有考虑最少副本数": _neg54_min,
        "副本数向下取整": _neg54_floor,
        "选吞吐最高的机型而不是费用最低的": _neg54_fastest,
        "直接取第一个满足延迟要求的机型": _neg54_first,
    },
    explanation=r'''
    这是容量规划里最常见的一类选型题：先筛掉不满足硬性约束（延迟）的选项，再逐个算出满足吞吐所需的数量和总费用，最后比价。副本数要向上取整，因为少一个副本就扛不住目标流量；同时不能低于最少副本数，那是为高可用留的余量。

    易错点：延迟是硬约束，副本再多也解决不了单机延迟超标；比较的是总费用而不是单价或单机性能；并列时按名称字典序取，保证结果唯一。
    ''',
)


PROBLEMS = [P51, P52, P53, P54]


# ---------------------------------------------------------------- 55 多意图话术的路由决策
def route_intents(utts, thresholds):
    routes = []
    counts = {"AUTO": 0, "REJECT": 0, "HUMAN": 0}
    for utt_id, intents in utts:
        top_intent, top_score = max(intents, key=lambda pair: pair[1])  # 并列时 max 保留先出现的
        if top_score >= thresholds.get(top_intent, 0.5):
            route = "REJECT" if top_intent == "REJECT" else "AUTO"
        else:
            reject_score = next((score for intent, score in intents if intent == "REJECT"), None)
            fallback = reject_score is not None and reject_score >= thresholds.get("REJECT", 0.5)
            route = "REJECT" if fallback else "HUMAN"
        routes.append([utt_id, route])
        counts[route] += 1
    return [routes, counts]


def _alt55(utts, thresholds):
    result = []
    tally = {"AUTO": [], "REJECT": [], "HUMAN": []}
    for utt_id, intents in utts:
        best = None
        for intent, score in intents:  # 严格大于才替换，保留先出现的
            if best is None or score > best[1]:
                best = (intent, score)
        intent, score = best
        limit = thresholds[intent] if intent in thresholds else 0.5
        reject_ok = False
        for name, value in intents:
            if name == "REJECT":
                reject_ok = value >= (thresholds["REJECT"] if "REJECT" in thresholds else 0.5)
        if score >= limit:
            route = "REJECT" if intent == "REJECT" else "AUTO"
        elif reject_ok:
            route = "REJECT"
        else:
            route = "HUMAN"
        result.append([utt_id, route])
        tally[route].append(utt_id)
    return [result, {name: len(ids) for name, ids in tally.items()}]


def _wrong55(utts, thresholds, use_top, global_limit, strict, skip_fallback, any_pass):
    routes = []
    counts = {"AUTO": 0, "REJECT": 0, "HUMAN": 0}
    for utt_id, intents in utts:
        top_intent, top_score = max(intents, key=lambda pair: pair[1]) if use_top else intents[0]
        limit = 0.5 if global_limit else thresholds.get(top_intent, 0.5)
        passed = top_score > limit if strict else top_score >= limit
        reject_score = next((score for intent, score in intents if intent == "REJECT"), None)
        reject_limit = 0.5 if global_limit else thresholds.get("REJECT", 0.5)
        reject_passed = reject_score is not None and (reject_score > reject_limit if strict else reject_score >= reject_limit)
        if any_pass:  # 任何一个意图过线就自动应答
            passed = any(score >= thresholds.get(intent, 0.5) for intent, score in intents if intent != "REJECT")
        if passed:
            route = "REJECT" if top_intent == "REJECT" else "AUTO"
        elif reject_passed and not skip_fallback:
            route = "REJECT"
        else:
            route = "HUMAN"
        routes.append([utt_id, route])
        counts[route] += 1
    return [routes, counts]


def _neg55_first(utts, thresholds):
    return _wrong55(utts, thresholds, False, False, False, False, False)


def _neg55_global(utts, thresholds):
    return _wrong55(utts, thresholds, True, True, False, False, False)


def _neg55_strict(utts, thresholds):
    return _wrong55(utts, thresholds, True, False, True, False, False)


def _neg55_no_fallback(utts, thresholds):
    return _wrong55(utts, thresholds, True, False, False, True, False)


def _neg55_any(utts, thresholds):
    return _wrong55(utts, thresholds, True, False, False, False, True)


SCORES = [0.05, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 0.95]


def _rand55(rng, count):
    names = ["QUERY_ORDER", "CHANGE_ORDER", "COMPLAIN", "CHAT", "OTHER"]
    thresholds = {name: rng.choice(SCORES) for name in names if rng.random() < 0.8}
    if rng.random() < 0.7:
        thresholds["REJECT"] = rng.choice(SCORES)
    utts = []
    for i in range(count):
        intents = [[name, rng.choice(SCORES)] for name in rng.sample(names, rng.randint(1, 3))]
        if rng.random() < 0.6:
            intents.insert(rng.randint(0, len(intents)), ["REJECT", rng.choice(SCORES)])
        utts.append([f"u{i:04d}", intents])
    return utts, thresholds


S55 = ([["u1", [["QUERY_ORDER", 0.92], ["REJECT", 0.05]]],
        ["u2", [["COMPLAIN", 0.61], ["REJECT", 0.3]]],
        ["u3", [["OTHER", 0.4], ["REJECT", 0.55]]]],
       {"QUERY_ORDER": 0.8, "COMPLAIN": 0.7, "OTHER": 0.6, "REJECT": 0.5})

P55 = problem(
    title="多意图话术的路由决策",
    theme="routing", ability="智能系统设计", knowledge="人机交互流程设计",
    fn="route_intents", params=["utts", "thresholds"],
    description=r'''
    ### 一、题目描述

    数字人客服的每条话术经过意图分类后，得到若干个 `[意图, 置信度]`。不同意图对「能不能自动处理」的要求不一样，所以每个意图有自己的置信度阈值 `thresholds`（意图不在字典里时按 0.5 处理）。对每条话术：

    1. 找出置信度最高的意图作为首选意图，并列时取列表中靠前的；
    2. 首选意图的置信度**不低于**它的阈值：首选意图是 `"REJECT"`（无关话术）时路由为 `"REJECT"`，否则路由为 `"AUTO"`（数字人自动应答）；
    3. 否则，如果话术里有 `"REJECT"` 意图且它的置信度不低于 `"REJECT"` 的阈值，路由为 `"REJECT"`；
    4. 否则路由为 `"HUMAN"`（转人工）。

    返回 `[路由结果, 统计]`：路由结果是 `[[话术id, 路由], ...]`，顺序与输入一致；统计是 `{"AUTO": 数量, "REJECT": 数量, "HUMAN": 数量}`。

    ### 二、输入说明

    - `utts` 每项 `[话术id, [[意图, 置信度], ...]]`，不超过 3000 条；意图列表至少有 1 项，同一话术内意图不重复；话术 id 互不相同；
    - 置信度和阈值都是 0 到 1 之间的数；`thresholds` 可以为空。

    ### 三、示例

    ```text
    utts = [["u1", [["QUERY_ORDER", 0.92], ["REJECT", 0.05]]],
            ["u2", [["COMPLAIN", 0.61], ["REJECT", 0.3]]],
            ["u3", [["OTHER", 0.4], ["REJECT", 0.55]]]]
    thresholds = {"QUERY_ORDER": 0.8, "COMPLAIN": 0.7, "OTHER": 0.6, "REJECT": 0.5}
    返回 = [[["u1", "AUTO"], ["u2", "HUMAN"], ["u3", "REJECT"]],
            {"AUTO": 1, "REJECT": 1, "HUMAN": 1}]
    ```

    `u1` 的首选意图 0.92 达到阈值 0.8，自动应答。`u2` 的首选意图 `COMPLAIN` 没达到 0.7，`REJECT` 的 0.3 也没达到 0.5，转人工。`u3` 的首选意图就是 `REJECT`，0.55 达到阈值，直接拒识。
    ''',
    sample=[*S55],
    cases=lambda: [
        [*S55],
        [[["u1", [["A", 0.3], ["B", 0.9]]]], {"A": 0.8, "B": 0.8}],
        [[["u1", [["B", 0.6], ["A", 0.6]]], ["u2", [["A", 0.6], ["B", 0.6]]]], {"A": 0.5, "B": 0.7}],
        [[["u1", [["A", 0.8]]]], {"A": 0.8}],
        [[["u1", [["COMPLAIN", 0.65], ["REJECT", 0.45]]], ["u2", [["COMPLAIN", 0.65], ["REJECT", 0.2]]]],
         {"COMPLAIN": 0.7, "REJECT": 0.4}],
        [[["u1", [["NEW_INTENT", 0.5]]], ["u2", [["X", 0.2], ["REJECT", 0.6]]]], {}],
        [[], {}],
        [[["u1", [["REJECT", 0.45], ["A", 0.3]]]], {"REJECT": 0.6, "A": 0.2}],
        _rand55(random.Random(551), 500),
        _rand55(random.Random(552), 3000),
    ],
    reference=route_intents,
    alt=_alt55,
    fuzz=lambda rng: _rand55(rng, rng.randint(0, 15)),
    negatives={
        "取列表里第一个意图而不是置信度最高的": _neg55_first,
        "所有意图都用统一的阈值 0.5": _neg55_global,
        "置信度严格大于阈值才算通过": _neg55_strict,
        "首选意图没过线就直接转人工，没有 REJECT 兜底": _neg55_no_fallback,
        "任何一个意图过线就自动应答": _neg55_any,
    },
    explanation=r'''
    逐条话术处理。先用「打擂台」的办法找最高置信度：遍历时只有严格更大才替换，并列就自然保留了靠前的那个。然后按「首选意图过线 → REJECT 兜底 → 转人工」三级判断。

    易错点：每个意图的阈值不同，要用 `thresholds.get(意图, 0.5)` 取；判断用的是「不低于」；`REJECT` 作为首选意图过线时路由是拒识而不是自动应答。这条规则背后的业务含义是：宁可多拒识或多转人工，也不要让数字人答非所问。
    ''',
)


# ---------------------------------------------------------------- 56 分层配额进度盘点
def quota_progress(quotas, completed, available):
    need, shortfall, effective = [], 0, 0
    for stratum in sorted(quotas):
        target = quotas[stratum]
        done = min(completed.get(stratum, 0), target)  # 超出目标的部分不算
        remaining = target - done
        need.append([stratum, remaining])
        shortfall += max(0, remaining - available.get(stratum, 0))
        effective += done
    total = sum(quotas.values())
    return {"need": need, "shortfall": shortfall, "rate": round(effective / total, 4)}


def _alt56(quotas, completed, available):
    names = sorted(quotas)
    done = [min(completed.get(name, 0), quotas[name]) for name in names]
    remaining = [quotas[name] - value for name, value in zip(names, done)]
    gaps = [max(0, quotas[name] - available.get(name, 0) - value) for name, value in zip(names, done)]
    rate = Fraction(sum(done), sum(quotas[name] for name in names))
    return {"need": [list(pair) for pair in zip(names, remaining)],
            "shortfall": sum(gaps), "rate": round(float(rate), 4)}


def _wrong56(quotas, completed, available, cap_done, cap_short, remaining_is_short):
    need, shortfall, done_sum = [], 0, 0
    for stratum in sorted(quotas):
        target = quotas[stratum]
        done = min(completed.get(stratum, 0), target) if cap_done else completed.get(stratum, 0)
        remaining = target - done
        need.append([stratum, remaining])
        if remaining_is_short:
            shortfall += remaining
        else:
            gap = remaining - available.get(stratum, 0)
            shortfall += max(0, gap) if cap_short else gap
        done_sum += done
    return {"need": need, "shortfall": shortfall, "rate": round(done_sum / sum(quotas.values()), 4)}


def _neg56_uncapped(quotas, completed, available):
    # 超出目标的份数也计入完成率，还需出现负数
    return _wrong56(quotas, completed, available, cap_done=False, cap_short=True, remaining_is_short=False)


def _neg56_signed(quotas, completed, available):
    # 缺口没有逐层截断为 0，一层抽得多的结余抵了另一层的缺口
    return _wrong56(quotas, completed, available, cap_done=True, cap_short=False, remaining_is_short=False)


def _neg56_remaining(quotas, completed, available):
    # 把「还需」直接当成缺口，没有扣掉还能抽的数量
    return _wrong56(quotas, completed, available, cap_done=True, cap_short=True, remaining_is_short=True)


def _rand56(rng, count):
    names = [f"L{i:04d}" for i in range(count)]
    quotas = {name: rng.randint(0, 50) for name in names}
    if not any(quotas.values()):
        quotas[names[0]] = 1
    completed = {name: rng.randint(0, 80) for name in names if rng.random() < 0.8}
    available = {name: rng.randint(0, 40) for name in names if rng.random() < 0.7}
    return quotas, completed, available


def _fuzz56(rng):
    while True:
        quotas, completed, available = _rand56(rng, rng.randint(1, 10))
        effective = sum(min(completed.get(name, 0), target) for name, target in quotas.items())
        # 完成率恰好是 x.xxxx5 时 round(x, 4) 有歧义，随机用例避开
        if (Fraction(effective, sum(quotas.values())) * 10000).denominator != 2:
            return quotas, completed, available


S56 = ({"A": 100, "B": 50, "C": 30}, {"A": 80, "B": 50, "C": 10}, {"A": 30, "B": 10, "C": 15})

P56 = problem(
    title="评测集分层配额的进度盘点",
    theme="sampling", ability="智能训练", knowledge="评测集构建与分层抽样",
    fn="quota_progress", params=["quotas", "completed", "available"],
    description=r'''
    ### 一、题目描述

    评测集按人群分层，每层有目标份数 `quotas`。现在盘点进度：`completed` 是各层已完成的份数，`available` 是各层还能抽取的份数（字典里没有的层按 0 计）。请计算：

    - **还需**：每层的 `还需 = 目标 − min(已完成, 目标)`，已完成超过目标时还需为 0；
    - **缺口**：还需超过可抽数量的部分，逐层计算后求和，即 `sum(max(0, 还需 − 可抽))`；
    - **有效完成率**：`sum(min(已完成, 目标)) ÷ sum(目标)`，超出目标的部分不计入，也不能拿去补别的层，用 `round(x, 4)` 保留 4 位小数。

    返回字典：

    ```text
    {
      "need":      [[层名, 还需], ...]，按层名字典序升序，包含全部层,
      "shortfall": 缺口,
      "rate":      有效完成率
    }
    ```

    ### 二、输入说明

    - `quotas` 的值为非负整数，至少有一层大于 0，层数不超过 2000；
    - `completed`、`available` 的值为非负整数，可以缺少某些层，也可以多出 `quotas` 里没有的层（忽略）。

    ### 三、示例

    ```text
    quotas    = {"A": 100, "B": 50, "C": 30}
    completed = {"A": 80, "B": 50, "C": 10}
    available = {"A": 30, "B": 10, "C": 15}
    返回      = {"need": [["A", 20], ["B", 0], ["C", 20]],
                  "shortfall": 5, "rate": 0.7778}
    ```

    C 层还差 20 份，但只能再抽 15 份，缺口是 5；A 层还差 20 份，能抽 30 份，没有缺口。有效完成 80 + 50 + 10 = 140 份，目标合计 180 份，140 ÷ 180 ≈ 0.7778。
    ''',
    sample=[*S56],
    cases=lambda: [
        [*S56],
        [{"A": 50, "B": 50}, {"A": 80, "B": 20}, {"A": 0, "B": 40}],
        [{"A": 10, "B": 20}, {}, {}],
        [{"A": 10}, {"A": 4}, {"A": 3}],
        [{"A": 10, "B": 20}, {"A": 10, "B": 20}, {}],
        [{"A": 3, "B": 3, "C": 3}, {"A": 1, "B": 1, "C": 0}, {"A": 5, "B": 5, "C": 5}],
        [{"A": 10}, {"A": 5, "Z": 100}, {"Z": 7}],
        [{"A": 0, "B": 8}, {"A": 3}, {}],
        _fuzz56(random.Random(561)),
        _rand56(random.Random(562), 2000),
    ],
    reference=quota_progress,
    alt=_alt56,
    fuzz=_fuzz56,
    negatives={
        "超出目标的份数也计入完成率": _neg56_uncapped,
        "缺口没有逐层截断为 0": _neg56_signed,
        "把还需直接当成缺口": _neg56_remaining,
    },
    explanation=r'''
    每一层独立计算，三个量互不串门：还需 = 目标 − 有效完成（已完成超过目标时按目标算）；缺口 = 还需 − 可抽，并且不能是负数；有效完成率只认每层封顶后的完成量。

    易错点：某层多抽的份数不能拿去补别的层的缺口，所以完成率要按层封顶、缺口要逐层截断为 0；字典里缺少的层要按 0 处理，多出来的层直接忽略。分层抽样的意义就在于每层的比例是事先定好的，一层超标并不能替代另一层。
    ''',
)


# ---------------------------------------------------------------- 57 告警质量复盘
def alert_quality(alerts, outcomes, acks, ack_sla_sec):
    real = [alert_id for alert_id, _, _ in alerts if outcomes.get(alert_id) == "REAL"]
    noise = sum(1 for alert_id, _, _ in alerts if outcomes.get(alert_id) == "FALSE")
    latencies = sorted(acks[alert_id] - ts for alert_id, _, ts in alerts if alert_id in acks)
    if not latencies:
        median = 0.0
    elif len(latencies) % 2:
        median = float(latencies[len(latencies) // 2])
    else:
        median = (latencies[len(latencies) // 2 - 1] + latencies[len(latencies) // 2]) / 2
    judged = len(real) + noise
    return {
        "precision": round(len(real) / judged, 4) if judged else 0.0,
        "missed": sum(1 for alert_id in real if alert_id not in acks),
        "noise": noise,
        "median_ack_sec": round(median, 2),
        "sla_breach": sum(1 for value in latencies if value > ack_sla_sec),
    }


def _alt57(alerts, outcomes, acks, ack_sla_sec):
    judged = [(alert_id, ts) for alert_id, _, ts in alerts if alert_id in outcomes]
    real = [alert_id for alert_id, _ in judged if outcomes[alert_id] == "REAL"]
    false = [alert_id for alert_id, _ in judged if outcomes[alert_id] != "REAL"]
    latencies = [acks[alert_id] - ts for alert_id, _, ts in alerts if alert_id in acks]
    precision = Fraction(len(real), len(judged)) if judged else Fraction(0)
    return {
        "precision": round(float(precision), 4),
        "missed": len([alert_id for alert_id in real if alert_id not in acks]),
        "noise": len(false),
        "median_ack_sec": round(float(statistics.median(latencies)), 2) if latencies else 0.0,
        "sla_breach": len([value for value in latencies if value > ack_sla_sec]),
    }


def _wrong57(alerts, outcomes, acks, ack_sla_sec, unjudged_as_false, lower_middle, unacked_is_missed, breach_ge):
    real = [alert_id for alert_id, _, _ in alerts if outcomes.get(alert_id) == "REAL"]
    false = [alert_id for alert_id, _, _ in alerts if outcomes.get(alert_id) == "FALSE"]
    denominator = len(alerts) if unjudged_as_false else len(real) + len(false)
    latencies = sorted(acks[alert_id] - ts for alert_id, _, ts in alerts if alert_id in acks)
    if not latencies:
        median = 0.0
    elif len(latencies) % 2:
        median = float(latencies[len(latencies) // 2])
    else:
        half = len(latencies) // 2
        median = float(latencies[half - 1]) if lower_middle else (latencies[half - 1] + latencies[half]) / 2
    missed = (sum(1 for alert_id, _, _ in alerts if alert_id not in acks) if unacked_is_missed
              else sum(1 for alert_id in real if alert_id not in acks))
    edge = ack_sla_sec if breach_ge else ack_sla_sec + 1  # 「>= 时限」等价于「> 时限 − 1」
    return {
        "precision": round(len(real) / denominator, 4) if denominator else 0.0,
        "missed": missed,
        "noise": len(false),
        "median_ack_sec": round(median, 2),
        "sla_breach": sum(1 for value in latencies if value >= edge),
    }


def _neg57_unjudged(alerts, outcomes, acks, ack_sla_sec):
    # 没有定性的告警当成误报算进分母
    return _wrong57(alerts, outcomes, acks, ack_sla_sec, True, False, False, False)


def _neg57_lower(alerts, outcomes, acks, ack_sla_sec):
    # 偶数个时直接取偏小的中间值
    return _wrong57(alerts, outcomes, acks, ack_sla_sec, False, True, False, False)


def _neg57_unacked(alerts, outcomes, acks, ack_sla_sec):
    # 漏认领统计的是所有没人认领的告警，没有只看真问题
    return _wrong57(alerts, outcomes, acks, ack_sla_sec, False, False, True, False)


def _neg57_ge(alerts, outcomes, acks, ack_sla_sec):
    # 用时等于时限也算超时
    return _wrong57(alerts, outcomes, acks, ack_sla_sec, False, False, False, True)


def _rand57(rng, count):
    alerts = [[f"a{i:05d}", f"svc{rng.randrange(5)}", rng.randrange(3600)] for i in range(count)]
    outcomes = {row[0]: rng.choice(["REAL", "REAL", "FALSE"]) for row in alerts if rng.random() < 0.7}
    acks = {row[0]: row[2] + rng.randint(0, 300) for row in alerts if rng.random() < 0.6}
    return alerts, outcomes, acks, rng.choice([30, 60, 120, 180])


def _fuzz57(rng):
    while True:
        args = _rand57(rng, rng.randint(0, 30))
        judged = list(args[1].values())
        # 精确率恰好是 x.xxxx5 时 round(x, 4) 有歧义，随机用例避开
        if not judged or (Fraction(judged.count("REAL"), len(judged)) * 10000).denominator != 2:
            return args


S57 = ([["a1", "tts", 100], ["a2", "tts", 130], ["a3", "asr", 160], ["a4", "nlu", 200]],
       {"a1": "REAL", "a2": "FALSE", "a3": "REAL"},
       {"a1": 145, "a2": 140, "a3": 250},
       60)

P57 = problem(
    title="告警质量复盘",
    theme="alerts", ability="智能系统设计", knowledge="智能系统监控与告警治理",
    fn="alert_quality", params=["alerts", "outcomes", "acks", "ack_sla_sec"],
    description=r'''
    ### 一、题目描述

    值班结束后要复盘告警质量。`alerts` 每项 `[告警id, 服务, 触发时间秒]`；`outcomes` 记录告警的定性：`"REAL"`（真问题）或 `"FALSE"`（误报），没有定性的告警不参与精确率计算；`acks` 记录认领时间（秒）。请统计：

    - `precision`：已定性的告警中真问题的占比，用 `round(x, 4)` 保留 4 位小数；没有已定性的告警时为 0.0；
    - `missed`：真问题中没有任何认领记录的数量（漏认领）；
    - `noise`：误报数量；
    - `median_ack_sec`：有认领记录的告警的认领用时（认领时间 − 触发时间）的中位数，偶数个时取中间两个的平均值，用 `round(x, 2)` 保留 2 位小数；没有认领记录时为 0.0；
    - `sla_breach`：认领用时**超过** `ack_sla_sec` 的数量。

    返回 `{"precision": …, "missed": …, "noise": …, "median_ack_sec": …, "sla_breach": …}`。

    ### 二、输入说明

    - `alerts` 不超过 8000 条，告警 id 互不相同；触发时间、认领时间、`ack_sla_sec` 都是非负整数，认领时间不早于触发时间；
    - `outcomes`、`acks` 只包含 `alerts` 里出现过的告警 id，可以为空。

    ### 三、示例

    ```text
    alerts  = [["a1", "tts", 100], ["a2", "tts", 130],
               ["a3", "asr", 160], ["a4", "nlu", 200]]
    outcomes = {"a1": "REAL", "a2": "FALSE", "a3": "REAL"}
    acks    = {"a1": 145, "a2": 140, "a3": 250}
    ack_sla_sec = 60
    返回    = {"precision": 0.6667, "missed": 0, "noise": 1,
               "median_ack_sec": 45.0, "sla_breach": 1}
    ```

    已定性的 3 条里 2 条是真问题，精确率 2 ÷ 3 ≈ 0.6667。认领用时分别是 45、10、90 秒，中位数是 45。90 秒超过了 60 秒的时限。`a4` 没有定性，不影响精确率。
    ''',
    sample=[*S57],
    cases=lambda: [
        [*S57],
        [[["a1", "s", 0], ["a2", "s", 0], ["a3", "s", 0], ["a4", "s", 0]],
         {"a1": "REAL", "a2": "REAL", "a3": "FALSE", "a4": "FALSE"},
         {"a1": 10, "a2": 20, "a3": 31, "a4": 40}, 100],
        [[["a1", "s", 0], ["a2", "s", 5]], {}, {"a1": 30}, 60],
        [[["a1", "s", 0], ["a2", "s", 0]], {"a1": "REAL", "a2": "FALSE"}, {}, 60],
        [[["a1", "s", 0], ["a2", "s", 0], ["a3", "s", 0]], {"a1": "REAL", "a2": "FALSE"}, {"a3": 200}, 60],
        [[["a1", "s", 0], ["a2", "s", 0], ["a3", "s", 0], ["a4", "s", 0], ["a5", "s", 0]],
         {"a1": "REAL", "a2": "REAL", "a3": "REAL"}, {}, 60],
        [[], {}, {}, 60],
        [[["a1", "s", 100], ["a2", "s", 100], ["a3", "s", 100]], {"a1": "REAL", "a2": "FALSE", "a3": "FALSE"},
         {"a1": 160, "a2": 161, "a3": 159}, 60],
        _fuzz57(random.Random(571)),
        _rand57(random.Random(572), 8000),
    ],
    reference=alert_quality,
    alt=_alt57,
    fuzz=_fuzz57,
    negatives={
        "没有定性的告警也算进精确率的分母": _neg57_unjudged,
        "偶数个用时直接取偏小的中间值": _neg57_lower,
        "漏认领统计了所有没人认领的告警": _neg57_unacked,
        "用时等于时限也算超时": _neg57_ge,
    },
    explanation=r'''
    复盘的关键是分清统计口径。精确率只看「已定性」的告警，所以分子是真问题数、分母是真问题数加误报数，没有定性的不进分母；中位数要先把用时排序，偶数个时取中间两个的平均；超时统计用严格大于。

    易错点：漏认领只统计真问题，误报没人认领不算问题；没有已定性的告警、没有认领记录时，相应的值取 0.0 而不是报错。告警治理的常用目标就是提高精确率、降低噪声，同时不让真问题漏认领。
    ''',
)


PROBLEMS = [P51, P52, P53, P54, P55, P56, P57]
