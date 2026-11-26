import { NextResponse } from 'next/server';
import { findGymDrill } from '@/lib/gym/content';
import { judgeProblem, pythonVersion, VERDICT_LABEL } from '@/lib/python-judge.mjs';
import { recordGymAttempt } from '@/lib/gym/store';

const MAX_CODE = 200_000;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }
  const input = raw as { itemKey?: unknown; drillId?: unknown; code?: unknown; latencyMs?: unknown };
  if (typeof input.itemKey !== 'string' || typeof input.drillId !== 'string' || typeof input.code !== 'string') {
    return NextResponse.json({ error: 'itemKey、drillId或code格式错误' }, { status: 400 });
  }
  if (!input.code.trim()) return NextResponse.json({ error: '代码不能为空' }, { status: 400 });
  if (input.code.length > MAX_CODE) return NextResponse.json({ error: '代码过长' }, { status: 400 });

  const found = findGymDrill(input.itemKey, input.drillId);
  if (!found || found.drill.type !== 'code') {
    return NextResponse.json({ error: '练习不存在' }, { status: 404 });
  }
  if (input.code.includes('___')) return NextResponse.json({ error: '还有空位没有填写' }, { status: 400 });

  const { item, drill } = found;
  let summary: Awaited<ReturnType<typeof judgeProblem>>;
  try {
    summary = await judgeProblem({ code: input.code, fn: drill.fn, cases: drill.cases });
  } catch (e) {
    return NextResponse.json({ error: `判题服务异常：${String(e)}` }, { status: 503 });
  }
  // 判题进程自身出错（例如 Python 不可用）不算一次作答，避免误扣掌握度。
  if (summary.status === 'SE') {
    return NextResponse.json({ error: '判题服务异常，请稍后重试' }, { status: 503 });
  }

  const latencyMs = typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
    ? Math.min(3_600_000, Math.max(0, Math.round(input.latencyMs)))
    : 0;
  const correct = summary.total > 0 && summary.passed === summary.total;
  const progress = recordGymAttempt({
    itemKey: item.key,
    drillId: drill.id,
    type: 'code',
    correct,
    latencyMs,
    trap: drill.trap,
  });

  return NextResponse.json({
    scope: 'gym',
    passed: summary.passed,
    total: summary.total,
    status: summary.status,
    label: VERDICT_LABEL[summary.status],
    maxMs: summary.maxMs,
    maxMemMb: summary.maxMemMb,
    results: summary.results.map((r, i) => ({
      status: r.status,
      ms: r.ms,
      args: drill.cases[i]?.args,
      expected: drill.cases[i]?.expected,
      actual: r.actual,
      error: r.error,
      stdout: r.stdout,
    })),
    python: await pythonVersion(),
    explain: drill.explain,
    progress,
  });
}
