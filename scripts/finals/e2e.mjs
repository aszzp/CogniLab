#!/usr/bin/env node
// 决赛模拟平台的端到端测试：对着一个正在运行的服务，把开考、草稿、判题、切屏、超时、交卷、成绩页走一遍。
//
// 用法：node scripts/finals/e2e.mjs <服务地址> <仓库根目录>
//   例：node scripts/finals/e2e.mjs http://localhost:3100 /tmp/cognilab-copy
//
// 注意：测试会写入作答记录，并且为了构造「已超时」场次会直接改 <仓库根目录>/data/cognilab.db，
// 所以请对着一份临时副本跑（rsync 时排除 .env.local 和 data/cognilab.db*），不要对着日常使用的库跑。
// 期望的总分、提交题数都按脚本里的作答与提交顺序推算，改动流程时记得同步修改。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [BASE, ROOT] = process.argv.slice(2);
if (!BASE || !ROOT) { console.error('用法：node scripts/finals/e2e.mjs <服务地址> <仓库根目录>'); process.exit(2); }

let passed = 0;
const failures = [];
const check = (condition, label, detail = '') => {
  if (condition) passed += 1;
  else { failures.push(label); console.error(`  ✗ ${label}${detail ? ` —— ${String(detail).slice(0, 400)}` : ''}`); }
};
const section = (title) => console.log(`\n# ${title}`);
const call = async (method, url, body) => {
  const started = Date.now();
  const res = await fetch(BASE + url, {
    method, headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: res.status, json, text, ms: Date.now() - started };
};
const post = (url, body) => call('POST', url, body);
/** 把期望输出写成 Python 字面量，用来测「只 print 不 return」的兜底。 */
const py = (v) => v === null ? 'None' : typeof v === 'boolean' ? (v ? 'True' : 'False')
  : typeof v === 'number' ? String(v) : typeof v === 'string' ? JSON.stringify(v)
    : Array.isArray(v) ? `[${v.map(py).join(', ')}]` : `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(', ')}}`;
const escaped = (text) => text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[ch]));

const setsDir = path.join(ROOT, 'data/finals/sets');
const papers = readdirSync(setsDir).filter((f) => /^set-0\d\.json$/.test(f)).sort()
  .map((f) => JSON.parse(readFileSync(path.join(setsDir, f), 'utf8')));
const blueprint = JSON.parse(readFileSync(path.join(ROOT, 'data/finals/blueprint.json'), 'utf8'));
console.log(`服务 ${BASE}，共 ${papers.length} 套卷：${papers.map((p) => p.id).join('、')}`);
const keyOf = (paper, index) => paper.code[index].key;
const wrongLetter = (answer) => (answer === 'A' ? 'B' : 'A');

// ---------------------------------------------------------------- 入参校验
section('入参校验');
check((await post('/api/finals/start', { setId: 'set-99', mode: 'strict' })).status === 404, '未知套卷 → 404');
check((await post('/api/finals/start', { setId: '../blueprint', mode: 'strict' })).status === 404, '路径形式的 setId → 404');
check((await post('/api/finals/start', { setId: 'set-01', mode: 'casual' })).status === 400, '非法模式 → 400');
check((await call('GET', '/api/finals/attempt/99999999')).status === 404, '不存在的场次 → 404');
check((await call('GET', '/api/finals/attempt/abc')).status === 404, '非数字场次号 → 404');
check((await post('/api/finals/judge', { problemKey: 's1-c99', code: 'def f(): pass', scope: 'full', attemptId: 1 })).status === 404, '不存在的题目 → 404');
check((await post('/api/finals/judge', { problemKey: 's1-c01', code: 123, scope: 'full', attemptId: 1 })).status === 400, '代码不是字符串 → 400');
check((await post('/api/finals/judge', { problemKey: 's1-c01', code: 'def f(): pass', scope: 'full' })).status === 400, '缺作答记录且非专项练习 → 400');
check((await call('PUT', '/api/finals/practice/s1-c99', { code: 'x' })).status === 404, '专项练习保存到不存在的题目 → 404');

