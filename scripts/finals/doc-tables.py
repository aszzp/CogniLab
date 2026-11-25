#!/usr/bin/env python3
"""把卷面数据回填进 docs/05-决赛命题分析与模拟卷设计.md 的表格占位符。

用法：python3 scripts/finals/doc-tables.py

占位符是 HTML 注释（<!-- CODE_TABLE -->、<!-- THEORY_TABLES -->），每次运行整段替换，
改了题库之后重跑一遍，文档里的表格就和 data/finals/sets/ 保持一致。
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "finals"
DOC = ROOT / "docs" / "05-决赛命题分析与模拟卷设计.md"
NUMERALS = "一二三四五"
ORIGIN = {"prelim": "（初赛原题）", "prelim_adapted": "（据初赛题改编）"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def cell(lines):
    return "<br>".join(lines)


def code_table(blueprint, sets):
    head = "| 题号 | 官方主题 | " + " | ".join(f"第{NUMERALS[i]}套" for i in range(5)) + " |"
    rule = "|" + "---|" * 7
    rows = []
    for index, theme in enumerate(blueprint["themes"]):
        columns = []
        for paper in sets:
            if paper is None:
                columns.append("—")
                continue
            problem = paper["code"][index]
            columns.append(cell([f"**{problem['title']}**", f"`{problem['fn']}`",
                                 f"{problem['ability']} · {problem['knowledge']}"]))
        rows.append(f"| {theme['no']} | {theme['label']} | " + " | ".join(columns) + " |")
    return "\n".join([head, rule, *rows])


def theory_tables(blueprint, sets):
    head = "| 模块 | " + " | ".join(f"第{NUMERALS[i]}套" for i in range(5)) + " |"
    rule = "|" + "---|" * 6
    rows = []
    for module in blueprint["modules"]:
        columns = []
        for paper in sets:
            if paper is None:
                columns.append("—")
                continue
            items = [f"{q['topic']}{'★' * q['difficulty']}{ORIGIN.get(q['origin'], '')}"
                     for q in sorted(paper["theory"], key=lambda q: (q["difficulty"], q["topic"]))
                     if q["module"] == module["key"]]
            columns.append(cell(items) if items else "—")
        rows.append(f"| {module['key']}（{module['count']} 题） | " + " | ".join(columns) + " |")
    note = ["", "难度：★ 记忆识别，★★ 理解应用，★★★ 分析计算。"]
    return "\n".join([head, rule, *rows, *note])


def replace(text, marker, table):
    """首次运行把简单占位符换成带起止标记的表格；之后再运行就整段替换起止标记之间的内容。"""
    begin, end = f"<!-- {marker}:BEGIN -->", f"<!-- {marker}:END -->"
    block = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.S)
    if len(block.findall(text)) == 1:
        return block.sub(lambda _: f"{begin}\n{table}\n{end}", text)
    token = f"<!-- {marker} -->"
    if text.count(token) == 1:
        return text.replace(token, f"{begin}\n{table}\n{end}")
    raise SystemExit(f"文档里应当有且只有一个 {token}（或一对 {marker}:BEGIN / :END）")


def main():
    blueprint = load(DATA / "blueprint.json")
    sets = [load(DATA / "sets" / f"set-{n:02d}.json") for n in range(1, 6)]
    if sets[0] is None:
        raise SystemExit("还没有构建任何套卷，请先运行 scripts/finals/build.py")
    text = DOC.read_text(encoding="utf-8")
    text = replace(text, "CODE_TABLE", code_table(blueprint, sets))
    text = replace(text, "THEORY_TABLES", theory_tables(blueprint, sets))
    DOC.write_text(text, encoding="utf-8")
    built = [paper["id"] for paper in sets if paper]
    print(f"已回填 {DOC.relative_to(ROOT)}（已构建：{', '.join(built)}）")


if __name__ == "__main__":
    main()
