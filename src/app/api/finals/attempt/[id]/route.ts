import { NextResponse } from 'next/server';
import { ensureActive, finishAttempt, saveDraft, type EndReason } from '@/lib/finals-store';

const REASONS: EndReason[] = ['manual'];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attemptId = Number(id);
  // 全真模式下若已超时，这次读取会先把场次收尾，前端拿到 finished 后直接跳成绩页
  const { attempt } = ensureActive(attemptId);
  if (!attempt) return NextResponse.json({ error: '作答记录不存在' }, { status: 404 });
  return NextResponse.json({
    id: attempt.id, status: attempt.status, startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt,
    answers: attempt.answers, code: attempt.code, submissions: attempt.submissions, switchCount: attempt.switchCount,
    rev: attempt.rev, serverNow: Date.now(),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let input: { answers?: unknown; code?: unknown; rev?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  const state = saveDraft(Number(id), input ?? {});
  if (!state.attempt) return NextResponse.json({ error: '作答记录不存在' }, { status: 404 });
  if (!state.active) return NextResponse.json({ error: '作答已结束', finished: true }, { status: 409 });
  return NextResponse.json({ ok: true, serverNow: Date.now(), switchCount: state.attempt.switchCount, rev: state.attempt.rev });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let input: { action?: unknown; reason?: unknown; answers?: unknown; code?: unknown };
  try { input = await req.json(); } catch { return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 }); }
  if (input?.action !== 'finish') return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
  const reason = REASONS.includes(input.reason as EndReason) ? (input.reason as EndReason) : 'manual';
  // 交卷前把前端手里的最新草稿落库，避免自动保存的节流窗口里的内容丢失
  const state = saveDraft(Number(id), { answers: input.answers, code: input.code });
  const attempt = finishAttempt(Number(id), reason);
  if (!attempt) return NextResponse.json({ error: '作答记录不存在' }, { status: 404 });
  return NextResponse.json({ ok: true, id: attempt.id, endReason: attempt.endReason, autoClosed: !state.active });
}