// ---------------------------------------------------------------- 每套卷：参考解与起始模板走 HTTP 判题
const practiceAttempts = new Map();
for (const paper of papers) {
  section(`${paper.id}：7 道编程题走线上判题`);
  const started = await post('/api/finals/start', { setId: paper.id, mode: 'practice' });
  const id = started.json?.id;
  check(started.status === 200 && Number.isSafeInteger(id), '开考（练习模式）', started.text);
  practiceAttempts.set(paper.id, id);
  const state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.status === 'ongoing' && state.json?.deadlineAt === null, '练习模式不计时');
  check(Math.abs(state.json?.serverNow - Date.now()) < 5000, '返回服务器时间');
  for (const p of paper.code) {
    const ref = await post('/api/finals/judge', { problemKey: p.key, code: p.reference, scope: 'full', attemptId: id });
    check(ref.json?.passed === 10 && ref.json?.total === 10 && ref.json?.status === 'AC',
      `${p.no} ${p.title}：参考解 10/10`, JSON.stringify(ref.json?.results?.map((r) => `${r.status}${r.error ? `(${r.error})` : ''}`)));
    check(ref.json?.maxMs < 5000, `${p.no}：参考解最慢单点 < 5 秒`, ref.json?.maxMs);
    const template = await post('/api/finals/judge', { problemKey: p.key, code: p.starter, scope: 'full', attemptId: id });
    check(template.json?.passed === 0 && template.json?.total === 10, `${p.no}：起始模板 0/10`, template.text);
  }
}

