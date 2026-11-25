"""各套编程题共用的小工具：随机 DAG、随机入参等。仅供 scripts/finals 的构建脚本使用。"""


def rand_dag(rng, n, density=0.3, prefix="s", max_dur=9, shuffle=True):
    """随机生成无环依赖图：只允许编号小的环节指向编号大的环节（i → j, i < j），因而必然无环。

    返回 (names, durations, deps)，deps 用环节名称表示。shuffle=True 时打乱 names 的呈现顺序，
    用来模拟「输入未必按拓扑序排列」。
    """
    names = [f"{prefix}{i}" for i in range(n)]
    durations = [rng.randint(1, max_dur) for _ in range(n)]
    deps = []
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < density / (j - i):
                deps.append([names[i], names[j]])
    if shuffle:
        order = list(range(n))
        rng.shuffle(order)
        names = [names[i] for i in order]
        durations = [durations[i] for i in order]
    return names, durations, deps


def rand_int_list(rng, n, lo, hi):
    return [rng.randint(lo, hi) for _ in range(n)]
