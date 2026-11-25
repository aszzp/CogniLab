// 决赛模拟卷内容读取：数据来自 data/finals/sets/set-0N.json（由 scripts/finals/build.py 生成）。
import fs from 'node:fs';
import path from 'node:path';

export interface TheoryQuestion {
  key: string;
  no: number;
  module: string;
  topic: string;
  difficulty: number;
  origin: 'original' | 'prelim' | 'prelim_adapted';
  basis: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface JudgeCase {
  args: unknown[];
  expected: unknown;
}

export interface CodeProblem {
  key: string;
  no: number;
  theme: string;
  title: string;
  ability: string;
  knowledge: string;
  fn: string;
  params: string[];
  description: string;
  starter: string;
  samples: JudgeCase[];
  cases: JudgeCase[];
  reference: string;
  explanation: string;
}

export interface Paper {
  id: string;
  no: number;
  title: string;
  theory: TheoryQuestion[];
  code: CodeProblem[];
}

export interface Blueprint {
  exam: {
    title: string;
    totalScore: number;
    durationMin: number;
    switchLimit: number;
    passScore: number;
    theory: { count: number; pointsEach: number };
    code: { count: number; pointsEach: number; testPoints: number; limits: { timeSec: number; memoryMb: number } };
  };
  modules: { key: string; count: number; note: string }[];
  themes: { key: string; no: number; label: string; module: string }[];
  standardWeights: Record<string, string | number>;
}

/** 考试中下发给答题页的题目：不含答案、解析与隐藏测试点。 */
export type TheoryPublic = Omit<TheoryQuestion, 'answer' | 'explanation'>;
export type CodePublic = Omit<CodeProblem, 'cases' | 'reference' | 'explanation'>;

const ROOT = path.join(process.cwd(), 'data', 'finals');
const SET_IDS = ['set-01', 'set-02', 'set-03', 'set-04', 'set-05'];
const cache = new Map<string, { mtimeMs: number; paper: Paper }>();

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')) as T;
}

let blueprint: Blueprint | undefined;
export function loadBlueprint(): Blueprint {
  blueprint ??= readJson<Blueprint>('blueprint.json');
  return blueprint;
}

export function loadPaper(setId: string): Paper | undefined {
  if (!SET_IDS.includes(setId)) return undefined;
  const file = path.join(ROOT, 'sets', `${setId}.json`);
  if (!fs.existsSync(file)) return undefined;
  const mtimeMs = fs.statSync(file).mtimeMs;
  const hit = cache.get(setId);
  if (hit && hit.mtimeMs === mtimeMs) return hit.paper;
  const paper = readJson<Paper>(`sets/${setId}.json`);
  cache.set(setId, { mtimeMs, paper });
  return paper;
}

export function listSets(): Paper[] {
  return SET_IDS.map((id) => loadPaper(id)).filter((p): p is Paper => !!p);
}

/** 题目键形如 s1-c03，前缀即套号；解析失败视为不存在。 */
export function setIdOfKey(key: string): string | undefined {
  const match = /^s([1-5])-/.exec(key);
  return match ? `set-0${match[1]}` : undefined;
}

export function findProblem(key: string): { paper: Paper; problem: CodeProblem } | undefined {
  if (!key) return undefined;
  const paper = loadPaper(setIdOfKey(key) ?? '');
  const problem = paper?.code.find((p) => p.key === key);
  return paper && problem ? { paper, problem } : undefined;
}

export function toPublicTheory(q: TheoryQuestion): TheoryPublic {
  return {
    key: q.key, no: q.no, module: q.module, topic: q.topic, difficulty: q.difficulty,
    origin: q.origin, basis: q.basis, stem: q.stem, options: q.options,
  };
}

export function toPublicProblem(p: CodeProblem): CodePublic {
  return {
    key: p.key, no: p.no, theme: p.theme, title: p.title, ability: p.ability, knowledge: p.knowledge,
    fn: p.fn, params: p.params, description: p.description, starter: p.starter, samples: p.samples,
  };
}
