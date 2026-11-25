"""第 2 套编程题（51–57）。字段含义见 scripts/finals/build.py 的文件说明。

多参数用例统一写成元组再展开（sample=[*S51]），避免手数括号出错。
"""
import math
import random
from collections import Counter, defaultdict
from fractions import Fraction

import common


def problem(**spec):
    return spec


# ---------------------------------------------------------------- 51 关键环节与时差
def critical_stages(names, durations, deps):
    n = len(names)
    index = {name: i for i, name in enumerate(names)}
    succ = [[] for _ in range(n)]
    pred = [[] for _ in range(n)]
    for a, b in deps:
        succ[index[a]].append(index[b])
        pred[index[b]].append(index[a])
    indeg = [len(p) for p in pred]
    stack = [i for i in range(n) if indeg[i] == 0]
    topo = []
    while stack:
        v = stack.pop()
        topo.append(v)
        for w in succ[v]:
            indeg[w] -= 1
            if indeg[w] == 0:
                stack.append(w)
    earliest = [0] * n
    for v in topo:
        earliest[v] = max((earliest[p] + durations[p] for p in pred[v]), default=0)
    makespan = max(earliest[v] + durations[v] for v in range(n))
    latest = [0] * n  # 最晚开始时间：再晚就会延误总工期
    for v in reversed(topo):
        latest[v] = min((latest[w] for w in succ[v]), default=makespan) - durations[v]
    slack = {name: latest[i] - earliest[i] for i, name in enumerate(names)}
    critical = [name for i, name in enumerate(names) if slack[name] == 0]
    return [makespan, critical, slack]


def _alt51(names, durations, deps):
    # 换一种推导：经过 v 的最长路径 = (以 v 结尾的最长路径) + (从 v 出发的最长路径) − durations[v]
    n = len(names)
    succ = [[] for _ in range(n)]
    has_pred = [False] * n
    for a, b in deps:
        succ[names.index(a)].append(names.index(b))
        has_pred[names.index(b)] = True

    def longest_to(v):  # 以 v 结尾
        best = 0
        for p in range(n):
            if v in succ[p]:
                best = max(best, longest_to(p))
        return best + durations[v]

    def longest_from(v):  # 从 v 出发
        return durations[v] + max((longest_from(w) for w in succ[v]), default=0)

    makespan = max(longest_to(v) for v in range(n))
    slack = {name: makespan - (longest_to(i) + longest_from(i) - durations[i]) for i, name in enumerate(names)}
    return [makespan, [name for name in names if slack[name] == 0], slack]


def _neg51_free_float(names, durations, deps):
    makespan, _, _ = critical_stages(names, durations, deps)
    n = len(names)
    succ = [[] for _ in range(n)]
    for a, b in deps:
        succ[names.index(a)].append(names.index(b))
    earliest = [0] * n
    # 用「紧后工序最早开始 − 本工序最早结束」当作时差（这其实是自由时差）
    for v in range(n):
        preds = [p for p in range(n) if v in succ[p]]
        earliest[v] = max((earliest[p] + durations[p] for p in preds), default=0)
    slack = {}
    for v in range(n):
        free = min((earliest[w] for w in succ[v]), default=makespan) - earliest[v] - durations[v]
        slack[names[v]] = free
    return [makespan, [names[v] for v in range(n) if slack[names[v]] == 0], slack]


def _neg51_alphabetical(names, durations, deps):
    makespan, _, slack = critical_stages(names, durations, deps)
    return [makespan, sorted(name for name in names if slack[name] == 0), slack]


def _neg51_serial(names, durations, deps):
    makespan, _, _ = critical_stages(names, durations, deps)
    start, slack = 0, {}
    for name, d in zip(names, durations):
        slack[name] = makespan - start - d
        start += d
    return [makespan, [name for name in names if slack[name] == 0], slack]


S51 = (["采集", "清洗", "标注", "质检"], [2, 3, 4, 1],
       [["采集", "清洗"], ["采集", "标注"], ["清洗", "质检"], ["标注", "质检"]])

P51 = problem(
    title="标注流水线时序与关键环节识别",
    theme="critical_path", ability="业务分析", knowledge="业务流程设计与关键路径测算",
    fn="critical_stages", params=["names", "durations", "deps"],
    description=r'''
    ### 一、题目描述

    一条数据标注流水线由 n 个环节组成，环节之间有先后依赖，互不依赖的环节可以并行。训练师要判断哪些环节「一天都不能拖」。

    请为每个环节计算最早开始时间 ES 和最晚开始时间 LS（在不延误总工期的前提下），时差 = LS − ES。返回：

    ```text
    [makespan, [时差为 0 的环节名称, ...], {环节名称: 时差, ...}]
    ```

    1. `makespan`：整条流水线的完工时间；
    2. 第二项是时差为 0 的环节（关键环节），按它们在 `names` 中的下标升序排列；
    3. 第三项是每个环节的时差。

    ### 二、输入说明

    - `names`：长度为 n（1 ≤ n ≤ 2000）的字符串列表，环节名称互不相同，顺序不保证是拓扑序；
    - `durations`：与 `names` 等长的整数列表，第 i 个环节耗时 `durations[i]`（1 ≤ durations[i] ≤ 10^4）；
    - `deps`：依赖列表，每项 `[a, b]` 表示 a 完成之后 b 才能开始。保证无环、无重复依赖。

    ### 三、示例

    ```text
    names      = ["采集", "清洗", "标注", "质检"]
    durations  = [2, 3, 4, 1]
    deps       = [["采集","清洗"],["采集","标注"],["清洗","质检"],["标注","质检"]]
    返回       = [7, ["采集", "标注", "质检"],
                   {"采集": 0, "清洗": 1, "标注": 0, "质检": 0}]
    ```

    `采集 → 标注 → 质检` 耗时 7，是关键路径；`清洗` 做完后要等 `标注`（4 > 3）才能开始质检，所以它有 1 个单位的时差。
    ''',
    sample=[*S51],
    cases=lambda: [
        [*S51],
        [["only"], [5], []],
        [["a", "b", "c"], [3, 5, 2], []],
        [["x", "y", "z"], [1, 2, 3], [["x", "y"], ["y", "z"]]],
        [["a", "b", "c", "d"], [1, 1, 1, 5], [["a", "b"], ["b", "c"], ["d", "c"]]],
        [["zeta", "alpha", "mid"], [1, 4, 2], [["zeta", "alpha"], ["alpha", "mid"]]],
        [["s", "l1", "l2", "r1", "r2", "t"], [1, 2, 2, 5, 1, 1],
         [["s", "l1"], ["s", "r1"], ["l1", "l2"], ["r1", "r2"], ["l2", "t"], ["r2", "t"]]],
        list(common.rand_dag(random.Random(201), 9, 0.6)),
        list(common.rand_dag(random.Random(202), 300, 0.2)),
        list(common.rand_dag(random.Random(203), 2000, 0.05)),
    ],
    reference=critical_stages,
    alt=_alt51,
    alt_case_ok=lambda args: len(args[0]) <= 12,
    fuzz=lambda rng: list(common.rand_dag(rng, rng.randint(1, 8), rng.uniform(0.1, 0.9))),
    negatives={
        "把自由时差（紧后工序最早开始 − 本工序最早结束）当成了总时差": _neg51_free_float,
        "关键环节按名称字典序而不是下标排序": _neg51_alphabetical,
        "按输入顺序串行累加得到最早开始时间": _neg51_serial,
    },
    explanation=r'''
    做法是「正推 + 逆推」：

    1. 按拓扑序正推最早开始时间：`ES[v] = max(ES[前驱] + 前驱耗时)`，没有前驱则为 0；完工时间 = `max(ES[v] + durations[v])`；
    2. 按拓扑逆序倒推最晚开始时间：`LS[v] = min(LS[后继]) − durations[v]`，没有后继时取「完工时间 − 耗时」；
    3. 时差 = `LS − ES`，等于 0 的环节就是关键环节。

    易错点：把「紧后工序最早开始 − 本工序最早结束」（自由时差）当成时差，会漏掉上游环节被下游瓶颈「牵连」的那部分机动时间；输出顺序要按 `names` 的下标，而不是按名称排序。
    ''',
)


