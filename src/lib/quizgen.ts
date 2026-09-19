import { qRun } from './db';

export interface GenQ {
  type: string;
  module?: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

export function insertQuestions(list: GenQ[], module: string): number {
  let n = 0;
  for (const q of list) {
    if (!q.stem || !Array.isArray(q.options) || !q.answer) continue;
    qRun(
      'INSERT INTO questions (type, module, stem, options, answer, explanation, difficulty, source) VALUES (?,?,?,?,?,?,?,?)',
      q.type === 'judge' ? 'judge' : 'single', q.module ?? module, String(q.stem).slice(0, 500),
      JSON.stringify(q.options.slice(0, 6)), String(q.answer).slice(0, 6),
      String(q.explanation ?? '').slice(0, 500), 2, 'AI 生成',
    );
    n++;
  }
  return n;
}
