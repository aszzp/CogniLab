import { NextResponse } from 'next/server';
import { findProblem } from '@/lib/finals-content';
import { ensureActive, recordPracticeResult, recordSubmission, savePracticeCode } from '@/lib/finals-store';
import { judgeProblem, pythonVersion, VERDICT_LABEL, type CaseResult } from '@/lib/python-judge.mjs';

const MAX_CODE = 200_000;

/** 自测运行只跑可见样例，把期望与实际输出都返回，便于对照题意排查。 */
function samplePayload(summary: Awaited<ReturnType<typeof judgeProblem>>, cases: { expected: unknown }[]) {
  const detail = (r: CaseResult, i: number) => ({
    status: r.status, ms: r.ms, expected: cases[i].expected, actual: r.actual, error: r.error, stdout: r.stdout,
  });
  return { scope: 'sample', passed: summary.passed, total: summary.total, results: summary.results.map(detail) };
}

/** 正式提交的反馈口径与官方平台一致：只告知通过几个测试点及出错类别，不透露隐藏用例与报错原因。 */
interface CaseRow {
  status: string; ms: number; args?: unknown; expected?: unknown; actual?: unknown; error?: string; stdout?: string;
}
function fullPayload(
  summary: Awaited<ReturnType<typeof judgeProblem>>,
  cases: { args: unknown[]; expected: unknown }[],
  { revealCases, revealErrors }: { revealCases: boolean; revealErrors: boolean },
) {
  const results: CaseRow[] = summary.results.map((r, i) => {
    const row: CaseRow = { status: r.status, ms: r.ms };
    if (revealErrors) row.error = r.error;
    if (revealCases) Object.assign(row, { args: cases[i].args, expected: cases[i].expected, actual: r.actual, stdout: r.stdout });
    return row;
  });
  return {
    scope: 'full', passed: summary.passed, total: summary.total, status: summary.status,
    label: VERDICT_LABEL[summary.status], maxMs: summary.maxMs, maxMemMb: summary.maxMemMb, results,
  };
}

export async function POST(req: Request) {
  let input: { problemKey?: unknown; code?: unknown; scope?: unknown; attemptId?: unknown; practice?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  if (typeof input?.problemKey !== 'string' || typeof input.code !== 'string') {
    return NextResponse.json({ error: 'problemKey或code格式错误' }, { status: 400 });
  }
  if (input.code.length > MAX_CODE) return NextResponse.json({ error: '代码过长' }, { status: 400 });
  const found = findProblem(input.problemKey);
  if (!found) return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  const scope = input.scope === 'sample' ? 'sample' : 'full';
  const cases = scope === 'sample' ? found.problem.samples : found.problem.cases;
  const summary = await judgeProblem({ code: input.code, fn: found.problem.fn, cases });

  if (input.practice === true) {
    // 专项练习：保存代码，正式提交后展示每个测试点的输入与期望
    savePracticeCode(input.problemKey, input.code);
    if (scope === 'full') recordPracticeResult(input.problemKey, summary.passed);
    return NextResponse.json(
      scope === 'sample' ? samplePayload(summary, cases) : fullPayload(summary, cases, { revealCases: true, revealErrors: true }),
    );
  }

  const attemptId = Number(input.attemptId);
  if (!Number.isSafeInteger(attemptId)) return NextResponse.json({ error: '缺少作答记录' }, { status: 400 });
  const current = ensureActive(attemptId);
  if (!current.attempt) return NextResponse.json({ error: '作答记录不存在' }, { status: 404 });
  if (!current.active) return NextResponse.json({ error: '作答已结束', finished: true }, { status: 409 });
  if (current.attempt.setId !== found.paper.id) return NextResponse.json({ error: '题目不属于本场作答' }, { status: 400 });
  if (scope === 'sample') return NextResponse.json(samplePayload(summary, cases));

  const submissions = recordSubmission(attemptId, input.problemKey, {
    passed: summary.passed, total: summary.total, status: summary.status,
    ms: summary.maxMs, memMb: summary.maxMemMb, at: Date.now(),
    statuses: summary.results.map((r) => r.status),
  });
  // 练习模式可以看到运行错误与超时信息；全真模式与正式赛一致，只给出结论
  const revealErrors = current.attempt.mode === 'practice';
  const payload = fullPayload(summary, cases, { revealCases: false, revealErrors });

  return NextResponse.json({ ...payload, python: await pythonVersion(), submissions });
}
