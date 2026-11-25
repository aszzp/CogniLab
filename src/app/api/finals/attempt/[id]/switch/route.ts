import { NextResponse } from 'next/server';
import { loadBlueprint } from '@/lib/finals-content';
import { recordSwitch } from '@/lib/finals-store';

/** 页面转入后台时由答题页调用；全真模式下累计达到上限即自动交卷。 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = recordSwitch(Number(id));
  if (!result.attempt) return NextResponse.json({ error: '作答记录不存在' }, { status: 404 });
  const { exam } = loadBlueprint();
  return NextResponse.json({
    count: result.attempt.switchCount,
    limit: exam.switchLimit,
    finished: result.attempt.status === 'finished',
    status: result.attempt.status,
  });
}
