import { NextResponse } from 'next/server';
import { loadPaper } from '@/lib/finals-content';
import { startAttempt, type AttemptMode } from '@/lib/finals-store';

const MODES: AttemptMode[] = ['strict', 'practice'];

export async function POST(req: Request) {
  let input: { setId?: unknown; mode?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  if (typeof input?.setId !== 'string' || !loadPaper(input.setId)) {
    return NextResponse.json({ error: '套卷不存在' }, { status: 404 });
  }
  if (!MODES.includes(input.mode as AttemptMode)) return NextResponse.json({ error: '答题模式无效' }, { status: 400 });
  const attempt = startAttempt(input.setId, input.mode as AttemptMode);
  return NextResponse.json({ id: attempt.id });
}