// ---------------------------------------------------------------- 判题内核的各种出口
if (papers.length) {
  const paper = papers[0], p = paper.code[0];
  section('判题出口（专项练习口径）');
  const base = { problemKey: p.key, scope: 'sample', practice: true };
  const sample = await post('/api/finals/judge', { ...base, code: p.reference });
  check(sample.json?.scope === 'sample' && sample.json?.passed === 1 && sample.json?.total === 1, '自测运行只跑可见样例');
  check(JSON.stringify(sample.json?.results?.[0]?.expected) === JSON.stringify(p.samples[0].expected)
    && JSON.stringify(sample.json?.results?.[0]?.actual) === JSON.stringify(p.samples[0].expected), '自测返回期望输出与实际输出');
  const loop = await post('/api/finals/judge', { ...base, code: `def ${p.fn}(*args):\n    while True:\n        pass\n` });
  check(loop.json?.results?.[0]?.status === 'TLE' && loop.ms >= 4900 && loop.ms < 8000, '死循环 → 运行超时（约 5 秒）', `${loop.ms} 毫秒`);
  const syntax = await post('/api/finals/judge', { ...base, code: 'def broken(:\n    pass\n' });
  check(syntax.json?.results?.[0]?.status === 'RE' && /SyntaxError/.test(syntax.json?.results?.[0]?.error ?? ''), '语法错误 → 运行出错并给出原因', syntax.text);
  const renamed = await post('/api/finals/judge', { ...base, code: `def ${p.fn}_renamed(*args):\n    return None\n` });
  check(renamed.json?.results?.[0]?.status === 'RE' && /未找到函数/.test(renamed.json?.results?.[0]?.error ?? ''), '函数名写错 → 提示保留函数名', renamed.text);
  const printed = await post('/api/finals/judge', { ...base, code: `def ${p.fn}(*args):\n    print(${py(p.samples[0].expected)})\n` });
  check(printed.json?.passed === 1, '只 print 不 return 也能按字面量读结果', printed.text);
  const wrong = await post('/api/finals/judge', { ...base, code: `def ${p.fn}(*args):\n    return None\n` });
  check(wrong.json?.results?.[0]?.status === 'WA' && wrong.json?.results?.[0]?.actual === undefined, '返回值不对 → 答案错误', wrong.text);
  const full = await post('/api/finals/judge', { problemKey: p.key, code: p.starter, scope: 'full', practice: true });
  check(full.json?.total === 10 && JSON.stringify(full.json?.results?.[9]?.args) === JSON.stringify(p.cases[9].args)
    && JSON.stringify(full.json?.results?.[9]?.expected) === JSON.stringify(p.cases[9].expected)
    && full.json?.results?.every((r) => r.status === 'WA' && /没有返回值/.test(r.error ?? '')), '专项练习正式提交：逐点给出输入、期望与提示', JSON.stringify(full.json?.results?.[0]));
  const tuple = await post('/api/finals/judge', { problemKey: keyOf(paper, 0), scope: 'sample', practice: true,
    code: `${p.reference.replace(`def ${p.fn}(`, `def _origin(`)}\n\n\ndef ${p.fn}(*args):\n    return tuple(_origin(*args))\n` });
  check(tuple.json?.passed === 1, '返回元组按列表比较', tuple.text);
}

// ---------------------------------------------------------------- 全真模式：草稿、防泄漏、判分口径
if (papers.length) {
  const paper = papers[0];
  section('全真模式流程');
  const started = await post('/api/finals/start', { setId: paper.id, mode: 'strict' });
  const id = started.json?.id;
  check(started.status === 200 && Number.isSafeInteger(id), '开考（全真模式）', started.text);
  let state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.status === 'ongoing' && state.json?.deadlineAt - state.json?.startedAt === blueprint.exam.durationMin * 60 * 1000, '全真模式 180 分钟计时');
  check(JSON.stringify(state.json?.submissions) === '{}' && Object.keys(state.json?.answers ?? {}).length === 0, '开考时没有作答与提交记录');

  const page = await call('GET', `/finals/attempt/${id}`);
  const html = page.text;
  check(page.status === 200, '答题页可访问');
  check(!/"answer":"[A-D]"/.test(html) && !/\\"answer\\":\\"[A-D]\\"/.test(html) && !/"explanation"|"reference"|"cases"/.test(html)
    && !/\\"explanation\\"|\\"reference\\"|\\"cases\\"/.test(html), '答题页不含答案、解析、参考代码与隐藏测试点字段');
  check(paper.theory.every((q) => !html.includes(q.explanation) && !html.includes(escaped(q.explanation))), '答题页不含理论题解析');
  check(paper.code.every((q) => {
    const line = q.reference.split('\n')[1]?.trim();
    return !line || line.length < 12 || !html.includes(line);
  }), '答题页不含参考代码');
  check(paper.code.every((q) => !html.includes(JSON.stringify(q.cases.at(-1).args).slice(0, 80))), '答题页不含隐藏测试点');
  check(html.includes(paper.theory[0].stem.slice(0, 12)) && html.includes(paper.code[0].title), '答题页渲染了题目');

  const [first, second] = paper.theory;
  const answersA = { [first.key]: first.answer, [second.key]: wrongLetter(second.answer), 's1-t99': 'A', [paper.theory[2].key]: 'Z' };
  const saved = await call('PUT', `/api/finals/attempt/${id}`, { answers: answersA, rev: 10 });
  check(saved.status === 200 && saved.json?.ok === true, '保存草稿', saved.text);
  state = await call('GET', `/api/finals/attempt/${id}`);
  const stored = state.json?.answers ?? {};
  check(stored[first.key] === first.answer && stored[second.key] === wrongLetter(second.answer)
    && !('s1-t99' in stored) && !(paper.theory[2].key in stored), '非法题号与非法取值被丢弃，合法作答保留', JSON.stringify(stored));

  await call('PUT', `/api/finals/attempt/${id}`, { answers: { [first.key]: wrongLetter(first.answer) }, rev: 4 });
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.answers?.[first.key] === first.answer, '旧版本号的草稿不会覆盖新草稿');
  const newer = await call('PUT', `/api/finals/attempt/${id}`, { answers: { [first.key]: wrongLetter(first.answer) }, rev: 12 });
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(newer.json?.rev === 12 && state.json?.rev === 12 && state.json?.answers?.[first.key] === wrongLetter(first.answer), '新版本号的草稿生效，读取状态会返回当前版本号');
  await call('PUT', `/api/finals/attempt/${id}`, { answers: { [first.key]: first.answer }, rev: 11 });
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.answers?.[first.key] === wrongLetter(first.answer) && state.json?.rev === 12, '读取状态之后，旧版本号仍然被拒绝');
  const resumed = await call('PUT', `/api/finals/attempt/${id}`, { answers: { [first.key]: first.answer }, rev: state.json?.rev + 1 });
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(resumed.json?.rev === 13 && state.json?.answers?.[first.key] === first.answer, '刷新页面后从服务端版本号接着保存');

  const draft = await call('PUT', `/api/finals/attempt/${id}`, { code: { [paper.code[0].key]: 'def draft(): pass', bogus: 'x' } });
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(draft.status === 200 && state.json?.code?.[paper.code[0].key] === 'def draft(): pass' && !('bogus' in (state.json?.code ?? {})), '代码草稿保存');

  if (papers.length > 1) {
    const foreign = await post('/api/finals/judge', { problemKey: papers[1].code[0].key, code: papers[1].code[0].reference, scope: 'full', attemptId: id });
    check(foreign.status === 400, '不能提交别的套卷的题目 → 400', foreign.text);
  }

  const ref = await post('/api/finals/judge', { problemKey: paper.code[0].key, code: paper.code[0].reference, scope: 'full', attemptId: id });
  check(ref.json?.passed === 10 && ref.json?.results?.every((r) => !('args' in r) && !('expected' in r) && !('actual' in r) && !('error' in r) && !('stdout' in r)),
    '全真模式正式提交只给逐点结论，不透露用例', JSON.stringify(ref.json?.results?.[0]));
  check(typeof ref.json?.python === 'string' && ref.json?.submissions?.count === 1, '提交记录与解释器版本', ref.text?.slice(0, 200));
  const template = await post('/api/finals/judge', { problemKey: paper.code[0].key, code: paper.code[0].starter, scope: 'full', attemptId: id });
  check(template.json?.submissions?.count === 2 && template.json?.submissions?.history?.at(-1)?.passed === 0, '提交历史逐次累加');

  for (const p of paper.code.slice(1, 4)) {
    const r = await post('/api/finals/judge', { problemKey: p.key, code: p.reference, scope: 'full', attemptId: id });
    check(r.json?.passed === 10, `${p.no}：参考解 10/10`);
  }

  const answers = Object.fromEntries(paper.theory.map((q, i) => [q.key, i < 30 ? q.answer : wrongLetter(q.answer)]));
  await call('PUT', `/api/finals/attempt/${id}`, { answers, code: { [paper.code[0].key]: paper.code[0].reference } });

  const s1 = await post(`/api/finals/attempt/${id}/switch`, {});
  const s2 = await post(`/api/finals/attempt/${id}/switch`, {});
  check(s1.json?.count === 1 && s1.json?.finished === false && s2.json?.count === 2 && s2.json?.limit === 3 && s2.json?.finished === false, '前两次切屏只计数', `${s1.text} ${s2.text}`);
  const s3 = await post(`/api/finals/attempt/${id}/switch`, {});
  check(s3.json?.count === 3 && s3.json?.finished === true && s3.json?.status === 'finished', '第三次切屏自动交卷', s3.text);
  state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.status === 'finished' && Object.keys(state.json?.answers ?? {}).length === 50, '自动交卷时草稿仍在');
  check((await call('PUT', `/api/finals/attempt/${id}`, { answers, rev: 99 })).status === 409, '交卷后不能再保存 → 409');
  check((await post('/api/finals/judge', { problemKey: paper.code[6].key, code: paper.code[6].reference, scope: 'full', attemptId: id })).status === 409, '交卷后不能再提交 → 409');
  const again = await post(`/api/finals/attempt/${id}/switch`, {});
  check(again.json?.count === 3 && again.json?.finished === true, '交卷后切屏接口不再累加');
  const finish = await post(`/api/finals/attempt/${id}`, { action: 'finish', reason: 'manual', answers, code: {} });
  check(finish.json?.ok === true && finish.json?.autoClosed === true && finish.json?.endReason === 'switch', '补发的交卷请求告知已被自动收卷', finish.text);

  // 理论：前 30 题答对 = 18 分；编程：第 51 题最后一次提交是起始模板（0 分），52–54 满分 = 30 分
  const result = await call('GET', `/finals/result/${id}`);
  check(result.status === 200 && result.text.includes('>48</p>'), '成绩页总分 48（理论 18 + 编程 30）', result.text.match(/text-6xl[^>]*>[^<]*/)?.[0]);
  check(result.text.includes('切屏达到上限，答案已自动提交'), '成绩页标明切屏自动交卷');
  check(/答对\s*(<!--\s*-->\s*)?30/.test(result.text), '成绩页显示答对 30 题');
  check(/提交\s*(<!--\s*-->\s*)?4\s*(<!--\s*-->\s*)?\/\s*(<!--\s*-->\s*)?7/.test(result.text), '成绩页显示提交 4 题');
  check(result.text.includes(paper.theory[0].explanation.slice(0, 14)) && result.text.includes(paper.code[0].reference.split('\n')[1].trim()), '交卷后展示解析与参考代码');
  check((await call('GET', `/finals/attempt/${id}`)).text.includes('理论题回顾'), '已结束的场次从答题页转到成绩页');
}