# ---------------------------------------------------------------- 52 低质量标注员剔除
def adjudicate(votes, gold, min_accuracy):
    stats = {}
    for sample, annotator, label in votes:
        if sample in gold:
            hit, total = stats.get(annotator, (0, 0))
            stats[annotator] = (hit + (label == gold[sample]), total + 1)
    reliable = {a: hit / total >= min_accuracy for a, (hit, total) in stats.items()}
    tally, order = {}, []
    for sample, annotator, label in votes:
        if sample in gold:
            continue
        if sample not in tally:
            tally[sample] = {}
            order.append(sample)
        if annotator in reliable and not reliable[annotator]:
            continue
        counts = tally[sample]
        counts[label] = counts.get(label, 0) + 1
    result = []
    for sample in sorted(order):
        counts = tally[sample]
        if not counts:  # 有效票全被作废：同样转人工复核
            result.append([sample, "REVIEW"])
            continue
        top = max(counts.values())
        winners = [label for label, c in counts.items() if c == top]
        result.append([sample, winners[0] if len(winners) == 1 else "REVIEW"])
    return result


def _alt52(votes, gold, min_accuracy):
    by_person = defaultdict(lambda: [0, 0])
    for sample, who, label in votes:
        if sample in gold:
            by_person[who][1] += 1
            by_person[who][0] += label == gold[sample]
    bad = {who for who, (hit, total) in by_person.items() if hit / total < min_accuracy}
    out = []
    for sid in sorted({v[0] for v in votes} - set(gold)):
        counter = Counter(label for sample, who, label in votes if sample == sid and who not in bad)
        if not counter:
            out.append([sid, "REVIEW"])
            continue
        best = max(counter.values())
        top = [label for label, c in counter.items() if c == best]
        out.append([sid, top[0] if len(top) == 1 else "REVIEW"])
    return out


def _neg52_keep_all(votes, gold, min_accuracy):
    return adjudicate(votes, gold, 0.0)


def _neg52_with_gold(votes, gold, min_accuracy):
    rows = adjudicate(votes, {}, min_accuracy)
    if not gold:
        return rows
    # 把金标样本也按金标输出并合并
    merged = {row[0]: row for row in rows}
    for sid in gold:
        merged[sid] = [sid, gold[sid]]
    return [merged[k] for k in sorted(merged)]


def _neg52_tie_lowest(votes, gold, min_accuracy):
    rows = adjudicate(votes, gold, min_accuracy)
    stats = {}
    for sample, annotator, label in votes:
        if sample in gold:
            hit, total = stats.get(annotator, (0, 0))
            stats[annotator] = (hit + (label == gold[sample]), total + 1)
    reliable = {a: hit / total >= min_accuracy for a, (hit, total) in stats.items()}
    for row in rows:
        sid = row[0]
        counter = Counter(label for sample, who, label in votes
                          if sample == sid and (who not in stats or reliable[who]))
        best = max(counter.values()) if counter else 0
        tied = sorted(label for label, c in counter.items() if c == best)
        if len(tied) > 1:
            row[1] = tied[0]
    return rows


S52 = ([["s1", "a", "pos"], ["s1", "b", "pos"], ["s2", "a", "neg"], ["s2", "b", "pos"],
        ["s3", "a", "pos"], ["s3", "b", "neg"], ["s4", "c", "neu"]], {"s1": "pos", "s2": "neg"}, 0.5)

