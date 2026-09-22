import { NextResponse } from 'next/server';
import { qAll } from '@/lib/db';
import { chat, extractJsonArray } from '@/lib/ai';
import { insertQuestions, type GenQ } from '@/lib/quizgen';

export async function POST(req: Request) {
  const { topicIds, save, questions, count } = await req.json();

  if (save) {
    const list = questions as GenQ[];
    if (!Array.isArray(list) || !list.length) return NextResponse.json({ error: '无题目可入库' }, { status: 400 });
    const moduleName = list[0].module ?? '数字人';
    const n = insertQuestions(list, moduleName);
    return NextResponse.json({ saved: n });
  }

  const ids: number[] = topicIds ?? [];
  const topics = qAll<{ module: string; section: string; topic: string; detail: string; level: string }>(
    `SELECT module, section, topic, detail, level FROM syllabus WHERE id IN (${ids.map(() => '?').join(',') || '0'})`, ...ids,
  );
  if (!topics.length) return NextResponse.json({ error: '未选择知识点' }, { status: 400 });

  const n = Math.min(Math.max(count ?? topics.length * 2, 1), 12);
  const system =
    '你是"人工智能数字人训练师"赛项的命题专家，严格对标《人工智能训练师国家职业技能标准（2021年版）》三级/高级工及以上难度。' +
    '只输出一个 JSON 数组，不要任何其他文字。每题格式：' +
    '{"type":"single或judge","stem":"题干","options":["A选项","B选项","C选项","D选项"],"answer":"正确选项字母，judge题为A或B","explanation":"一句话解析"}' +
    'judge 题的 options 固定为 ["正确","错误"]。题目必须紧扣给定的知识点（含其标准条款要求），干扰项要有迷惑性。';

  const user = [
    `请围绕以下 ${topics.length} 个知识点出 ${n} 道新题（single 与 judge 搭配）：`,
    ...topics.map((t) => `- 【${t.module}/${t.section}·${t.level || '三级'}】${t.topic}：${t.detail}`),
  ].join('\n');

  try {
    const { content } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'quiz', maxTokens: 3600 },
    );
    const list = extractJsonArray<GenQ>(content);
    if (!list?.length) return NextResponse.json({ error: '生成解析失败，请重试' }, { status: 502 });
    const valid = list.filter((q) => q.stem && Array.isArray(q.options) && q.answer);
    if (!valid.length) return NextResponse.json({ error: '生成题目无效，请重试' }, { status: 502 });
    // 标注模块，入库时使用
    const withModule = valid.map((q) => ({ ...q, module: topics[0].module }));
    return NextResponse.json({ questions: withModule });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
