import { qAll } from './db';
import type { Question } from './types';

export function loadQuestionsByIds(ids: number[]): Question[] {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const rows = qAll<{
    id: number; type: string; module: string; stem: string; options: string;
    answer: string; explanation: string; difficulty: number; source: string;
  }>(`SELECT id, type, module, stem, options, answer, explanation, difficulty, source
      FROM questions WHERE id IN (${ph})`, ...ids);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((i) => map.get(i))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ ...r, type: r.type as Question['type'], options: JSON.parse(r.options) as string[] }));
}