P52 = problem(
    title="低质量标注员剔除与重投",
    theme="label_merge", ability="数据处理与标注", knowledge="标注质量评估与仲裁规则",
    fn="adjudicate", params=["votes", "gold", "min_accuracy"],
    description=r'''
    ### 一、题目描述

    抽检发现一批数字人客服语料里混有低质量标注。`votes` 是全部标注结果，`gold` 是少量样本的金标。请按下面的规则处理：

    1. 对每位标注员，在其标过的、有金标的样本上计算准确率 = 与金标一致的条数 / 有金标的条数。准确率**低于** `min_accuracy` 的标注员视为不可靠，其所有票作废；
    2. 没有任何带金标标注的标注员，视为可靠；
    3. 对没有金标的样本，用仍然可靠的标注员的票做多数表决（不加权）：得票最多的标签为最终标签；并列最高票，或没有任何有效票，记为 `"REVIEW"`。

    函数返回 `[[样本id, 标签], ...]`，只包含没有金标的样本，按样本 id 字典序升序。

    ### 二、输入说明

    - `votes`：每项 `[样本id, 标注员id, 标签]`，顺序打乱；同一标注员对同一样本最多出现一次；
    - `gold`：`{样本id: 金标}`，可能为空；
    - 准确率与 `min_accuracy` 直接用浮点数比较即可，用例中的分界都能被精确表示。

    ### 三、示例

    ```text
    votes   = [["s1","a","pos"],["s1","b","pos"],["s2","a","neg"],["s2","b","pos"],
              ["s3","a","pos"],["s3","b","neg"],["s4","c","neu"]]
    gold    = {"s1": "pos", "s2": "neg"}
    min_accuracy = 0.5
    返回    = [["s3","REVIEW"],["s4","neu"]]
    ```

    `a` 的准确率 2/2，`b` 的准确率 1/2，都不低于 0.5，两人都可靠；`c` 没有带金标的标注，也可靠。`s3` 上 pos 与 neg 各一票，并列，转人工复核。
    ''',
    sample=[*S52],
    cases=lambda: [
        [*S52],
        [S52[0], S52[1], 0.8],
        [[["g", "a", "pos"], ["x", "a", "neg"]], {"g": "neg"}, 1.0],
        [[], {}, 0.9],
        [[["g1", "a", "pos"], ["g2", "b", "neg"]], {"g1": "pos", "g2": "neg"}, 0.5],
        [[["s10", "a", "pos"], ["s2", "a", "neg"], ["s1", "a", "neu"]], {}, 0.5],
        [[["x", "c", "neu"], ["x", "a", "pos"]], {}, 1.0],
        [[["g1", "a", "neg"], ["g2", "a", "neg"], ["x", "a", "pos"], ["x", "b", "neg"], ["x", "c", "neg"]],
         {"g1": "pos", "g2": "pos"}, 0.5],
        [*_rand52(random.Random(211), 400, 5, 0.3), 0.8],
        [*_rand52(random.Random(212), 1500, 6, 0.25), 0.7],
    ],
    reference=adjudicate,
    alt=_alt52,
    fuzz=lambda rng: [*_rand52(rng, rng.randint(1, 8), rng.randint(1, 4), rng.choice([0.0, 0.3, 0.6, 1.0])), rng.choice([0.5, 0.75, 1.0])],
    negatives={
        "没有剔除低质量标注员": _neg52_keep_all,
        "把带金标的样本也输出": _neg52_with_gold,
        "并列时取字典序最小的标签": _neg52_tie_lowest,
    },
    explanation=r'''
    分三步：

    1. 第一遍扫描，用带金标的样本给每位标注员算准确率，找出不可靠的人；
    2. 第二遍扫描，只统计「没有金标、且投票人可靠」的票；样本一经出现就要登记，哪怕有效票为零；
    3. 逐样本取最高票：唯一最高才定标签，否则转复核；最后按样本 id 排序。

    易错点：金标样本不能再参与表决，也不应出现在结果里；准确率等于 `min_accuracy` 的人是可靠的，不要误伤。
    ''',
)


def _rand52(rng, n_samples, n_annot, gold_ratio):
    votes, gold = [], {}
    labels = ["pos", "neg", "neu"]
    people = [f"ann{a}" for a in range(n_annot)]
    quality = [rng.uniform(0.4, 1.0) for _ in people]
    for s in range(n_samples):
        sid = f"s{s:04d}"
        truth = rng.choice(labels)
        if rng.random() < gold_ratio:
            gold[sid] = truth
        for who, q in zip(people, quality):
            if rng.random() < 0.85:
                votes.append([sid, who, truth if rng.random() < q else rng.choice(labels)])
    rng.shuffle(votes)
    return votes, gold


# ---------------------------------------------------------------- 53 近重复泄漏
def near_duplicate_leakage(train_texts, test_texts, threshold):
    def normalize(text):
        s = "".join(text.split()).lower()
        return s, {s[i:i + 2] for i in range(len(s) - 1)}

    train = [normalize(t) for t in train_texts]
    exact = {s for s, _ in train}
    leaked = []
    for i, text in enumerate(test_texts):
        s, grams = normalize(text)
        if s in exact or (grams and any(
            other and len(grams & other) / len(grams | other) >= threshold for _, other in train
        )):
            leaked.append(i)
    rate = round(len(leaked) / len(test_texts), 4) if test_texts else 0.0
    return [leaked, rate]


def _alt53(train_texts, test_texts, threshold):
    def norm(text):
        return "".join(text.split()).lower()

    def grams(s):
        return {s[i:i + 2] for i in range(len(s) - 1)}

    exact, posting, size = set(), defaultdict(list), []
    for j, text in enumerate(train_texts):
        s = norm(text)
        exact.add(s)
        g = grams(s)
        size.append(len(g))
        for b in g:
            posting[b].append(j)
    leaked = []
    for i, text in enumerate(test_texts):
        s, g = norm(text), grams(norm(text))
        if s in exact:
            leaked.append(i)
            continue
        if not g:
            continue
        overlap = Counter()
        for b in g:
            overlap.update(posting.get(b, ()))
        if any(c / (len(g) + size[j] - c) >= threshold for j, c in overlap.items()):
            leaked.append(i)
    return [leaked, round(len(leaked) / len(test_texts), 4) if test_texts else 0.0]


def _neg53_raw_text(train_texts, test_texts, threshold):
    def grams(s):
        return {s[i:i + 2] for i in range(len(s) - 1)}

    train = [(t, grams(t)) for t in train_texts]
    exact = {t for t, _ in train}
    leaked = []
    for i, text in enumerate(test_texts):
        g = grams(text)
        if text in exact or (g and any(o and len(g & o) / len(g | o) >= threshold for _, o in train)):
            leaked.append(i)
    return [leaked, round(len(leaked) / len(test_texts), 4) if test_texts else 0.0]


def _neg53_overlap_coeff(train_texts, test_texts, threshold):
    def grams(s):
        s = "".join(s.split()).lower()
        return {s[i:i + 2] for i in range(len(s) - 1)}

    train = [grams(t) for t in train_texts]
    exact = {"".join(t.split()).lower() for t in train_texts}
    leaked = []
    for i, text in enumerate(test_texts):
        g = grams(text)
        if "".join(text.split()).lower() in exact or (g and any(o and len(g & o) / min(len(g), len(o)) >= threshold for o in train)):
            leaked.append(i)
    return [leaked, round(len(leaked) / len(test_texts), 4) if test_texts else 0.0]


