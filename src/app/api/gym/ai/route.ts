import { NextResponse } from 'next/server';
import { chat } from '@/lib/ai';
import { findGymDrill } from '@/lib/gym/content';
import { correctText, userText } from '@/lib/gym/grade';

const MAX_CODE = 20_000;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: '请求体必须是JSON对象' }, { status: 400 });
  }
  const input = raw as {
    itemKey?: unknown; drillId?: unknown; answer?: unknown; code?: unknown;
    mode?: unknown; results?: unknown; title?: unknown;
  };

  // 一轮练完后的整体复盘
  if (input.mode === 'summary') {
    if (typeof input.itemKey !== 'string') {
      return NextResponse.json({ error: 'itemKey格式错误' }, { status: 400 });
    }
    const title = typeof input.title === 'string' && input.title.trim()
      ? input.title.trim().slice(0, 100)
      : '本轮练习';
    const rows = Array.isArray(input.results) ? input.results.slice(0, 20) : [];
    const wrong = rows.filter(
      (r): r is { drillId?: string; prompt?: string; correct?: boolean } =>
        Boolean(r) && typeof r === 'object' && (r as { correct?: unknown }).correct === false,
    );
    const prompt = [
      `你是一名「人工智能数字人训练师」赛项的实操教练。学员刚完成「${title}」的 ${rows.length} 道练习，答对 ${rows.length - wrong.length} 道。`,
      wrong.length
        ? `错题：\n${wrong.map((r, i) => `${i + 1}. ${r.prompt || r.drillId || '未命名题目'}`).join('\n')}`
        : '本轮全对。',
      '请用 120–200 字中文复盘：1）最薄弱的规则；2）下一轮只练哪两个动作；3）一句考前提醒。不要重复题目，不要输出 Markdown 表格。',
    ].join('\n');
    try {
      const { content } = await chat(
        [
          { role: 'system', content: '你是精准、耐心、不说套话的实操教练。复盘要具体到规则和动作。' },
          { role: 'user', content: prompt },
        ],
        { purpose: 'grade', maxTokens: 600, temperature: 0.3 },
      );
      return NextResponse.json({ feedback: content.trim() || '这次没有拿到有效复盘，请再试一次。' });
    } catch (e) {
      return NextResponse.json({ error: `AI 复盘失败：${String(e)}` }, { status: 502 });
    }
  }

  if (typeof input.itemKey !== 'string' || typeof input.drillId !== 'string') {
    return NextResponse.json({ error: 'itemKey或drillId格式错误' }, { status: 400 });
  }
  const found = findGymDrill(input.itemKey, input.drillId);
  if (!found) return NextResponse.json({ error: '练习不存在' }, { status: 404 });
  const { item, drill } = found;
  const code = typeof input.code === 'string' ? input.code.slice(0, MAX_CODE) : '';

  const prompt = [
    `你是一名「人工智能数字人训练师」赛项的实操教练，正在带学员练「${item.title}」。`,
    `题目：${drill.prompt}`,
    `学员答案：${userText(drill, input.answer)}`,
    code ? `学员代码：\n${code}` : '',
    `标准答案：${correctText(drill)}`,
    `解析：${drill.explain}`,
    '请用 120–200 字中文点评：1）对/错在哪；2）这道题最关键的边界或裁决规则；3）下一步只练哪一个动作。不要重复题目，不要输出 Markdown 表格。',
  ].filter(Boolean).join('\n');

  try {
    const { content } = await chat(
      [
        { role: 'system', content: '你是精准、耐心、不说套话的实操教练。点评要具体到规则，不要泛泛鼓励。' },
        { role: 'user', content: prompt },
      ],
      { purpose: 'grade', maxTokens: 600, temperature: 0.3 },
    );
    return NextResponse.json({ feedback: content.trim() || '这次没有拿到有效点评，请再试一次。' });
  } catch (e) {
    return NextResponse.json({ error: `AI 点评失败：${String(e)}` }, { status: 502 });
  }
}