// ---------------------------------------------------------------- 超时自动交卷
if (papers.length) {
  section('计时结束自动交卷');
  const paper = papers[0];
  const started = await post('/api/finals/start', { setId: paper.id, mode: 'strict' });
  const id = started.json?.id;
  await call('PUT', `/api/finals/attempt/${id}`, { answers: { [paper.theory[0].key]: paper.theory[0].answer } });
  const db = new DatabaseSync(path.join(ROOT, 'data/cognilab.db'));
  db.exec('PRAGMA busy_timeout = 8000');
  db.prepare('UPDATE finals_attempts SET deadline_at = ? WHERE id = ?').run(Date.now() - 1000, id);
  db.close();
  const state = await call('GET', `/api/finals/attempt/${id}`);
  check(state.json?.status === 'finished', '超过截止时间后读取即自动收卷', state.text);
  const finish = await post(`/api/finals/attempt/${id}`, { action: 'finish', reason: 'manual', answers: {}, code: {} });
  check(finish.json?.autoClosed === true && finish.json?.endReason === 'timeout', '收卷原因为超时', finish.text);
  const result = await call('GET', `/finals/result/${id}`);
  check(result.text.includes('计时结束，已自动交卷') && result.text.includes('>0.6</p>'), '成绩页标明超时并按已保存草稿判分（1 题 = 0.6 分）', result.text.match(/text-6xl[^>]*>[^<]*/)?.[0]);
}