def _neg53_strict(train_texts, test_texts, threshold):
    def grams(s):
        s = "".join(s.split()).lower()
        return {s[i:i + 2] for i in range(len(s) - 1)}

    exact = {"".join(t.split()).lower() for t in train_texts}
    leaked = []
    for i, text in enumerate(test_texts):
        g = grams(text)
        if "".join(text.split()).lower() in exact or (g and any(
            grams(t) and len(g & grams(t)) / len(g | grams(t)) > threshold for t in train_texts
        )):
            leaked.append(i)
    return [leaked, round(len(leaked) / len(test_texts), 4) if test_texts else 0.0]


def _rand53(rng, n_train, n_test):
    def word():
        return "".join(rng.choice("abcdefg") for _ in range(rng.randint(5, 40)))

    train = [word() for _ in range(n_train)]
    test = []
    for _ in range(n_test):
        r = rng.random()
        if r < 0.12 and train:
            t = rng.choice(train)
            i = rng.randrange(len(t))
            test.append(t[:i] + t[i + 1:])  # 删掉一个字符的近重复
        elif r < 0.22 and train:
            t = rng.choice(train).upper()
            test.append(t[:3] + " " + t[3:])
        elif r < 0.26:
            test.append("")
        else:
            test.append(word())
    return train, test


S53 = (["你好 世界", "今天天气不错", "请问怎么退货"], ["你好世界", "明天天气很好", "谢谢再见"], 0.25)

P53 = problem(
    title="训练测试集近重复样本泄漏检查",
    theme="leakage", ability="智能训练", knowledge="训练集与测试集的维护",
    fn="near_duplicate_leakage", params=["train_texts", "test_texts", "threshold"],
    description=r'''
    ### 一、题目描述

    数字人对话语料里常有「换个空格、改个大小写」的近重复样本。如果它们同时出现在训练集和测试集，评测分数会被高估。请检查测试集：

    1. 规范化：去掉所有空白字符（空格、制表符、换行），英文字母转小写；
    2. 规范化后与某条训练文本完全相同 → 泄漏；
    3. 否则，与某条训练文本的「字符二元组 Jaccard 相似度」**不低于** `threshold` → 泄漏。二元组集合是相邻两个字符组成的集合；Jaccard = 交集大小 / 并集大小。规范化后不足两个字符的文本，二元组集合为空，只按第 2 条判断。

    返回 `[泄漏的测试样本下标, 泄漏率]`：下标升序；泄漏率 = 泄漏条数 / 测试集条数，用 `round(x, 4)` 保留 4 位小数，测试集为空时为 0.0。

    ### 二、输入说明

    - 每条文本不超过 200 个字符；训练集与测试集各不超过 600 条；
    - `threshold` 取值在 0 到 1 之间。

    ### 三、示例

    ```text
    train_texts = ["你好 世界", "今天天气不错", "请问怎么退货"]
    test_texts  = ["你好世界", "明天天气很好", "谢谢再见"]
    threshold   = 0.25
    返回        = [[0, 1], 0.6667]
    ```

    第 1 条去掉空格后与「你好世界」完全相同；第 2 条与「今天天气不错」的二元组交集为 {天天, 天气}、并集 8 个，相似度 0.25，达到阈值；第 3 条没有重叠。
    ''',
    sample=[*S53],
    cases=lambda: [
        [*S53],
        [["Hello World"], ["helloworld", "HELLO WORLD"], 0.9],
        [["abc"], ["ab", "abcd"], 0.5],
        [["abc"], [], 0.5],
        [[], ["abc", "a"], 0.5],
        [["a", ""], ["a", "", "b"], 0.5],
        [["数字人\t客服"], ["数 字 人 客服"], 0.3],
        [["abcd"], ["dcba", "abcd"], 1.0],
        [*_rand53(random.Random(221), 300, 300), 0.6],
        [*_rand53(random.Random(221), 300, 300), 0.4],
    ],
    reference=near_duplicate_leakage,
    alt=_alt53,
    fuzz=lambda rng: [*_rand53(rng, rng.randint(0, 8), rng.randint(0, 8)), rng.choice([0.2, 0.3, 0.5, 0.75])],
    negatives={
        "没有做规范化，大小写和空格不同就算不同": _neg53_raw_text,
        "相似度用交集 / 较小集合大小（重叠系数）": _neg53_overlap_coeff,
        "相似度用严格大于而不是大于等于": _neg53_strict,
    },
    explanation=r'''
    先把所有文本规范化并预先算好二元组集合，再逐条测试文本与训练集比较。完全相同的判断用集合（或字典）做到 O(1)；相似度用集合的交、并运算。注意三点：

    1. 阈值是「不低于」，等于阈值也算泄漏；
    2. 二元组集合为空的短文本只能靠完全相同来判断，不要在空集合上做除法；
    3. 测试集为空时泄漏率返回 0.0，避免除零。

    规模稍大时可以按二元组建立倒排索引，只与「至少共享一个二元组」的训练文本比较，避免逐对计算。
    ''',
)


# ---------------------------------------------------------------- 54 并发会话容量测算
def replica_plan(qps, avg_duration_s, target_utilization, max_sessions, redundancy):
    concurrent = qps * avg_duration_s
    per_pod = max_sessions * target_utilization
    pods = math.ceil(concurrent / per_pod)
    return [round(concurrent, 2), pods, pods + redundancy]


def _alt54(qps, avg_duration_s, target_utilization, max_sessions, redundancy):
    from fractions import Fraction

    def frac(x):
        return Fraction(str(x))

    concurrent = frac(qps) * frac(avg_duration_s)
    pods = math.ceil(concurrent / (frac(max_sessions) * frac(target_utilization)))
    return [round(float(concurrent), 2), int(pods), int(pods) + redundancy]


def _neg54_full_load(qps, avg_duration_s, target_utilization, max_sessions, redundancy):
    concurrent = qps * avg_duration_s
    pods = math.ceil(concurrent / max_sessions)
    return [round(concurrent, 2), pods, pods + redundancy]


