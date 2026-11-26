import { NextResponse } from 'next/server';
import { findGymDrill } from '@/lib/gym/content';
import { judgeProblem, pythonVersion, VERDICT_LABEL } from '@/lib/python-judge.mjs';
import { recordGymAttempt } from '@/lib/gym/store';

const MAX_CODE = 20_000;
const MAX_LATENCY_MS = 3_600_000;
const SAMPLE_SIZE = 3;

/** Fisher-Yates 洗牌后取前 count 个；用例不足时全部使用。 */
function sampleCases<T>(cases: readonly T[], count: number): T[] {
  const out = [...cases];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, Math.min(count, out.length));
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }

  const input = raw as { itemKey?: unknown; drillId?: unknown; code?: unknown; latencyMs?: unknown };
  if (typeof input.itemKey !== 'string' || typeof input.drillId !== 'string' || typeof input.code !== 'string') {
    return NextResponse.json({ error: 'itemKey、drillId或code格式错误' }, { status: 400 });
  }
  if (!input.code.trim()) return NextResponse.json({ error: '代码不能为空' }, { status: 400 });
  if (input.code.length > MAX_CODE) {
    return NextResponse.json({ error: '代码过长（最多 20000 字符）' }, { status: 400 });
  }

  const found = findGymDrill(input.itemKey, input.drillId);
  if (!found || found.drill.type !== 'code') {
    return NextResponse.json({ error: '练习不存在' }, { status: 404 });
  }

  const { item, drill } = found;
  const cases = sampleCases(drill.cases, SAMPLE_SIZE);

  let summary: Awaited<ReturnType<typeof judgeProblem>>;
  try {
    summary = await judgeProblem({ code: input.code, fn: drill.fn, cases });
  } catch (e) {
    return NextResponse.json({ error: `判题服务异常：${String(e)}` }, { status: 503 });
  }
  // 判题进程自身出错（例如 Python 不可用）不算一次作答，避免误扣掌握度。
  if (summary.status === 'SE') {
    return NextResponse.json({ error: '判题服务异常，请稍后重试' }, { status: 503 });
  }

  const latencyMs = typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
    ? Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(input.latencyMs)))
    : 0;
  const progress = recordGymAttempt({
    itemKey: item.key,
    drillId: drill.id,
    type: 'code',
    correct: summary.passed === summary.total,
    latencyMs,
    trap: drill.trap,
  });

  return NextResponse.json({
    passed: summary.passed,
    total: summary.total,
    status: summary.status,
    label: VERDICT_LABEL[summary.status],
    results: summary.results.map((r, i) => ({
      status: r.status,
      ms: r.ms,
      args: cases[i]?.args,
      expected: cases[i]?.expected,
      actual: r.actual,
      error: r.error,
    })),
    python: await pythonVersion(),
    explain: drill.explain,
    progress,
  });
}
