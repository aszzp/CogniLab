#!/usr/bin/env python3
"""构建决赛模拟卷：理论题定序 + 编程题生成测试点，写出 data/finals/sets/set-0N.json。

用法：
  python3 scripts/finals/build.py            构建全部套卷
  python3 scripts/finals/build.py --check    重新构建并与已提交文件比对，有漂移即失败
  python3 scripts/finals/build.py --set 1    只构建第 1 套
  加 --only-theory --set N / --only-code --set N 只校验一半（理论题 / 编程题），不写文件

每道编程题在 scripts/finals/problems/setN.py 中声明：
  sample     可见样例的入参（期望输出由参考解算出）
  cases      返回 10 组测试点入参的函数，首组即样例
  reference  参考解：展示给考生的源码，同时用来生成期望输出
  alt        独立写法（暴力或另一种推导），用来交叉验证参考解
  fuzz       返回随机小规模入参的函数，用于参考解与独立写法的差分测试
  negatives  典型错解，每份都必须至少挂在一个测试点上
  imports    参考代码需要的 import 语句，会同时写进参考代码与起始模板
"""
import argparse
import importlib.util
import inspect
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "finals"
SETS = range(1, 6)
FUZZ_ROUNDS = 400
SHOW_SAMPLES = set()


def same(a, b):
    """与 src/lib/python-judge.mjs 的 sameOutput 同口径：数值 1e-9 相对误差。"""
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b or abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    return a == b


