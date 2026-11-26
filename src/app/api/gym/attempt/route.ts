import { NextResponse } from 'next/server';
import { findGymDrill } from '@/lib/gym/content';
import { fillCorrect, mcqCorrect } from '@/lib/gym/grade';
import { recordGymAttempt } from '@/lib/gym/store';

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
  const input = raw as { itemKey?: unknown; drillId?: unknown; answer?: unknown; latencyMs?: unknown };
  if (typeof input.itemKey !== 'string' || typeof input.drillId !== 'string') {
    return NextResponse.json({ error: 'itemKey或drillId格式错误' }, { status: 400 });
  }
  const found = findGymDrill(input.itemKey, input.drillId);
  if (!found) return NextResponse.json({ error: '练习不存在' }, { status: 404 });
  const { item, drill } = found;
  if (drill.type === 'code') {
    return NextResponse.json({ error: '代码题请提交到 /api/gym/run' }, { status: 400 });
  }

  let correct: boolean;
  if (drill.type === 'mcq') {
    if (typeof input.answer !== 'number' || !Number.isInteger(input.answer)) {
      return NextResponse.json({ error: '答案格式错误' }, { status: 400 });
    }
    correct = mcqCorrect(drill, input.answer);
  } else {
    if (!Array.isArray(input.answer) || !input.answer.every((v) => typeof v === 'string')) {
      return NextResponse.json({ error: '答案格式错误' }, { status: 400 });
    }
    correct = fillCorrect(drill, input.answer as string[]);
  }

  const latencyMs = typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
    ? Math.min(3_600_000, Math.max(0, Math.round(input.latencyMs)))
    : 0;
  const progress = recordGymAttempt({
    itemKey: item.key,
    drillId: drill.id,
    type: drill.type,
    correct,
    latencyMs,
    trap: drill.trap,
  });
  return NextResponse.json({ correct, explain: drill.explain, progress });
}