def _neg54_round(qps, avg_duration_s, target_utilization, max_sessions, redundancy):
    concurrent = qps * avg_duration_s
    pods = round(concurrent / (max_sessions * target_utilization))
    return [round(concurrent, 2), pods, pods + redundancy]


def _neg54_no_spare(qps, avg_duration_s, target_utilization, max_sessions, redundancy):
    concurrent = qps * avg_duration_s
    pods = math.ceil(concurrent / (max_sessions * target_utilization))
    return [round(concurrent, 2), pods, pods]


S54 = (50, 12, 0.8, 80, 2)

P54 = problem(
    title="并发会话容量测算",
    theme="capacity", ability="智能系统设计", knowledge="智能系统监控与容量规划",
    fn="replica_plan", params=["qps", "avg_duration_s", "target_utilization", "max_sessions", "redundancy"],
    imports="import math",
    description=r'''
    ### 一、题目描述

    数字人语音客服在高峰期每秒新进 `qps` 个会话，每个会话平均持续 `avg_duration_s` 秒。根据利特尔法则（L = λ × W），系统里同时活跃的会话数 L = `qps × avg_duration_s`。

    每个 Pod 最多同时承载 `max_sessions` 个会话；为了给峰值留余量，Pod 的利用率（活跃会话数 ÷ 上限）不应超过 `target_utilization`。请返回 `[L, pods, total_pods]`：

    1. `L`：平均并发会话数，用 `round(x, 2)` 保留 2 位小数；
    2. `pods`：需要的 Pod 数 = `ceil(L ÷ (max_sessions × target_utilization))`；
    3. `total_pods`：在 `pods` 的基础上再加 `redundancy` 个备用 Pod。

    ### 二、输入说明

    各参数均为非负数，`qps`、`avg_duration_s`、`target_utilization` 可能是小数（利用率大于 0 且不超过 1）；用例中的中间结果离整数边界足够远，按浮点数计算、用 `math.ceil` 取整即可。

    ### 三、示例

    ```text
    replica_plan(50, 12, 0.8, 80, 2) → [600, 10, 12]
    ```

    L = 50 × 12 = 600；每个 Pod 有效承载 80 × 0.8 = 64 个会话，600 ÷ 64 = 9.375，向上取整为 10；再加 2 个备用 Pod，共 12 个。
    ''',
    sample=[*S54],
    cases=lambda: [
        [*S54],
        [25, 8, 0.5, 100, 1],
        [7, 45, 0.75, 60, 0],
        [3, 20, 0.5, 40, 3],
        [1, 1, 0.5, 1, 0],
        [120, 6, 0.25, 200, 4],
        [17, 33, 0.75, 50, 2],
        [0.5, 90, 0.5, 30, 1],
        [333, 19, 0.6, 128, 6],
        [2000, 3, 0.5, 500, 10],
    ],
    reference=replica_plan,
    alt=_alt54,
    negatives={
        "没有乘利用率，按 Pod 满载计算": _neg54_full_load,
        "Pod 数量四舍五入而不是向上取整": _neg54_round,
        "忘记了备用 Pod": _neg54_no_spare,
    },
    explanation=r'''
    利特尔法则「系统里的平均数量 = 到达率 × 平均停留时间」是容量测算最常用的工具：先算出平均并发会话数，再除以单个 Pod 的有效承载量（上限 × 目标利用率），向上取整，最后加上冗余。

    三个易错点：利用率是打折用的，必须乘在上限上；容量只能多不能少，要向上取整；备用 Pod 是额外增加的。
    ''',
)


# ---------------------------------------------------------------- 55 成本最优阈值
def best_threshold(scores, labels, auto_cost, human_cost, error_penalty):
    n = len(scores)
    pairs = sorted(zip(scores, labels), key=lambda p: -p[0])
    costs = []
    auto = errors = 0
    for i, (score, ok) in enumerate(pairs):
        auto += 1
        errors += 0 if ok else 1
        if i + 1 < n and pairs[i + 1][0] == score:
            continue  # 同一置信度的会话同进同出
        costs.append((auto * auto_cost + errors * error_penalty + (n - auto) * human_cost, score))
    cost, threshold = min(costs)  # 元组比较：成本相同时阈值小者在前
    return [threshold, cost, n * human_cost - cost]


def _alt55(scores, labels, auto_cost, human_cost, error_penalty):
    best = None
    for t in sorted(set(scores), reverse=True):
        cost = sum(auto_cost + (0 if ok else error_penalty) if s >= t else human_cost
                   for s, ok in zip(scores, labels))
        if best is None or cost <= best[1]:  # 从高往低扫，用 <= 让并列时留下较小的阈值
            best = (t, cost)
    return [best[0], best[1], len(scores) * human_cost - best[1]]


def _neg55_no_penalty(scores, labels, auto_cost, human_cost, error_penalty):
    return best_threshold(scores, labels, auto_cost, human_cost, 0)


def _neg55_largest_tie(scores, labels, auto_cost, human_cost, error_penalty):
    best = None
    for t in sorted(set(scores), reverse=True):
        cost = sum(auto_cost + (0 if ok else error_penalty) if s >= t else human_cost
                   for s, ok in zip(scores, labels))
        if best is None or cost < best[1]:  # 并列时保留先遇到的较大阈值
            best = (t, cost)
    return [best[0], best[1], len(scores) * human_cost - best[1]]


def _neg55_saving_sign(scores, labels, auto_cost, human_cost, error_penalty):
    threshold, cost, saving = best_threshold(scores, labels, auto_cost, human_cost, error_penalty)
    return [threshold, cost, -saving]


def _rand55(rng, n):
    return [round(rng.random(), 1) for _ in range(n)], [rng.random() < 0.8 for _ in range(n)]


S55 = ([0.9, 0.8, 0.6, 0.4], [True, True, False, True], 1, 5, 10)

