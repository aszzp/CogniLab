import { NextResponse } from 'next/server';
import { findProblem } from '@/lib/finals-content';
import { savePracticeCode } from '@/lib/finals-store';

/** 编程题专项练习的草稿保存。 */
export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!findProblem(key)) return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  let input: { code?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  if (typeof input?.code !== 'string' || input.code.length > 200_000) {
    return NextResponse.json({ error: 'code格式错误' }, { status: 400 });
  }
  savePracticeCode(key, input.code);
  return NextResponse.json({ ok: true });
}
