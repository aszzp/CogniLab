import { NextResponse } from 'next/server';
import { qGet, qRun, qAll } from '@/lib/db';
import { schedule } from '@/lib/srs';

interface Row {
  id: number;
  mode: string;
  question_ids: string;
  answers: string | null;
  score: number | null;
  total: number | null;
  correct: number | null;
  duration_sec: number | null;
  finished_at: string | null;
}

function loadExam(id: number) {
  return qGet<Row>('SELECT * FROM exams WHERE id = ?', id);
}

function loadQuestions(ids: number[]) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const rows = qAll<{
    id: number; type: string; module: string; stem: string;
    options: string; answer: string; explanation: string; source: string;
  }>(`SELECT id, type, module, stem, options, answer, explanation, source FROM questions WHERE id IN (${ph})`, ...ids);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => {
    const r = map.get(i)!;
    return { ...r, options: JSON.parse(r.options) as string[] };
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = loadExam(Number(id));
  if (!exam) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const questions = loadQuestions(JSON.parse(exam.question_ids));
  if (exam.finished_at) {
    return NextResponse.json({ finished: true, exam, questions });
  }
  // 考试中不下发答案
  return NextResponse.json({
    finished: false,
    questions: questions.map((q) => ({ ...q, answer: '', explanation: '' })),
    plan: { sec: exam.duration_sec },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = loadExam(Number(id));
  if (!exam) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (exam.finished_at) return NextResponse.json({ error: 'already submitted' }, { status: 400 });
  const { answers, durationSec } = await req.json();
  const questions = loadQuestions(JSON.parse(exam.question_ids));
  const norm = (s: string) => String(s || '').split('').sort().join('');

  const per = questions.map((q) => {
    const ua = String(answers?.[q.id] ?? '');
    const correct = norm(ua) === norm(q.answer);
    // 写作答记录 + 更新复习队列
    qRun('INSERT INTO attempts (question_id, user_answer, is_correct, mode) VALUES (?,?,?,?)',
      q.id, ua, correct ? 1 : 0, 'exam');
    const prev = qGet<{ ease: number; interval_days: number; reps: number; lapses: number }>(
      'SELECT ease, interval_days, reps, lapses FROM review_queue WHERE question_id = ?', q.id);
    const s = schedule(prev, correct);
    qRun(
      `INSERT INTO review_queue (question_id, ease, interval_days, reps, lapses, due_at, updated_at)
       VALUES (?,?,?,?,?,?, datetime('now','localtime'))
       ON CONFLICT(question_id) DO UPDATE SET ease=excluded.ease, interval_days=excluded.interval_days,
       reps=excluded.reps, lapses=excluded.lapses, due_at=excluded.due_at, updated_at=excluded.updated_at`,
      q.id, s.ease, s.interval_days, s.reps, s.lapses, s.due_at);
    return { id: q.id, module: q.module, stem: q.stem, userAnswer: ua, answer: q.answer, explanation: q.explanation, correct };
  });

  const correct = per.filter((p) => p.correct).length;
  const score = per.length ? Math.round((correct / per.length) * 100) : 0;
  qRun('UPDATE exams SET answers=?, score=?, total=?, correct=?, duration_sec=?, finished_at=datetime(\'now\',\'localtime\') WHERE id=?',
    JSON.stringify(answers ?? {}), score, per.length, correct, durationSec | 0, exam.id);

  const byModule: Record<string, { c: number; n: number }> = {};
  for (const p of per) {
    byModule[p.module] = byModule[p.module] || { c: 0, n: 0 };
    byModule[p.module].n++;
    if (p.correct) byModule[p.module].c++;
  }

  return NextResponse.json({ score, total: per.length, correct, byModule, per });
}