P55 = problem(
    title="转人工阈值的成本测算",
    theme="routing", ability="智能系统设计", knowledge="人机交互流程设计",
    fn="best_threshold", params=["scores", "labels", "auto_cost", "human_cost", "error_penalty"],
    description=r'''
    ### 一、题目描述

    数字人客服给每条会话打一个意图置信度 `score`。置信度**不低于**阈值 `t` 的会话由数字人自动应答，其余转人工。`labels[i]` 为 `True` 表示第 i 条会话数字人回答正确。成本如下（均为非负整数）：

    - 自动应答一条：`auto_cost`；若该条回答错误，另加 `error_penalty` 的罚金；
    - 转人工一条：`human_cost`。

    候选阈值只能取 `scores` 中出现过的数值。请选择总成本最小的阈值；成本相同时取更小的阈值（让数字人多接管）。返回 `[t, 总成本, 节省额]`，其中节省额 = 全部转人工的成本 − 该方案的成本，可能为负。

    ### 二、输入说明

    - `scores` 与 `labels` 等长（1 ≤ 长度 ≤ 5000），`scores` 里的数值可能有重复；重复的置信度必须同进同出；
    - 三个成本都是非负整数，返回的三项也都是整数。

    ### 三、示例

    ```text
    scores        = [0.9, 0.8, 0.6, 0.4]
    labels        = [True, True, False, True]
    auto_cost = 1，human_cost = 5，error_penalty = 10
    返回          = [0.8, 12, 8]
    ```

    `t = 0.8` 时自动应答 2 条且都答对，成本 2 × 1 + 2 × 5 = 12；全部转人工要 20，所以节省 8。`t = 0.6` 时要为答错的那条付 10 的罚金，成本 18，反而更高。
    ''',
    sample=[*S55],
    cases=lambda: [
        [*S55],
        [[0.9, 0.8], [False, False], 1, 5, 10],
        [[0.9, 0.6], [True, False], 0, 5, 5],
        [[0.7, 0.7, 0.3], [True, False, True], 1, 3, 2],
        [[0.5], [True], 1, 9, 9],
        [[0.9, 0.5, 0.2], [False, True, False], 0, 0, 0],
        [[3, 2, 1], [True, True, False], 1, 4, 3],
        [[0.95, 0.9, 0.85], [False, False, False], 0, 1, 100],
        [*_rand55(random.Random(231), 300), 2, 8, 15],
        [*_rand55(random.Random(232), 2000), 1, 6, 9],
    ],
    reference=best_threshold,
    alt=_alt55,
    fuzz=lambda rng: [*_rand55(rng, rng.randint(1, 12)), rng.randint(0, 3), rng.randint(0, 8), rng.randint(0, 12)],
    negatives={
        "没有计入答错的罚金": _neg55_no_penalty,
        "成本并列时取了较大的阈值": _neg55_largest_tie,
        "节省额的正负号算反": _neg55_saving_sign,
    },
    explanation=r'''
    把会话按置信度从高到低排序后，阈值从高往低移动时只会多接管几条会话。用两个计数器（已接管数、其中答错数）边扫边算每个阈值对应的成本，取最小即可，复杂度 O(n log n)。

    易错点：答错的会话既有自动应答成本又有罚金；置信度相同的会话是一个整体，要扫到这一组的最后一条才能评估；并列时题目要求取更小的阈值；节省额以「全部转人工」为基准，自动应答不划算时会是负数。
    ''',
)


