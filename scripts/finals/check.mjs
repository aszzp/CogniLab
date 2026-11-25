#!/usr/bin/env node
// 决赛模拟卷体检，三步：
//   1. 构建产物与源文件一致（build.py --check，内含参考解、独立实现、差分测试、错解区分度校验）
//   2. 卷面结构：题量、题号、模块配额、难度与答案分布、计分守恒
//   3. 用线上判题内核逐题实跑：参考解必须全过，起始模板必须不得分，死循环必须判超时
// 用法：node scripts/finals/check.mjs [--set N] [--skip-judge] [--report 文件]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeProblem } from '../../src/lib/python-judge.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'data', 'finals');

function parseArgs(argv) {
  const options = { set: undefined, skipJudge: false, report: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-judge') options.skipJudge = true;
    else if (a === '--set') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('--set 后需给出 1..5');
      options.set = n;
    } else if (a === '--report') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--report 后需给出文件路径');
      options.report = argv[++i];
    } else throw new Error(`未知参数 ${a}`);
  }
  return options;
}

const countBy = (items, field) => items.reduce((acc, row) => { acc[row[field]] = (acc[row[field]] ?? 0) + 1; return acc; }, {});
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;

function checkPaper(setNo, paper, blueprint) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(`第 ${setNo} 套：${message}`); };
  const { exam, modules, themes } = blueprint;
  const { theory, code } = paper;
  check(paper.id === `set-0${setNo}` && paper.no === setNo, '卷面 id / no 与套号不符');
  check(theory.length === exam.theory.count, `理论题应为 ${exam.theory.count} 题，实际 ${theory.length}`);
  check(code.length === exam.code.count, `编程题应为 ${exam.code.count} 题，实际 ${code.length}`);
  check(theory.length * exam.theory.pointsEach + code.length * exam.code.pointsEach === exam.totalScore, '分值合计与蓝图不符');
  const moduleKeys = new Set(modules.map((m) => m.key));
  theory.forEach((q, i) => {
    const label = `理论题第 ${i + 1} 题`;
    check(q.key === `s${setNo}-t${String(i + 1).padStart(2, '0')}` && q.no === i + 1, `${label}的 key / no 不连续`);
    check(moduleKeys.has(q.module), `${label}模块未知：${q.module}`);
    check(nonempty(q.stem), `${label}题干为空`);
    check(Array.isArray(q.options) && q.options.length === 4 && q.options.every(nonempty), `${label}选项不完整`);
    check(/^[ABCD]$/.test(q.answer), `${label}答案格式错误`);
    check(nonempty(q.explanation) && q.explanation.length >= 16, `${label}解析过短`);
  });
  const byModule = countBy(theory, 'module');
  for (const m of modules) check((byModule[m.key] ?? 0) === m.count, `模块「${m.key}」应为 ${m.count} 题，实际 ${byModule[m.key] ?? 0}`);
  const byDifficulty = countBy(theory, 'difficulty');
  for (const [level, count] of Object.entries(blueprint.difficulty)) check((byDifficulty[level] ?? 0) === count, `难度 ${level} 应为 ${count} 题，实际 ${byDifficulty[level] ?? 0}`);
  const [lo, hi] = blueprint.answerLetterRange;
  const letters = countBy(theory, 'answer');
  for (const letter of 'ABCD') check((letters[letter] ?? 0) >= lo && (letters[letter] ?? 0) <= hi, `答案 ${letter} 出现 ${letters[letter] ?? 0} 次，应在 ${lo}..${hi}`);
  code.forEach((p, i) => {
    const label = `编程题第 ${i + 1} 题（${p.no}）`;
    check(themes[i] && p.theme === themes[i].key && p.no === themes[i].no, `${label}与蓝图主题顺序不符`);
    check(p.key === `s${setNo}-c${String(i + 1).padStart(2, '0')}`, `${label}的 key 不符`);
    check(p.cases.length === exam.code.testPoints, `${label}应有 ${exam.code.testPoints} 个测试点，实际 ${p.cases.length}`);
    check(p.samples.length >= 1 && JSON.stringify(p.samples[0]) === JSON.stringify(p.cases[0]), `${label}可见样例必须与首个测试点一致`);
    check(p.cases.every((c) => Array.isArray(c.args) && c.args.length === p.params.length), `${label}测试点入参个数与参数表不符`);
    check(p.reference.includes(`def ${p.fn}(`), `${label}参考解缺少 ${p.fn}`);
    check(p.starter.includes(`def ${p.fn}(${p.params.join(', ')}):`), `${label}起始模板的函数签名不符`);
    for (const field of ['title', 'theme', 'ability', 'knowledge', 'fn', 'description', 'starter', 'reference', 'explanation']) check(nonempty(p[field]), `${label}缺少 ${field}`);
  });
  return errors;
}

