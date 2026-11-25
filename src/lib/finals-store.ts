// 决赛模拟的作答记录：开考、草稿保存、切屏计数、编程题提交与交卷判分。
import { qAll, qGet, qRun } from './db';
import { loadBlueprint, loadPaper, type Paper } from './finals-content';

export type AttemptMode = 'strict' | 'practice';
export type EndReason = 'manual' | 'timeout' | 'switch';

export interface SubmissionRecord {
  passed: number;
  total: number;
  status: string;
  ms: number;
  memMb: number;
  at: number;
  /** 每个测试点的结论（AC / WA / TLE / MLE / RE），供交卷后逐点回顾 */
  statuses: string[];
}

export interface ProblemSubmissions {
  count: number;
  history: SubmissionRecord[];
}

export interface Attempt {
  id: number;
  setId: string;
  mode: AttemptMode;
  status: 'ongoing' | 'finished';
  startedAt: number;
  deadlineAt: number | null;
  finishedAt: number | null;
  endReason: EndReason | null;
  answers: Record<string, string>;
  code: Record<string, string>;
  submissions: Record<string, ProblemSubmissions>;
  switchCount: number;
  score: number | null;
  /** 草稿版本号：只增不减，旧请求不能覆盖新草稿 */
  rev: number;
}

export interface ScoreBreakdown {
  theoryCorrect: number;
  theoryScore: number;
  codeScore: number;
  score: number;
}

interface Row {
  id: number; set_id: string; mode: string; status: string; started_at: number; deadline_at: number | null;
  finished_at: number | null; end_reason: string | null; answers: string; code: string; submissions: string;
  switch_count: number; rev: number; score: number | null;
}

type Active = { attempt: Attempt | undefined; active: boolean };

const MAX_HISTORY = 50;
const ANSWER_RE = /^[A-D]$/;
const round1 = (n: number) => Math.round(n * 10) / 10;
const parse = <T>(text: string, fallback: T): T => {
  try { return JSON.parse(text) as T; } catch { return fallback; }
};

function toAttempt(row: Row): Attempt {
  return {
    id: row.id, setId: row.set_id, mode: row.mode as AttemptMode, status: row.status as Attempt['status'],
    startedAt: row.started_at, deadlineAt: row.deadline_at, finishedAt: row.finished_at,
    endReason: row.end_reason as EndReason | null,
    answers: parse<Record<string, string>>(row.answers, {}),
    code: parse<Record<string, string>>(row.code, {}),
    submissions: parse<Record<string, ProblemSubmissions>>(row.submissions, {}),
    switchCount: row.switch_count, score: row.score, rev: row.rev ?? 0,
  };
}

export function switchLimitOf(mode: AttemptMode): number {
  return mode === 'strict' ? loadBlueprint().exam.switchLimit : Number.POSITIVE_INFINITY;
}

export function startAttempt(setId: string, mode: AttemptMode): Attempt {
  const startedAt = Date.now();
  const durationMs = loadBlueprint().exam.durationMin * 60 * 1000;
  qRun(
    'INSERT INTO finals_attempts (set_id, mode, started_at, deadline_at) VALUES (?,?,?,?)',
    setId, mode, startedAt, mode === 'strict' ? startedAt + durationMs : null,
  );
  const id = Number(qGet<{ id: number }>('SELECT MAX(id) AS id FROM finals_attempts')!.id);
  return getAttempt(id)!;
}

export function getAttempt(id: number): Attempt | undefined {
  const row = qGet<Row>('SELECT * FROM finals_attempts WHERE id = ?', id);
  return row ? toAttempt(row) : undefined;
}

export function listAttempts(limit = 20): Attempt[] {
  return qAll<Row>('SELECT * FROM finals_attempts ORDER BY id DESC LIMIT ?', limit).map(toAttempt);
}

/** 理论 50 题 × 0.6 分；编程题取最后一次提交的结果，每通过一个测试点得 1 分，未提交不得分。 */
export function scoreAttempt(attempt: Attempt, paper: Paper): ScoreBreakdown {
  const theoryCorrect = paper.theory.filter((q) => attempt.answers[q.key] === q.answer).length;
  const theoryScore = round1(theoryCorrect * loadBlueprint().exam.theory.pointsEach);
  const codeScore = paper.code.reduce((sum, p) => sum + (attempt.submissions[p.key]?.history.at(-1)?.passed ?? 0), 0);
  return { theoryCorrect, theoryScore, codeScore, score: round1(theoryScore + codeScore) };
}

function closeAttempt(id: number, reason: EndReason, paper: Paper): Attempt {
  const attempt = getAttempt(id)!;
  if (attempt.status === 'finished') return attempt;
  const breakdown = scoreAttempt(attempt, paper);
  qRun(
    `UPDATE finals_attempts SET status='finished', finished_at=?, end_reason=?, score=?, theory_score=?, code_score=?
     WHERE id=? AND status='ongoing'`,
    Date.now(), reason, breakdown.score, breakdown.theoryScore, breakdown.codeScore, id,
  );
  return getAttempt(id)!;
}

