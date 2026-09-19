import { qGet } from '@/lib/db';
import { chatStream } from '@/lib/ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { questionId } = await req.json();
  const q = qGet<{ type: string; module: string; stem: string; options: string; answer: string; explanation: string }>(
    'SELECT type, module, stem, options, answer, explanation FROM questions WHERE id = ?', questionId,
  );
  if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const options: string[] = JSON.parse(q.options);

  const system =
    '你是"人工智能数字人训练师"赛项的金牌教练，熟悉《人工智能训练师国家职业技能标准（2021年版）》和数字人行业知识。' +
    '请为学员讲解题目：先一句话点明考点，再解释正确选项为什么对、错误选项错在哪，最后给一个易记口诀或易错提醒。' +
    '全部用中文，用短段落或 1. 2. 3. 列表，总长度控制在 260 字内，不要输出题干本身。';

  const user = [
    `【模块】${q.module}`,
    `【题型】${q.type === 'multi' ? '多选题' : q.type === 'judge' ? '判断题' : '单选题'}`,
    `【题干】${q.stem}`,
    `【选项】${options.map((o, i) => `${'ABCD'[i]}. ${o}`).join('  ')}`,
    `【正确答案】${q.answer}`,
    q.explanation ? `【内置解析】${q.explanation}` : '',
  ].join('\n');

  try {
    const stream = await chatStream(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'explain', maxTokens: 700 },
    );
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
