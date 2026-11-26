import { db, qAll, qGet, qRun } from '../db';
import type { GymAttemptInput, GymProgress } from './types';

interface ProgressRow {
  item_key: string;
  mastery: number;
  streak: number;
  seen: number;
  correct: number;
  last_result: string | null;
  next_review_at: number | null;
  updated_at: string | null;
}

function toProgress(row: ProgressRow): GymProgress {
  return {
    itemKey: row.item_key,
    mastery: row.mastery,
    streak: row.streak,
    seen: row.seen,
    correct: row.correct,
    lastResult: row.last_result === 'correct' || row.last_result === 'wrong' ? row.last_result : null,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at).toISOString() : null,
    updatedAt: row.updated_at,
  };
}

export function gymProgressRows(): GymProgress[] {
  return qAll<ProgressRow>('SELECT * FROM gym_progress ORDER BY updated_at DESC').map(toProgress);
}

export function gymProgress(itemKey: string): GymProgress | undefined {
  const row = qGet<ProgressRow>('SELECT * FROM gym_progress WHERE item_key = ?', itemKey);
  return row ? toProgress(row) : undefined;
}

const REVIEW_INTERVAL_MS = [
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
];

/** 记录一次练习，并按「连续答对次数」安排下次复习。 */
export function recordGymAttempt(input: GymAttemptInput): GymProgress {
  const now = Date.now();
  const prev = gymProgress(input.itemKey);
  const seen = (prev?.seen ?? 0) + 1;
  const correct = (prev?.correct ?? 0) + (input.correct ? 1 : 0);
  const streak = input.correct ? (prev?.streak ?? 0) + 1 : 0;
  // 答错要立刻退出「已掌握」区间，否则 5→4 仍会被列表标成已掌握。
  const mastery = input.correct
    ? Math.min(5, Math.max(prev?.mastery ?? 0, streak))
    : Math.min(3, Math.max(0, (prev?.mastery ?? 0) - 1));
  const interval = input.correct
    ? REVIEW_INTERVAL_MS[Math.min(streak - 1, REVIEW_INTERVAL_MS.length - 1)]
    : REVIEW_INTERVAL_MS[0];
  const nextReview = now + interval;
  const latencyMs = Math.min(3_600_000, Math.max(0, Math.round(input.latencyMs)));

  const d = db();
  d.exec('BEGIN');
  try {
    qRun(
      `INSERT INTO gym_progress
         (item_key, mastery, streak, seen, correct, last_result, next_review_at, updated_at)
       VALUES (?,?,?,?,?,?,?, datetime('now','localtime'))
       ON CONFLICT(item_key) DO UPDATE SET
         mastery = excluded.mastery,
         streak = excluded.streak,
         seen = excluded.seen,
         correct = excluded.correct,
         last_result = excluded.last_result,
         next_review_at = excluded.next_review_at,
         updated_at = datetime('now','localtime')`,
      input.itemKey, mastery, streak, seen, correct,
      input.correct ? 'correct' : 'wrong', nextReview,
    );
    qRun(
      `INSERT INTO gym_attempts (item_key, drill_id, type, correct, latency_ms, trap)
       VALUES (?,?,?,?,?,?)`,
      input.itemKey, input.drillId, input.type, input.correct ? 1 : 0,
      latencyMs, input.trap ?? null,
    );
    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
  return gymProgress(input.itemKey)!;
}

/** 列表页概览：待练数、当前已掌握数，以及一个稳定的「现在」给客户端做状态判断。 */
export function gymOverview(itemKeys: string[], progress: GymProgress[]): { due: number; mastered: number; now: number } {
  const now = Date.now();
  const byKey = new Map(progress.map((p) => [p.itemKey, p]));
  const valid = new Set(itemKeys);
  const due = itemKeys.filter((key) => {
    const p = byKey.get(key);
    return !p || p.mastery < 4 || !p.nextReviewAt || new Date(p.nextReviewAt).getTime() <= now;
  }).length;
  const mastered = progress.filter((p) =>
    valid.has(p.itemKey)
    && p.mastery >= 4
    && p.nextReviewAt !== null
    && new Date(p.nextReviewAt).getTime() > now,
  ).length;
  return { due, mastered, now };
}
