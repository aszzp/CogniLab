#!/usr/bin/env python3
"""理论题的独立盲答复核：把题目拆成不含答案的答卷，交给看不到答案的人作答，再与标准答案比对。

用法：
  python3 scripts/finals/blind-sheet.py make <输出目录>
      从 data/finals/theory/set-0N.json 生成 set-0N.questions.json（只有题干和选项）
  python3 scripts/finals/blind-sheet.py compare <答卷目录>
      读取答卷目录里的 set-0N.answers.json，逐题与标准答案比对，列出不一致和低置信度的题

答卷格式是 JSON 数组，每项 {"line": 行号, "answer": "A", "confidence": 0.95, "note": "可省略"}，
line 与 questions.json 里的 line 一致。答题的人只应读 questions.json，不要打开题库源文件。
比对结果需要人工过目：不一致说明题干可能有歧义或答案有误，低置信度的题值得再推敲。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THEORY = ROOT / "data" / "finals" / "theory"
LETTERS = "ABCD"


def make(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for set_no in range(1, 6):
        path = THEORY / f"set-{set_no:02d}.json"
        if not path.exists():
            continue
        questions = json.loads(path.read_text(encoding="utf-8"))
        sheet = [{"line": i + 2, "module": q["module"], "stem": q["stem"], "options": q["options"]}
                 for i, q in enumerate(questions)]
        (out / f"set-{set_no:02d}.questions.json").write_text(
            json.dumps(sheet, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{path.name} → set-{set_no:02d}.questions.json：{len(sheet)} 题")


def compare(answers_dir):
    total = flagged = mismatched = 0
    for set_no in range(1, 6):
        key_path = THEORY / f"set-{set_no:02d}.json"
        answer_path = Path(answers_dir) / f"set-{set_no:02d}.answers.json"
        if not key_path.exists() or not answer_path.exists():
            continue
        questions = json.loads(key_path.read_text(encoding="utf-8"))
        answers = {int(a["line"]): a for a in json.loads(answer_path.read_text(encoding="utf-8"))}
        for i, q in enumerate(questions):
            line = i + 2
            given = answers.get(line) or {}
            letter = str(given.get("answer", "?")).strip().upper()[:1]
            low = given.get("confidence", 1) < 0.9
            total += 1
            if letter == q["answer"] and not low:
                continue
            flagged += 1
            mismatched += letter != q["answer"]
            print(f"set-{set_no:02d} 第 {line} 行 [{q['module']}|{q['topic']}] 标准答案 {q['answer']} 盲答 {letter}"
                  f"{'  ← 不一致' if letter != q['answer'] else ''}{'  （盲答不确定）' if low else ''}")
            print(f"    题干：{q['stem']}")
            for k, option in enumerate(q["options"]):
                print(f"      {LETTERS[k]}{'*' if LETTERS[k] == q['answer'] else ' '} {option}")
            if given.get("note"):
                print(f"    盲答说明：{given['note']}")
    print(f"\n共 {total} 题，{mismatched} 题答案不一致，{flagged} 题需要人工过目")


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("make", "compare"):
        raise SystemExit(__doc__)
    (make if sys.argv[1] == "make" else compare)(sys.argv[2])


if __name__ == "__main__":
    main()