# ---------------------------------------------------------------- 56 尼曼分配
def neyman_allocation(strata, total, min_each):
    size = [row[1] for row in strata]
    weight = [row[1] * row[2] for row in strata]
    quota = [min(min_each, s) for s in size]
    pending = [i for i in range(len(strata)) if quota[i] < size[i]]  # 还没分满的层
    remaining = total - sum(quota)
    while remaining > 0 and pending:
        weight_sum = sum(weight[i] for i in pending)
        share = {i: remaining * weight[i] // weight_sum for i in pending}
        rest = {i: remaining * weight[i] % weight_sum for i in pending}
        left = remaining - sum(share.values())
        for i in sorted(pending, key=lambda i: (-rest[i], i))[:left]:
            share[i] += 1
        over = [i for i in pending if quota[i] + share[i] > size[i]]
        if not over:
            for i in pending:
                quota[i] += share[i]
            remaining = 0
        else:
            for i in over:  # 超限的层直接分满，让出的名额进入下一轮
                remaining -= size[i] - quota[i]
                quota[i] = size[i]
                pending.remove(i)
    return quota


def _alt56(strata, total, min_each):
    quota = [min(min_each, row[1]) for row in strata]

    def give(candidates, remaining):
        if remaining <= 0 or not candidates:
            return
        weight_sum = sum(strata[i][1] * strata[i][2] for i in candidates)
        exact = {i: Fraction(remaining * strata[i][1] * strata[i][2], weight_sum) for i in candidates}
        add = {i: exact[i].numerator // exact[i].denominator for i in candidates}
        left = remaining - sum(add.values())
        order = sorted(candidates, key=lambda i: (add[i] - exact[i], i))  # 余数大者优先
        for i in order[:left]:
            add[i] += 1
        over = [i for i in candidates if quota[i] + add[i] > strata[i][1]]
        for i in over:
            remaining -= strata[i][1] - quota[i]
            quota[i] = strata[i][1]
        if over:
            give([i for i in candidates if i not in over], remaining)
        else:
            for i in candidates:
                quota[i] += add[i]

    give([i for i in range(len(strata)) if quota[i] < strata[i][1]], total - sum(quota))
    return quota


def _neg56_truncate(strata, total, min_each):
    # 只算一轮，超限的层直接截断，不让出名额
    size = [row[1] for row in strata]
    weight = [row[1] * row[2] for row in strata]
    quota = [min(min_each, s) for s in size]
    remaining = total - sum(quota)
    pending = [i for i in range(len(strata)) if quota[i] < size[i]]
    weight_sum = sum(weight[i] for i in pending)
    if remaining > 0 and weight_sum > 0:
        share = {i: remaining * weight[i] // weight_sum for i in pending}
        rest = {i: remaining * weight[i] % weight_sum for i in pending}
        left = remaining - sum(share.values())
        for i in sorted(pending, key=lambda i: (-rest[i], i))[:left]:
            share[i] += 1
        for i in pending:
            quota[i] = min(size[i], quota[i] + share[i])
    return quota


def _neg56_size_only(strata, total, min_each):
    return neyman_allocation([[name, s, 1] for name, s, _ in strata], total, min_each)


def _neg56_tie_later(strata, total, min_each):
    size = [row[1] for row in strata]
    weight = [row[1] * row[2] for row in strata]
    quota = [min(min_each, s) for s in size]
    pending = [i for i in range(len(strata)) if quota[i] < size[i]]
    remaining = total - sum(quota)
    while remaining > 0 and pending:
        weight_sum = sum(weight[i] for i in pending)
        share = {i: remaining * weight[i] // weight_sum for i in pending}
        rest = {i: remaining * weight[i] % weight_sum for i in pending}
        left = remaining - sum(share.values())
        for i in sorted(pending, key=lambda i: (-rest[i], -i))[:left]:
            share[i] += 1
        over = [i for i in pending if quota[i] + share[i] > size[i]]
        if over:
            for i in over:
                remaining -= size[i] - quota[i]
                quota[i] = size[i]
                pending.remove(i)
        else:
            for i in pending:
                quota[i] += share[i]
            remaining = 0
    return quota


def _rand56(rng, count):
    strata = [[f"L{i:03d}", rng.randint(0, 80), rng.randint(1, 6)] for i in range(count)]
    return strata, rng.randint(0, sum(s for _, s, _ in strata)), rng.randint(0, 5)


S56 = ([["A", 30, 2], ["B", 50, 1], ["C", 20, 4]], 40, 0)

P56 = problem(
    title="尼曼分层配额分配",
    theme="sampling", ability="智能训练", knowledge="评测集构建与分层抽样",
    fn="neyman_allocation", params=["strata", "total", "min_each"],
    description=r'''
    ### 一、题目描述

    评测集要从各层数据中抽取 `total` 条。为了兼顾规模和离散程度，采用尼曼分配（Neyman）：`strata` 每项为 `[层名, 样本数, 标准差]`，层的权重 = 样本数 × 标准差。规则如下：

    1. 保底：每层先分 `min(min_each, 该层样本数)` 条；
    2. 剩余名额 R = `total` − 保底合计，在「还没分满」的层之间按权重占比分配，使用最大余数法：先分 `floor(R × 权重 ÷ 权重总和)`，再按小数余数从大到小各加 1，余数相同时下标小的层优先；
    3. 若某层因此超过其样本数，则该层直接分满（取其样本数），让出的名额在其余未满层之间按同样规则重新分配；重复直到没有超限。

    函数返回与 `strata` 顺序一致的配额列表。保证 `total` 不超过各层样本数之和；且只要还有名额待分配，未满层的权重总和大于 0。

    ### 二、输入说明

    - `strata`：1 ≤ 层数 ≤ 500；样本数为不超过 10^5 的非负整数，标准差为正整数；`min_each` 为非负整数；
    - 请用整数运算（`//` 与 `%`）计算取整和余数，不要用浮点数比较余数。

    ### 三、示例

    ```text
    strata   = [["A", 30, 2], ["B", 50, 1], ["C", 20, 4]]
    total    = 40，min_each = 0
    返回     = [13, 10, 17]
    ```

    权重为 60、50、80，总和 190。R = 40，三层先分 12、10、16，还差 2 条；余数依次约为 0.63、0.53、0.84，C 和 A 各加 1。
    ''',
    sample=[*S56],
    cases=lambda: [
        [*S56],
        [[["A", 5, 10], ["B", 100, 1]], 30, 0],
        [[["A", 10, 3], ["B", 20, 1]], 15, 5],
        [[["A", 3, 5], ["B", 4, 1]], 7, 2],
        [[["A", 100, 0], ["B", 100, 5], ["C", 100, 5]], 20, 0],
        [[["x", 10, 1], ["y", 10, 1], ["z", 10, 1]], 10, 0],
        [[["a", 2, 9], ["b", 3, 9], ["c", 100, 1]], 30, 0],
        [[["p", 7, 3], ["q", 7, 3]], 10, 0],
        _rand56(random.Random(241), 60),
        _rand56(random.Random(242), 500),
    ],
    reference=neyman_allocation,
    alt=_alt56,
    fuzz=lambda rng: _rand56(rng, rng.randint(1, 6)),
    negatives={
        "只算一轮，超限的层截断后没有把名额让给其他层": _neg56_truncate,
        "权重只用了样本数，没有乘标准差": _neg56_size_only,
        "余数并列时下标大的层优先": _neg56_tie_later,
    },
    explanation=r'''
    尼曼分配让「规模大、波动也大」的层多抽样，在总样本量固定时估计的方差最小。实现时围绕「未满层的名单」做循环：

    1. 每一轮只在还没分满的层之间按权重分配名额，floor 与余数都用整数运算；
    2. 分完后找出超限的层，把它们直接设为满额，从名单里移走，并回收它们「没吃完」的名额；
    3. 没有超限就结束。每一轮至少移走一层，所以一定会停。

    易错点：忘记保底会占用名额；超限层的名额没有回收，导致总数不足；把标准差漏掉就退化成了按规模比例分配。
    ''',
)


# ---------------------------------------------------------------- 57 告警抑制
def suppress_alerts(alerts, rules):
    gap_of = {(service, metric): gap for service, metric, gap in rules}
    order = sorted(range(len(alerts)), key=lambda i: (alerts[i][0], i))
    last_sent, sent, suppressed = {}, [], 0
    for i in order:
        ts, service, metric, _ = alerts[i]
        key = (service, metric)
        gap = gap_of.get(key)
        if gap is not None and key in last_sent and ts - last_sent[key] < gap:
            suppressed += 1
        else:
            sent.append(i)
            last_sent[key] = ts  # 只有真正发出去的告警才刷新计时基准
    return {
        "sent": sorted(sent),
        "suppressed": suppressed,
        "noise_ratio": round(suppressed / len(alerts), 4) if alerts else 0.0,
    }


def _alt57(alerts, rules):
    gap_of = {(service, metric): gap for service, metric, gap in rules}
    groups = defaultdict(list)
    for i, (ts, service, metric, _) in enumerate(alerts):
        groups[(service, metric)].append((ts, i))
    sent, suppressed = [], 0
    for key, items in groups.items():  # 各 (服务, 指标) 互不影响，可以分组处理
        gap = gap_of.get(key)
        previous = None
        for ts, i in sorted(items):
            if gap is not None and previous is not None and ts - previous < gap:
                suppressed += 1
            else:
                sent.append(i)
                previous = ts
    return {"sent": sorted(sent), "suppressed": suppressed,
            "noise_ratio": round(suppressed / len(alerts), 4) if alerts else 0.0}


def _wrong57(alerts, rules, base_is_last_alert, suppress_on_equal, keep_input_order):
    gap_of = {(service, metric): gap for service, metric, gap in rules}
    order = list(range(len(alerts))) if keep_input_order else sorted(range(len(alerts)), key=lambda i: (alerts[i][0], i))
    last, sent, suppressed = {}, [], 0
    for i in order:
        ts, service, metric, _ = alerts[i]
        key = (service, metric)
        gap = gap_of.get(key)
        too_close = gap is not None and key in last and (
            ts - last[key] <= gap if suppress_on_equal else ts - last[key] < gap
        )
        if too_close:
            suppressed += 1
        else:
            sent.append(i)
        if base_is_last_alert or not too_close:
            last[key] = ts
    return {"sent": sorted(sent), "suppressed": suppressed,
            "noise_ratio": round(suppressed / len(alerts), 4) if alerts else 0.0}


def _neg57_debounce(alerts, rules):
    return _wrong57(alerts, rules, base_is_last_alert=True, suppress_on_equal=False, keep_input_order=False)


def _neg57_boundary(alerts, rules):
    return _wrong57(alerts, rules, base_is_last_alert=False, suppress_on_equal=True, keep_input_order=False)


def _neg57_unsorted(alerts, rules):
    return _wrong57(alerts, rules, base_is_last_alert=False, suppress_on_equal=False, keep_input_order=True)


def _rand57(rng, count, rule_count, span):
    keys = [(f"svc{i:02d}", metric) for i in range(6) for metric in ("cpu", "p99")]
    rules = [[service, metric, rng.randint(0, 120)] for service, metric in rng.sample(keys, rule_count)]
    alerts = [[rng.randrange(span), service, metric, rng.choice(["P1", "P2", "P3"])]
              for service, metric in (rng.choice(keys) for _ in range(count))]
    return alerts, rules


S57 = ([[10, "tts", "p99", "P2"], [25, "tts", "p99", "P3"], [40, "tts", "p99", "P2"],
        [12, "asr", "err", "P3"], [13, "asr", "err", "P3"]], [["tts", "p99", 20], ["asr", "err", 5]])

P57 = problem(
    title="告警抑制规则与降噪统计",
    theme="alerts", ability="智能系统设计", knowledge="智能系统监控与告警治理",
    fn="suppress_alerts", params=["alerts", "rules"],
    description=r'''
    ### 一、题目描述

    数字人平台的某个指标抖动时，每隔几秒就会触发一次重复告警。请按下面的规则抑制重复告警：

    - `rules` 每项 `[服务名, 指标名, 最小间隔秒]`，每个 (服务, 指标) 至多一条规则；没有匹配规则的告警总是发送；
    - 把告警按时间戳升序处理，时间戳相同按输入顺序。对匹配规则的告警：若同一 (服务, 指标) 上一次**已发送**的告警距今不足最小间隔（严格小于），则抑制；否则发送，并把「最近发送时间」更新为它；
    - 被抑制的告警不会刷新「最近发送时间」。

    返回一份字典：

    ```text
    {
      "sent":        已发送告警在输入列表中的下标（升序）,
      "suppressed":  被抑制的告警条数,
      "noise_ratio":   抑制条数 ÷ 告警总数，
                       用 round(x, 4) 保留 4 位小数；总数为 0 时为 0.0
    }
    ```

    ### 二、输入说明

    - `alerts` 每项 `[时间戳, 服务名, 指标名, 级别]`，时间戳为非负整数（秒），输入顺序打乱；告警总数不超过 20000；
    - 最小间隔为非负整数。

    ### 三、示例

    ```text
    alerts = [[10,"tts","p99","P2"],[25,"tts","p99","P3"],[40,"tts","p99","P2"],
              [12,"asr","err","P3"],[13,"asr","err","P3"]]
    rules  = [["tts","p99",20],["asr","err",5]]
    返回   = {"sent": [0, 2, 3], "suppressed": 2, "noise_ratio": 0.4}
    ```

    `tts/p99`：第 0 条发出；第 1 条距上次发送 15 秒，不足 20，被抑制；第 2 条距上次发送 30 秒，发出。`asr/err` 的两条只差 1 秒，第 4 条被抑制。
    ''',
    sample=[*S57],
    cases=lambda: [
        [*S57],
        [[[5, "s", "m", "P1"], [9, "t", "m", "P2"]], []],
        [[], [["s", "m", 10]]],
        [[[50, "s", "m", "P1"], [10, "s", "m", "P2"], [30, "s", "m", "P3"]], [["s", "m", 25]]],
        [[[0, "s", "m", "P3"], [10, "s", "m", "P3"], [20, "s", "m", "P3"], [25, "s", "m", "P3"]], [["s", "m", 15]]],
        [[[5, "s", "m", "P2"], [5, "s", "m", "P2"], [5, "s", "m", "P2"]], [["s", "m", 0]]],
        [[[0, "s", "m", "P2"], [15, "s", "m", "P2"]], [["s", "m", 15]]],
        [[[1, "a", "x", "P3"], [2, "a", "x", "P3"], [3, "b", "y", "P3"], [4, "b", "y", "P3"]], [["a", "z", 100], ["a", "x", 10]]],
        _rand57(random.Random(251), 2000, 6, 20000),
        _rand57(random.Random(252), 8000, 8, 60000),
    ],
    reference=suppress_alerts,
    alt=_alt57,
    fuzz=lambda rng: _rand57(rng, rng.randint(0, 20), rng.randint(0, 3), 40),
    negatives={
        "以上一条告警而不是上一次发送为计时基准": _neg57_debounce,
        "间隔等于最小间隔也被抑制": _neg57_boundary,
        "没有先按时间排序，按输入顺序处理": _neg57_unsorted,
    },
    explanation=r'''
    这是「按规则做节流」的标准写法：

    1. 先把告警按时间排好序（输入顺序不可信），再把规则整理成以 (服务, 指标) 为键的字典，方便查找；
    2. 逐条处理：查到规则且距上一次发送不足间隔就抑制，否则发送并刷新该键的「最近发送时间」；
    3. 被抑制的告警不能刷新计时基准——否则只要告警一直连着来，就永远不会再发出来。

    输出的是下标，所以排序时要带着原下标一起排，最后把发送下标升序返回；总数为 0 时噪声率按 0.0 处理。
    ''',
)


PROBLEMS = [P51, P52, P53, P54, P55, P56, P57]
