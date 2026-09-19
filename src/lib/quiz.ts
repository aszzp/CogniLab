import { qAll } from './db';
import type { Question } from './types';

interface QRow {
  id: number; type: string; module: string; stem: string;
  options: string; answer: string; explanation: string; difficulty: number; source: string;
}

export function toQuestion(r: QRow): Question {
  return {
    id: r.id, type: r.type as Question['type'], module: r.module, stem: r.stem,
    options: JSON.parse(r.options) as string[], answer: r.answer,
    explanation: r.explanation, difficulty: r.difficulty, source: r.source,
  };
}

export function byModule(module: string, limit = 500): Question[] {
  return qAll<QRow>(
    'SELECT id, type, module, stem, options, answer, explanation, difficulty, source FROM questions WHERE module = ? ORDER BY id LIMIT ?',
    module, limit,
  ).map(toQuestion);
}

export function dueReview(limit = 100): Question[] {
  return qAll<QRow>(
    `SELECT q.id, q.type, q.module, q.stem, q.options, q.answer, q.explanation, q.difficulty, q.source
     FROM review_queue r JOIN questions q ON q.id = r.question_id
     WHERE r.due_at <= datetime('now','localtime')
     ORDER BY r.lapses DESC, r.due_at LIMIT ?`,
    limit,
  ).map(toQuestion);
}

/** 碎片化速刷：到期错题优先 + 薄弱模块补足 */
export function composeQuick(n = 10): Question[] {
  const due = dueReview(Math.min(6, n));
  const dueIds = new Set(due.map((q) => q.id));
  const need = n - due.length;

  // 薄弱模块：按最近一次作答正确率升序
  const weak = qAll<{ module: string }>(
    `SELECT q.module AS module FROM
       (SELECT question_id, is_correct FROM attempts a
        WHERE id = (SELECT MAX(id) FROM attempts b WHERE b.question_id = a.question_id)) t
     JOIN questions q ON q.id = t.question_id
     GROUP BY q.module ORDER BY AVG(t.is_correct) ASC LIMIT 1`,
  )[0]?.module;

  let fill: Question[] = [];
  if (need > 0 && weak) {
    fill = qAll<QRow>(
      `SELECT id, type, module, stem, options, answer, explanation, difficulty, source FROM questions
       WHERE module = ? AND id NOT IN (${dueIds.size ? [...dueIds].map(() => '?').join(',') : '0'})
       ${'ORDER BY RANDOM() LIMIT ?'}`,
      ...(dueIds.size ? [weak, ...dueIds, need] : [weak, need]),
    ).map(toQuestion);
  }
  if (fill.length < need) {
    const fillIds = [...dueIds, ...fill.map((q) => q.id)];
    const remaining = qAll<QRow>(
      `SELECT id, type, module, stem, options, answer, explanation, difficulty, source FROM questions
       WHERE id NOT IN (${fillIds.length ? fillIds.map(() => '?').join(',') : '0'})
       ORDER BY RANDOM() LIMIT ?`,
      ...fillIds, need - fill.length,
    ).map(toQuestion);
    fill = fill.concat(remaining);
  }
  return shuffle(due.concat(fill)).slice(0, n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