async function checkJudge(setNo, paper) {
  const errors = [], timings = [];
  for (const p of paper.code) {
    const label = `第 ${setNo} 套 第 ${p.no} 题「${p.title}」`;
    const reference = await judgeProblem({ code: p.reference, fn: p.fn, cases: p.cases });
    if (reference.passed !== reference.total) {
      const bad = reference.results.map((r, i) => ({ no: i + 1, ...r })).find((r) => r.status !== 'AC');
      errors.push(`${label}：参考解未通过测试点 ${bad.no}（${bad.status}${bad.error ? `：${bad.error}` : ''}）`);
    }
    timings.push({ no: p.no, title: p.title, maxMs: reference.maxMs, maxMemMb: reference.maxMemMb });
    const starter = await judgeProblem({ code: p.starter, fn: p.fn, cases: p.cases });
    if (starter.passed !== 0) errors.push(`${label}：起始模板不应得分`);
  }
  return { errors, timings };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sets = options.set ? [options.set] : [1, 2, 3, 4, 5];
  const blueprint = JSON.parse(readFileSync(path.join(DATA, 'blueprint.json'), 'utf8'));
  const result = { ok: true, errors: [], warnings: [], build: null, sets: [] };
  const fail = (message) => { result.errors.push(message); };

  // 1. 构建产物与源文件一致（不带 --set 时 build.py 自己会检查全部套卷）
  const build = spawnSync('python3', ['-I', path.join(ROOT, 'scripts', 'finals', 'build.py'), '--check',
    ...(options.set ? ['--set', String(options.set)] : [])], { cwd: ROOT, encoding: 'utf8' });
  result.build = { status: build.status, output: `${build.stdout ?? ''}${build.stderr ?? ''}`.trim() };
  if (build.status !== 0) fail(`build.py --check 未通过（退出码 ${build.status}）：\n${result.build.output}`);
  for (const setNo of sets) {  // 生成物缺失或过期时 build.py 只报不断，这里让缺卷直接判失败
    if (!result.build.output.includes(`一致：set-0${setNo}.json`)) fail(`set-0${setNo}.json 未通过构建一致性检查`);
  }

  // 2. 卷面结构
  for (const setNo of sets) {
    const file = path.join(DATA, 'sets', `set-0${setNo}.json`);
    if (!existsSync(file)) { fail(`缺少 ${path.relative(ROOT, file)}，请先运行 build.py`); continue; }
    const paper = JSON.parse(readFileSync(file, 'utf8'));
    result.sets.push({ id: paper.id, title: paper.title, theory: paper.theory.length, code: paper.code.length, timings: [] });
    for (const message of checkPaper(setNo, paper, blueprint)) result.errors.push(message);
  }

  // 3. 线上判题内核实跑
  if (!options.skipJudge) {
    for (const entry of result.sets) {
      const paper = JSON.parse(readFileSync(path.join(DATA, 'sets', `${entry.id}.json`), 'utf8'));
      const { errors, timings } = await checkJudge(Number(entry.id.slice(-1)), paper);
      entry.timings = timings;
      result.errors.push(...errors);
    }
    const first = result.sets[0];
    if (first) {
      const paper = JSON.parse(readFileSync(path.join(DATA, 'sets', `${first.id}.json`), 'utf8'));
      const [p] = paper.code;
      const probe = await judgeProblem({ code: `def ${p.fn}(*args):\n    while True:\n        pass\n`, fn: p.fn, cases: [p.cases[0]] });
      if (probe.status !== 'TLE') fail(`死循环应判运行超时，实际 ${probe.status}`);
    }
  }
  for (const entry of result.sets) {
    for (const t of entry.timings) {
      if (t.maxMs > 2500) result.warnings.push(`第 ${entry.id} 套第 ${t.no} 题参考解最慢单点 ${t.maxMs} 毫秒，接近 5 秒上限`);
    }
  }
  result.ok = result.errors.length === 0;
  if (options.report) writeFileSync(options.report, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(result.build.output);
  for (const entry of result.sets) {
    const slowest = entry.timings ? entry.timings.reduce((m, t) => Math.max(m, t.maxMs), 0) : null;
    console.log(`${entry.id}（${entry.title}）：理论 ${entry.theory} 题，编程 ${entry.code} 题${slowest === null ? '' : `，参考解最慢单点 ${slowest} 毫秒`}`);
  }
  for (const warning of result.warnings) console.warn(`提示：${warning}`);
  for (const message of result.errors) console.error(`错误：${message}`);
  console.log(result.ok ? `决赛模拟卷体检通过（${result.sets.length} 套）` : `决赛模拟卷体检未通过：${result.errors.length} 处问题`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => { console.error(`决赛模拟卷体检失败: ${error.message}`); process.exitCode = 1; });
