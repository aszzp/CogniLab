import type { GymDrill, GymFill, GymMcq } from './types';

/** 填空题比较：去掉所有空白、统一引号、忽略末尾分号。 */
export function normalizeFill(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/;+$/, '');
}

export function fillCorrect(drill: GymFill, answers: string[]): boolean {
  if (answers.length !== drill.blanks.length) return false;
  return drill.blanks.every((blank, i) =>
    blank.answers.some((accepted) => normalizeFill(accepted) === normalizeFill(answers[i] ?? '')),
  );
}

export function mcqCorrect(drill: GymMcq, answer: number): boolean {
  return Number.isInteger(answer) && answer === drill.answer;
}

/** 把标准答案转成给 AI 教练看的文本。 */
export function correctText(drill: GymDrill): string {
  if (drill.type === 'mcq') return drill.options[drill.answer] ?? '';
  if (drill.type === 'fill') return drill.blanks.map((b) => b.answers[0]).join(' ｜ ');
  const parts = drill.starter.split('___');
  let code = parts[0];
  for (let i = 1; i < parts.length; i++) code += (drill.blanks[i - 1]?.answers[0] ?? '') + parts[i];
  return `参考实现：\n${code}`;
}

export function userText(drill: GymDrill, answer: unknown): string {
  if (drill.type === 'mcq') {
    return typeof answer === 'number' && Number.isInteger(answer)
      ? `选了「${drill.options[answer] ?? '未选'}」`
      : '未作答';
  }
  if (drill.type === 'fill') {
    return Array.isArray(answer) ? answer.map((a, i) => `空${i + 1}: ${String(a) || '（空）'}`).join('；') : '未作答';
  }
  return typeof answer === 'string' ? answer : '未提交代码';
}
