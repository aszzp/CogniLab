import { qRun } from './db';
import { chat, extractJsonArray } from './ai';
import type { TopicRow } from './lessongen';

export interface GenQ {
  type: string;
  module?: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** 从模型输出中稳健提取题目数组：容忍截断/围栏/前后杂文本 */
export function extractQuestions(content: string): GenQ[] {
  const list = extractJsonArray<GenQ>(content);
  if (list?.length) return list.filter((q) => q.stem && Array.isArray(q.options) && q.answer);
  // 截断兜底：取最后一个完整对象之前的部分补全数组
  const cleaned = content.replace(/```json|```/g, '');
  const s = cleaned.indexOf('[');
  if (s === -1) return [];
  const body = cleaned.slice(s + 1, cleaned.lastIndexOf('}') + 1);
  const parts = body.split(/(?<=\})\s*,/);
  for (let cut = parts.length; cut > 1; cut--) {
    try {
      const candidate = JSON.parse('[' + parts.slice(0, cut).join(',') + ']') as GenQ[];
      const valid = candidate.filter((q) => q.stem && Array.isArray(q.options) && q.answer);
      if (valid.length) return valid;
    } catch { /* 继续截短 */ }
  }
  return [];
}

/** 为知识点生成模拟题（解析失败自动重试一次） */
export async function generateQuestions(topics: (TopicRow & { level: string })[], n: number): Promise<GenQ[]> {
  const system =
    '你是"人工智能数字人训练师"赛项的命题专家，严格对标《人工智能训练师国家职业技能标准（2021年版）》三级/高级工及以上难度。' +
    '只输出一个 JSON 数组，不要任何其他文字。每题格式：' +
    '{"type":"single或judge","stem":"题干","options":["A选项","B选项","C选项","D选项"],"answer":"正确选项字母，judge题为A或B","explanation":"一句话解析"}' +
    'judge 题的 options 固定为 ["正确","错误"]。题目必须紧扣给定的知识点（含其标准条款要求），干扰项要有迷惑性。';
  const user = [
    `请围绕以下 ${topics.length} 个知识点出 ${n} 道新题（single 与 judge 搭配）：`,
    ...topics.map((t) => `- 【${t.module}/${t.section}·${t.level || '三级'}】${t.topic}：${t.detail}`),
  ].join('\n');
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: attempt === 0 ? user : user + '\n（上一次输出无法解析。请严格只输出一个合法 JSON 数组，不要任何解释文字。）' },
      ],
      { purpose: 'quiz', maxTokens: 3600, temperature: attempt === 0 ? 0.4 : 0.2 },
    );
    const list = extractQuestions(content);
    if (list.length) return list;
  }
  throw new Error('生成解析失败，请重试');
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
