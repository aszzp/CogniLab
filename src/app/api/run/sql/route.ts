import { NextResponse } from 'next/server';
import { qGet } from '@/lib/db';
import { gradeSql, type SqlMeta } from '@/lib/sql-grading.mjs';

export async function POST(req: Request) {
  let input: { taskId?: unknown; code?: unknown };
  try { input = await req.json(); }
  catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || !Number.isSafeInteger(input.taskId) || Number(input.taskId) <= 0 || typeof input.code !== 'string') {
    return NextResponse.json({ error: 'taskId或code格式错误' }, { status: 400 });
  }
  const task = qGet<{ kind: string; meta: string }>('SELECT kind,meta FROM tasks WHERE id=?', Number(input.taskId));
  if (!task) return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  if (task.kind !== 'sql') return NextResponse.json({ error: '该题不是SQL任务' }, { status: 400 });
  try {
    return NextResponse.json(gradeSql(JSON.parse(task.meta) as SqlMeta, input.code));
  } catch (error) {
    return NextResponse.json({ error: `SQL检查失败：${error instanceof Error ? error.message.slice(0, 200) : '未知错误'}` });
  }
}
