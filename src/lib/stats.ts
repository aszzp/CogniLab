import { qAll, qGet } from './db';
import type { ModuleStat } from './types';

export const MODULES = [
  '职业道德与基础知识', '数据处理与标注', '业务分析', '智能训练', '智能系统设计', '培训与指导', '数字人专项',
] as const;

export function moduleStats(): ModuleStat[] {
  const rows = qAll<{ module: string; total: number }>(
    `SELECT module, COUNT(*) AS total FROM questions GROUP BY module`,
  );
  // 每题取最近一次作答统计掌握度
  const latest = qAll<{ module: string; attempted: number; correct: number }>(
    `SELECT q.module AS module, COUNT(*) AS attempted, SUM(a.is_correct) AS correct
     FROM (SELECT question_id, is_correct FROM attempts a2
           WHERE id = (SELECT MAX(id) FROM attempts a3 WHERE a3.question_id = a2.question_id)) a
     JOIN questions q ON q.id = a.question_id
     GROUP BY q.module`,
  );
  const map = new Map(latest.map((r) => [r.module, r]));
  return MODULES.map((m) => {
    const t = rows.find((r) => r.module === m)?.total ?? 0;
    const a = map.get(m);
    return {
      module: m,
      total: t,
      attempted: a?.attempted ?? 0,
      correct: a?.correct ?? 0,
      accuracy: a?.attempted ? Math.round((a.correct / a.attempted) * 100) : 0,
    };
  }).filter((m) => m.total > 0);
}

export function dueCount(): number {
  const r = qGet<{ n: number }>(
    `SELECT COUNT(*) AS n FROM review_queue WHERE due_at <= datetime('now','localtime')`,
  );
  return r?.n ?? 0;
}

export function streakDays(): number {
  const days = qAll<{ d: string }>(
    `SELECT DISTINCT date(created_at) AS d FROM attempts ORDER BY d DESC`,
  );
  if (!days.length) return 0;
  const set = new Set(days.map((x) => x.d));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = today.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      today.setDate(today.getDate() - 1);
    } else break;
  }
  return streak;
}

export function weekActivity(): { date: string; count: number }[] {
  const rows = qAll<{ d: string; n: number }>(
    `SELECT date(created_at) AS d, COUNT(*) AS n FROM attempts
     WHERE created_at >= datetime('now','localtime','-6 days')
     GROUP BY date(created_at)`,
  );
  const map = new Map(rows.map((r) => [r.d, r.n]));
  const out: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, count: map.get(key) ?? 0 });
  }
  return out;
}

export function totalAttempts(): number {
  return qGet<{ n: number }>(`SELECT COUNT(*) AS n FROM attempts`)?.n ?? 0;
}

export function overallAccuracy(): number {
  const r = qGet<{ c: number; n: number }>(
    `SELECT SUM(is_correct) AS c, COUNT(*) AS n FROM attempts`,
  );
  return r?.n ? Math.round((r.c / r.n) * 100) : 0;
}

export const EXAM_DATE = '2026-10-15'; // 初赛（十月中旬，可在掌握新信息后调整）

export function daysToExam(): number {
  const diff = new Date(EXAM_DATE + 'T09:00:00').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400_000));
}
