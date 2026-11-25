export interface JudgeLimits {
  timeMs: number;
  memoryMb: number;
  cpuSec: number;
}

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'SE';

export interface JudgeCase {
  args: unknown[];
  expected: unknown;
}

export interface CaseResult {
  status: Verdict;
  ms: number;
  memMb: number;
  actual?: unknown;
  stdout?: string;
  error?: string;
}

export interface JudgeSummary {
  passed: number;
  total: number;
  status: Verdict;
  maxMs: number;
  maxMemMb: number;
  results: CaseResult[];
}

export const JUDGE_LIMITS: Readonly<JudgeLimits>;
export const VERDICT_LABEL: Readonly<Record<Verdict, string>>;
export function sameOutput(actual: unknown, expected: unknown): boolean;
export function judgeProblem(input: {
  code: string;
  fn: string;
  cases: JudgeCase[];
  limits?: JudgeLimits;
  python?: string;
  concurrency?: number;
}): Promise<JudgeSummary>;
export function pythonVersion(python?: string): Promise<string | null>;
