import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { schedule } from '@/lib/srs';

export async function POST(req: Request) {
  const { question_id, user_answer, time_ms, mode } = await req.json();
  const q = qGet<{ answer: string }>('SELECT answer FROM questions WHERE id = ?', question_id);
  if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const norm = (s: string) => String(s || '').split('').sort().join('');
  const is_correct = norm(user_answer) === norm(q.answer) ? 1 : 0;
  qRun(
    'INSERT INTO attempts (question_id, user_answer, is_correct, time_ms, mode) VALUES (?,?,?,?,?)',
    question_id, String(user_answer ?? ''), is_correct, Math.min(time_ms | 0, 600000), mode || 'practice',
  );
  const prev = qGet<{ ease: number; interval_days: number; reps: number; lapses: number }>(
    'SELECT ease, interval_days, reps, lapses FROM review_queue WHERE question_id = ?', question_id,
  );
  const s = schedule(prev, !!is_correct);
  qRun(
    `INSERT INTO review_queue (question_id, ease, interval_days, reps, lapses, due_at, updated_at)
     VALUES (?,?,?,?,?,?, datetime('now','localtime'))
     ON CONFLICT(question_id) DO UPDATE SET
       ease = excluded.ease, interval_days = excluded.interval_days, reps = excluded.reps,
       lapses = excluded.lapses, due_at = excluded.due_at, updated_at = excluded.updated_at`,
    question_id, s.ease, s.interval_days, s.reps, s.lapses, s.due_at,
  );
  return NextResponse.json({ is_correct: !!is_correct, answer: q.answer });
}