/** 全真模式下超时即结束：任何接口被调用时，都会先把已过期的场次收尾。 */
export function ensureActive(id: number): Active {
  const attempt = getAttempt(id);
  if (!attempt || attempt.status === 'finished') return { attempt, active: false };
  const paper = loadPaper(attempt.setId);
  if (paper && attempt.deadlineAt && Date.now() > attempt.deadlineAt) {
    return { attempt: closeAttempt(id, 'timeout', paper), active: false };
  }
  return { attempt, active: true };
}

/** 草稿只接受本卷内的题号与合法取值，避免把任意内容写进作答记录；rev 防止旧请求覆盖新草稿。 */
export function saveDraft(id: number, patch: { answers?: unknown; code?: unknown; rev?: unknown }): Active {
  const current = ensureActive(id);
  if (!current.active || !current.attempt) return { attempt: current.attempt, active: false };
  const attempt = current.attempt;
  const paper = loadPaper(attempt.setId)!;
  const rev = Number.isSafeInteger(patch.rev) ? (patch.rev as number) : 0;
  if (rev && rev <= attempt.rev) return { attempt, active: true };
  const hasAnswers = !!patch.answers && typeof patch.answers === 'object';
  const hasCode = !!patch.code && typeof patch.code === 'object';
  if (!hasAnswers && !hasCode) return { attempt, active: true }; // 没有要写入的内容（例如只是读取状态），不改版本号
  let { answers, code } = attempt;
  if (hasAnswers) {
    const valid = new Set(paper.theory.map((q) => q.key));
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch.answers as Record<string, unknown>)) {
      if (valid.has(key) && typeof value === 'string' && ANSWER_RE.test(value)) next[key] = value;
    }
    answers = next;
  }
  if (hasCode) {
    const valid = new Set(paper.code.map((p) => p.key));
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch.code as Record<string, unknown>)) {
      if (valid.has(key) && typeof value === 'string' && value.length <= 200_000) next[key] = value;
    }
    code = next;
  }
  qRun('UPDATE finals_attempts SET answers=?, code=?, rev=? WHERE id=?', JSON.stringify(answers), JSON.stringify(code), Math.max(rev, attempt.rev), id);
  return { attempt: getAttempt(id)!, active: true };
}

/** 切屏计数。全真模式达到上限即自动交卷；练习模式只记录次数。 */
export function recordSwitch(id: number): { attempt: Attempt | undefined; reachedLimit: boolean } {
  const current = ensureActive(id);
  const attempt = current.attempt;
  if (!attempt) return { attempt, reachedLimit: false };
  if (!current.active) return { attempt, reachedLimit: attempt.endReason === 'switch' };
  qRun('UPDATE finals_attempts SET switch_count = switch_count + 1 WHERE id = ?', id);
  const count = getAttempt(id)!.switchCount;
  if (count >= switchLimitOf(attempt.mode)) {
    return { attempt: closeAttempt(id, 'switch', loadPaper(attempt.setId)!), reachedLimit: true };
  }
  return { attempt: getAttempt(id)!, reachedLimit: false };
}

export function recordSubmission(id: number, problemKey: string, record: SubmissionRecord): ProblemSubmissions {
  const previous = getAttempt(id)?.submissions[problemKey];
  const history = [...(previous?.history ?? []), record].slice(-MAX_HISTORY);
  const next: ProblemSubmissions = { count: (previous?.count ?? 0) + 1, history };
  qRun(
    'UPDATE finals_attempts SET submissions=? WHERE id=? AND status=?',
    JSON.stringify({ ...getAttempt(id)?.submissions, [problemKey]: next }), id, 'ongoing',
  );
  return next;
}

export function finishAttempt(id: number, reason: EndReason): Attempt | undefined {
  const current = ensureActive(id);
  const attempt = current.attempt;
  if (!attempt) return undefined;
  const paper = loadPaper(attempt.setId);
  if (!paper) return undefined;
  return attempt.status === 'finished' ? attempt : closeAttempt(id, reason, paper);
}

export interface PracticeProgress {
  problemKey: string;
  bestPassed: number;
  attempts: number;
}

export function practiceProgress(): PracticeProgress[] {
  return qAll<{ problem_key: string; best_passed: number; attempts: number }>(
    'SELECT problem_key, best_passed, attempts FROM finals_practice ORDER BY problem_key',
  ).map((r) => ({ problemKey: r.problem_key, bestPassed: r.best_passed, attempts: r.attempts }));
}

export function practiceCode(problemKey: string): string {
  return qGet<{ code: string }>('SELECT code FROM finals_practice WHERE problem_key = ?', problemKey)?.code ?? '';
}

export function savePracticeCode(problemKey: string, code: string): void {
  qRun(
    `INSERT INTO finals_practice (problem_key, code) VALUES (?,?)
     ON CONFLICT(problem_key) DO UPDATE SET code=excluded.code, updated_at=datetime('now','localtime')`,
    problemKey, code,
  );
}

export function recordPracticeResult(problemKey: string, passed: number): void {
  qRun(
    `INSERT INTO finals_practice (problem_key, best_passed, attempts) VALUES (?,?,1)
     ON CONFLICT(problem_key) DO UPDATE SET best_passed=MAX(best_passed, excluded.best_passed),
       attempts=attempts + 1, updated_at=datetime('now','localtime')`,
    problemKey, passed,
  );
}