// ---------------------------------------------------------------- 练习模式：不判切屏、可看错误
if (papers.length) {
  section('练习模式');
  const paper = papers[0], id = practiceAttempts.get(paper.id);
  for (let i = 0; i < 5; i++) await post(`/api/finals/attempt/${id}/switch`, {});
  const sw = await post(`/api/finals/attempt/${id}/switch`, {});
  check(sw.json?.count === 6 && sw.json?.finished === false, '练习模式切屏只计数、不交卷', sw.text);
  for (const p of paper.code.slice(1)) {
    await post('/api/finals/judge', { problemKey: p.key, code: p.reference, scope: 'full', attemptId: id });
  }
  const loop = await post('/api/finals/judge', { problemKey: paper.code[0].key, code: `def ${paper.code[0].fn}(*args):\n    while True:\n        pass\n`, scope: 'full', attemptId: id });
  check(loop.json?.passed === 0 && typeof loop.json?.results?.[0]?.error === 'string' && !('args' in loop.json.results[0]), '练习模式正式提交可看错误信息，但不给隐藏用例', JSON.stringify(loop.json?.results?.[0]));
  const finish = await post(`/api/finals/attempt/${id}`, { action: 'finish', reason: 'manual', answers: {}, code: {} });
  check(finish.json?.ok === true && finish.json?.endReason === 'manual' && finish.json?.autoClosed === false, '练习模式手动交卷', finish.text);
  const result = await call('GET', `/finals/result/${id}`);
  check(result.text.includes('练习模式') && result.text.includes('>60</p>'), '练习模式成绩页（第 51 题被死循环覆盖为 0 分，52–57 满分共 60 分）', result.text.match(/text-6xl[^>]*>[^<]*/)?.[0]);
}

// ---------------------------------------------------------------- 专项练习与入口页
section('专项练习与入口页');
if (papers.length) {
  const last = papers.at(-1).code.at(-1);
  const marker = `# E2E-MARKER-${Date.now()}`;
  const save = await call('PUT', `/api/finals/practice/${last.key}`, { code: `${marker}\n${last.reference}` });
  const page = await call('GET', `/finals/code/${last.key}`);
  check(save.status === 200 && page.status === 200 && page.text.includes(marker), '专项练习保存的代码在刷新后还在', `${save.status} ${page.status}`);
  const submit = await post('/api/finals/judge', { problemKey: last.key, code: last.reference, scope: 'full', practice: true });
  check(submit.json?.passed === 10, '专项练习正式提交');
  const list = await call('GET', '/finals/code');
  check(list.status === 200 && papers.every((p) => p.code.every((q) => list.text.includes(q.title))), '专项练习列表列出全部题目');
  const entry = await call('GET', '/finals');
  check(entry.status === 200 && papers.every((p) => entry.text.includes(p.title)), '决赛模拟入口页列出各套卷');
  const detail = await call('GET', `/finals/${papers.at(-1).id}`);
  check(detail.status === 200 && !detail.text.includes(papers.at(-1).theory[0].explanation.slice(0, 14)), '套卷详情页不泄露解析');
}

console.log(`\n${failures.length ? '未通过' : '全部通过'}：${passed} 项通过，${failures.length} 项失败`);
if (failures.length) { console.error(failures.map((f) => `  - ${f}`).join('\n')); process.exitCode = 1; }
