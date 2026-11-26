#!/usr/bin/env node
/**
 * 实操道场内容体检。
 *
 *   node scripts/gym/check.mjs             # 结构 + 判题实跑
 *   node scripts/gym/check.mjs --skip-judge
 *
 * 做四件事：结构校验、空位/选项校验、参考解实跑、每个模式卡的最低题型覆盖。
 * 内容源是 TS；先用 tsc 编译到临时目录，再加载编译产物，避免依赖额外运行时。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP_JUDGE = process.argv.includes('--skip-judge');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'cognilab-gym-'));

const problems = [];
const warn = [];
function bad(message) { problems.push(message); }

try {
  execFileSync('npx', [
    'tsc', 'src/lib/gym/content.ts',
    '--outDir', OUT,
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'es2022',
    '--esModuleInterop',
    '--skipLibCheck',
    '--strict', 'false',
  ], { cwd: ROOT, stdio: 'pipe' });

  const require = createRequire(import.meta.url);
  const { GYM_ITEMS } = require(path.join(OUT, 'content.js'));
  const { judgeProblem, pythonVersion } = await import(path.join(ROOT, 'src/lib/python-judge.mjs'));

  const patterns = GYM_ITEMS.filter((i) => i.kind === 'pattern');
  const idioms = GYM_ITEMS.filter((i) => i.kind === 'idiom');
  const itemKeys = new Set();
  const drillIds = new Set();
  const orders = new Set();
  const VISUALS = new Set(['critical-path', 'vote-merge', 'leakage', 'capacity', 'threshold', 'allocation', 'alerts', 'idiom']);

  for (const item of GYM_ITEMS) {
    if (itemKeys.has(item.key)) bad(`重复条目 key：${item.key}`);
    itemKeys.add(item.key);
    if (orders.has(item.order)) bad(`重复 order：${item.order}（${item.key}）`);
    orders.add(item.order);
    if (!item.title || !item.subtitle || !item.summary) bad(`${item.key} 缺少标题/副标题/摘要`);
    if (!item.sections?.length) bad(`${item.key} 没有讲解段落`);
    if (!VISUALS.has(item.visual)) bad(`${item.key} 可视化 key 未注册：${item.visual}`);
    if (!item.drills?.length) bad(`${item.key} 没有练习`);

    const counts = { mcq: 0, fill: 0, code: 0 };
    for (const drill of item.drills) {
      if (drillIds.has(drill.id)) bad(`重复练习 id：${drill.id}`);
      drillIds.add(drill.id);
      counts[drill.type] += 1;
      if (!drill.prompt || !drill.explain) bad(`${drill.id} 缺少题干/解析`);
      if (drill.type === 'mcq') {
        if (!Array.isArray(drill.options) || drill.options.length < 2) bad(`${drill.id} 选项不足`);
        if (!Number.isInteger(drill.answer) || drill.answer < 0 || drill.answer >= drill.options.length) {
          bad(`${drill.id} 答案下标越界`);
        }
      } else {
        const source = drill.type === 'fill' ? drill.code : drill.starter;
        const holes = (source.match(/___/g) ?? []).length;
        if (holes !== drill.blanks.length) bad(`${drill.id} 空位 ${holes} 个，但 blanks 有 ${drill.blanks.length} 个`);
        if (!drill.blanks.every((b) => Array.isArray(b.answers) && b.answers.length > 0)) bad(`${drill.id} 有空答案`);
        if (drill.type === 'code') {
          if (!source.includes(`def ${drill.fn}(`)) bad(`${drill.id} 缺少函数定义 def ${drill.fn}(`);
          if (!Array.isArray(drill.cases) || drill.cases.length < 2) bad(`${drill.id} 测试用例少于 2 个`);
        }
      }
    }
    if (item.kind === 'pattern') {
      if (counts.mcq < 2) warn.push(`${item.key} 只有 ${counts.mcq} 道单选`);
      if (counts.fill < 2) warn.push(`${item.key} 只有 ${counts.fill} 道填空`);
      if (counts.code < 1) bad(`${item.key} 缺少代码题`);
    } else {
      if (counts.mcq < 1) bad(`${item.key} 缺少单选`);
      if (counts.fill < 1) bad(`${item.key} 缺少填空`);
    }
  }

  if (patterns.length !== 7) bad(`七式应有 7 个，实际 ${patterns.length}`);
  if (idioms.length !== 10) bad(`惯用法应有 10 个，实际 ${idioms.length}`);

  console.log(`条目 ${GYM_ITEMS.length}（七式 ${patterns.length} / 惯用法 ${idioms.length}），练习 ${drillIds.size} 道`);
  console.log(`判题环境：Python ${await pythonVersion()}`);
  for (const item of GYM_ITEMS) {
    const counts = { mcq: 0, fill: 0, code: 0 };
    for (const d of item.drills) counts[d.type] += 1;
    console.log(`  ${String(item.order).padStart(2, '0')} ${item.title.padEnd(18, ' ')} 单选 ${counts.mcq} / 填空 ${counts.fill} / 代码 ${counts.code}`);
  }

  if (!SKIP_JUDGE) {
    const codeDrills = GYM_ITEMS.flatMap((item) => item.drills.filter((d) => d.type === 'code'));
    for (const drill of codeDrills) {
      const parts = drill.starter.split('___');
      let code = parts[0];
      for (let i = 1; i < parts.length; i++) code += drill.blanks[i - 1].answers[0] + parts[i];
      const summary = await judgeProblem({ code, fn: drill.fn, cases: drill.cases, concurrency: 2 });
      const ok = summary.passed === summary.total;
      console.log(`  ${ok ? '✓' : '✗'} ${drill.id} ${summary.passed}/${summary.total}`);
      if (!ok) bad(`${drill.id} 参考解只过 ${summary.passed}/${summary.total}：${summary.results.map((r) => r.status).join(',')}`);
    }
  } else {
    console.log('  （--skip-judge：跳过判题实跑）');
  }

  for (const w of warn) console.log(`  ! ${w}`);
  console.log(problems.length ? `\n体检失败：${problems.length} 个问题` : '\n体检通过');
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = problems.length ? 1 : 0;
} finally {
  fs.rmSync(OUT, { recursive: true, force: true });
}