def show(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


LIST_ITEM = re.compile(r"^(\s+|[-*] |\d+\. )")


def soft_breaks(markdown):
    """找出会渲染进同一段落的相邻正文行：既不是空行分隔，也不是列表项或代码块。"""
    problems, fence, previous = [], False, False
    for n, line in enumerate(markdown.splitlines(), 1):
        if line.startswith("```"):
            fence = not fence
            previous = False
            continue
        body = bool(line.strip()) and not fence
        if body and previous and not LIST_ITEM.match(line):
            problems.append(n)
        previous = body
    return problems


def differs(fn, args, expected):
    try:
        return not same(fn(*args), expected)
    except Exception:
        return True


def load_module(path):
    if str(path.parent) not in sys.path:
        sys.path.insert(0, str(path.parent))  # 题目模块之间的 import common
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = module
    spec.loader.exec_module(module)
    return module


def build_problem(set_no, index, spec):
    label = f"第{set_no}套 第{index + 1}题"
    reference, alt = spec["reference"], spec.get("alt")
    cases = spec["cases"]()
    if len(cases) != 10:
        raise SystemExit(f"{label}: 需要 10 个测试点，实际 {len(cases)}")
    sample = spec.get("sample", cases[0])
    if show(sample) != show(cases[0]):
        raise SystemExit(f"{label}: 首个测试点必须与可见样例一致")
    expected = []
    for n, args in enumerate(cases, 1):
        value = reference(*args)
        if json.loads(json.dumps(value, ensure_ascii=False, allow_nan=False)) != value:
            raise SystemExit(f"{label}: 测试点 {n} 的期望输出不是普通 JSON 数据")
        expected.append(value)
    checked = 0
    if alt:
        for n, args in enumerate(cases, 1):
            if spec.get("alt_case_ok", lambda _: True)(args):
                if not same(alt(*args), expected[n - 1]):
                    raise SystemExit(f"{label}: 测试点 {n} 参考解与独立实现不一致")
                checked += 1
    fuzzed = 0
    if alt and spec.get("fuzz"):
        for seed in range(FUZZ_ROUNDS):
            args = spec["fuzz"](random.Random(seed))
            if not same(reference(*args), alt(*args)):
                raise SystemExit(f"{label}: 差分测试 seed={seed} 不一致，入参 {show(args)}")
            fuzzed += 1
    for name, wrong in spec.get("negatives", {}).items():
        # 错解抛异常也算「与期望不同」：线上判题会记为运行出错
        failed = [n for n, args in enumerate(cases, 1) if differs(wrong, args, expected[n - 1])]
        if not failed:
            raise SystemExit(f"{label}: 错解「{name}」通过了全部测试点，测试点区分度不足")
    # 参考代码要能原样提交：题目声明的 import 一并带上，并放进干净命名空间里重跑一遍确认自包含
    imports = spec.get("imports", "")
    reference_src = ((imports + "\n\n") if imports else "") + inspect.getsource(reference).rstrip("\n")
    sandbox = {}
    exec(reference_src, sandbox)
    for n, args in enumerate(cases, 1):
        if not same(sandbox[spec["fn"]](*args), expected[n - 1]):
            raise SystemExit(f"{label}: 测试点 {n} 参考代码单独运行时结果不符，检查是否缺少 import")
    description = inspect.cleandoc(spec["description"]).strip()
    broken = soft_breaks(description)
    if broken:
        raise SystemExit(f"{label}: 题面第 {broken} 行与上一行会被渲染成同一段，请用空行分隔或改成列表/代码块")
    broken = soft_breaks(inspect.cleandoc(spec["explanation"]).strip())
    if broken:
        raise SystemExit(f"{label}: 解析第 {broken} 行与上一行会被渲染成同一段")
    params = spec["params"]
    return {
        "key": f"s{set_no}-c{index + 1:02d}",
        "no": 50 + index + 1,
        "theme": spec["theme"],
        "title": spec["title"],
        "ability": spec["ability"],
        "knowledge": spec["knowledge"],
        "fn": spec["fn"],
        "params": params,
        "description": description,
        "starter": ((imports + "\n\n") if imports else "")
        + f"# 在这里实现 {spec['fn']}；输入输出规格见左侧「题目描述」\n"
        + f"def {spec['fn']}({', '.join(params)}):\n    pass\n",
        "samples": [{"args": args, "expected": expected[n]} for n, args in enumerate(cases) if n < spec.get("visible", 1)],
        "cases": [{"args": args, "expected": expected[n]} for n, args in enumerate(cases)],
        "reference": reference_src,
        "explanation": inspect.cleandoc(spec["explanation"]).strip(),
    }, {"alt_checked": checked, "fuzzed": fuzzed, "negatives": len(spec.get("negatives", {}))}


def check_theory(set_no, questions, blueprint):
    errors = []
    want = {m["key"]: m["count"] for m in blueprint["modules"]}
    got = {}
    for q in questions:
        got[q["module"]] = got.get(q["module"], 0) + 1
        if q["module"] not in want:
            errors.append(f"未知模块 {q['module']}")
        if len(q["options"]) != 4:
            errors.append(f"选项不是 4 个：{q['stem'][:24]}")
        if q["answer"] not in "ABCD" or len(q["answer"]) != 1:
            errors.append(f"答案格式错误：{q['stem'][:24]}")
        if len({o.strip() for o in q["options"]}) != len(q["options"]):
            errors.append(f"选项重复：{q['stem'][:24]}")
        if q["difficulty"] not in (1, 2, 3):
            errors.append(f"难度须为 1..3：{q['stem'][:24]}")
        if q["origin"] not in ("original", "prelim", "prelim_adapted"):
            errors.append(f"未知 origin：{q['origin']}")
        for field in ("topic", "basis", "stem", "explanation"):
            if not q.get(field, "").strip():
                errors.append(f"缺少 {field}：{q['stem'][:24]}")
        if len(q.get("explanation", "")) < 16:
            errors.append(f"解析过短：{q['stem'][:24]}")
        if not q["basis"].startswith("标准") and q["basis"] != "工种专项":
            errors.append(f"依据应为「标准x.x.x」条款号或「工种专项」：{q['basis']}：{q['stem'][:24]}")
        if "以上都" in "".join(q["options"]):
            errors.append(f"选项含「以上都对/都不对」：{q['stem'][:24]}")
    if len({q["topic"] for q in questions}) != len(questions):
        errors.append("同一套内 topic 重复")
    if got != want:
        errors.append(f"模块配额不符：要求 {want}，实际 {got}")
    if len(questions) != sum(want.values()):
        errors.append(f"题量应为 {sum(want.values())}，实际 {len(questions)}")
    diff = {}
    for q in questions:
        diff[q["difficulty"]] = diff.get(q["difficulty"], 0) + 1
    if diff != {int(k): v for k, v in blueprint["difficulty"].items()}:
        errors.append(f"难度分布不符：要求 {blueprint['difficulty']}，实际 {diff}")
    letters = {}
    for q in questions:
        letters[q["answer"]] = letters.get(q["answer"], 0) + 1
    lo, hi = blueprint["answerLetterRange"]
    for letter in "ABCD":
        if not lo <= letters.get(letter, 0) <= hi:
            errors.append(f"答案 {letter} 出现 {letters.get(letter, 0)} 次，应在 {lo}..{hi}")
    return errors


def load_theory(set_no, blueprint, all_stems):
    """读取并校验理论题，按固定种子打乱后编上题号。"""
    theory_path = DATA / "theory" / f"set-{set_no:02d}.json"
    if not theory_path.exists():
        raise SystemExit(f"缺少 {theory_path.relative_to(ROOT)}")
    theory = json.loads(theory_path.read_text(encoding="utf-8"))
    errors = check_theory(set_no, theory, blueprint)
    for q in theory:
        stem = "".join(q["stem"].split())
        if stem in all_stems:
            errors.append(f"题干与第 {all_stems[stem]} 套重复：{q['stem'][:30]}")
        all_stems[stem] = set_no
    if errors:
        raise SystemExit(f"第 {set_no} 套理论题校验失败：\n  " + "\n  ".join(errors))
    # 固定种子打乱，模块穿插呈现；源文件里的顺序可随意调整而不影响已发布卷面的题号
    random.Random(1000 + set_no).shuffle(theory)
    return [{**q, "key": f"s{set_no}-t{n:02d}", "no": n} for n, q in enumerate(theory, 1)]


def build_set(set_no, blueprint, all_stems):
    problems_path = ROOT / "scripts" / "finals" / "problems" / f"set{set_no}.py"
    if not problems_path.exists():
        raise SystemExit(f"缺少 {problems_path.relative_to(ROOT)}")
    theory = load_theory(set_no, blueprint, all_stems)

    module = load_module(problems_path)
    order = [t["key"] for t in blueprint["themes"]]
    if [p["theme"] for p in module.PROBLEMS] != order:
        raise SystemExit(f"第 {set_no} 套编程题主题顺序应为 {order}")
    code, stats = [], []
    for index, spec in enumerate(module.PROBLEMS):
        problem, stat = build_problem(set_no, index, spec)
        code.append(problem)
        stats.append(stat)
    themes = {t["key"]: t for t in blueprint["themes"]}
    for p in code:
        p["no"] = themes[p["theme"]]["no"]
    numerals = "一二三四五"
    paper = {
        "id": f"set-{set_no:02d}",
        "no": set_no,
        "title": f"决赛模拟卷（{numerals[set_no - 1]}）",
        "theory": theory,
        "code": code,
    }
    return paper, stats


def render(paper):
    # 构建产物不需要人工阅读：紧凑输出，避免大用例把文件撑到数 MB
    return json.dumps(paper, ensure_ascii=False, separators=(",", ":")) + "\n"


def verify_code(set_no, blueprint):
    """只跑编程题这一半：参考解生成期望、独立实现核对、差分测试、错解区分度。"""
    module = load_module(ROOT / "scripts" / "finals" / "problems" / f"set{set_no}.py")
    order = [t["key"] for t in blueprint["themes"]]
    if [p["theme"] for p in module.PROBLEMS] != order:
        raise SystemExit(f"第 {set_no} 套编程题主题顺序应为 {order}")
    total_cases = total_fuzz = total_neg = 0
    for index, spec in enumerate(module.PROBLEMS):
        built, stat = build_problem(set_no, index, spec)
        total_cases += stat["alt_checked"]
        if SHOW_SAMPLES:  # 写题面示例时核对期望输出
            print(f"    样例期望输出：{json.dumps(built['samples'][0]['expected'], ensure_ascii=False)}")
        total_fuzz += stat["fuzzed"]
        total_neg += stat["negatives"]
        print(f"  {index + 1:02d} {spec['title']}：独立实现核对 {stat['alt_checked']} 点，"
              f"差分 {stat['fuzzed']} 轮，错解 {stat['negatives']} 份")
    print(f"第 {set_no} 套编程题通过：共核对 {total_cases} 个测试点、{total_fuzz} 轮差分、{total_neg} 份错解")


def verify_theory(set_no, blueprint):
    """只校验理论题这一半：配额、格式、难度与答案字母分布、跨套题干重复。"""
    stems = {}
    for other in SETS:
        path = DATA / "theory" / f"set-{other:02d}.json"
        if other == set_no or not path.exists():
            continue
        try:
            for q in json.loads(path.read_text(encoding="utf-8")):
                stems["".join(q["stem"].split())] = other
        except (ValueError, KeyError, TypeError, AttributeError):
            continue  # 其他套还在起草，暂时跳过
    theory = load_theory(set_no, blueprint, stems)
    by = {}
    for field in ("module", "difficulty", "answer"):
        by[field] = {}
        for q in theory:
            by[field][q[field]] = by[field].get(q[field], 0) + 1
    show = lambda d: "，".join(f"{k}×{v}" for k, v in sorted(d.items()))
    print(f"第 {set_no} 套理论题通过：共 {len(theory)} 题")
    print(f"  模块：{show(by['module'])}")
    print(f"  难度：{show(by['difficulty'])}")
    print(f"  答案：{show(by['answer'])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--set", type=int, choices=SETS)
    parser.add_argument("--only-code", action="store_true", help="只验证编程题并打印统计，不读理论题、不写文件")
    parser.add_argument("--only-theory", action="store_true", help="只校验理论题并打印分布，不读编程题、不写文件")
    if "--show" in sys.argv:  # 辅助开关：同时打印样例期望输出
        sys.argv.remove("--show")
        SHOW_SAMPLES.add(True)
    args = parser.parse_args()
    blueprint = json.loads((DATA / "blueprint.json").read_text(encoding="utf-8"))
    (DATA / "sets").mkdir(parents=True, exist_ok=True)
    if args.only_code or args.only_theory:
        if not args.set:
            raise SystemExit("--only-code / --only-theory 需要用 --set 指定套号")
        (verify_code if args.only_code else verify_theory)(args.set, blueprint)
        return
    stems = {}
    drifted = False
    for set_no in SETS:
        if args.set and set_no != args.set:
            continue
        paper, stats = build_set(set_no, blueprint, stems)
        text = render(paper)
        target = DATA / "sets" / f"set-{set_no:02d}.json"
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                drifted = True
                print(f"漂移：{target.relative_to(ROOT)} 与源文件不一致，请重新运行 build.py")
            else:
                print(f"一致：set-{set_no:02d}.json（理论 {len(paper['theory'])} 题，编程 {len(paper['code'])} 题）")
        else:
            target.write_text(text, encoding="utf-8")
            alt_cases = sum(s["alt_checked"] for s in stats)
            fuzzed = sum(s["fuzzed"] for s in stats)
            negs = sum(s["negatives"] for s in stats)
            print(f"写出 {target.relative_to(ROOT)}：理论 {len(paper['theory'])} 题，编程 {len(paper['code'])} 题；"
                  f"独立实现核对 {alt_cases} 点，差分测试 {fuzzed} 轮，错解 {negs} 份")
    if drifted:
        sys.exit(1)


if __name__ == "__main__":
    main()
