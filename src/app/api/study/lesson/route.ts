import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { chatStream } from '@/lib/ai';

export async function POST(req: Request) {
  const { topicId } = await req.json();
  const t = qGet<{ module: string; section: string; topic: string; detail: string; level: string; ref: string }>(
    'SELECT module, section, topic, detail, level, ref FROM syllabus WHERE id = ?', topicId,
  );
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const system =
    '你是"人工智能数字人训练师"赛项的金牌讲师，正在给备赛学员讲解考纲知识点。' +
    '请输出结构化的图文讲解：先用一句话定义，再分 2-4 个小节展开（用 ### 小标题），' +
    '包含：原理/概念、标准原文要求（严格依据给定的标准条款，说明该知识点在对应级别应具备的能力）、' +
    '考试怎么考（常见题型与出题角度）、与相近知识点的对比辨析、记忆要点。' +
    '适当使用 **加粗**、列表和表格。总长度 400~600 字，纯中文，不要输出考纲以外的闲聊。';

  const LEVEL_DESC: Record<string, string> = {
    基础: '基本要求（各级别通用）',
    五级四级: '五级/初级工、四级/中级工职业功能（高级别涵盖低级别要求）',
    三级: '三级/高级工职业功能（本次赛项核心命题层级）',
    二级: '二级/技师职业功能（"三级及以上"命题范围）',
    一级: '一级/高级技师职业功能（"三级及以上"命题范围）',
    工种: '数字人训练师工种特色知识',
  };
  const user = [
    `【所属模块】${t.module}`,
    `【所属章节】${t.section}`,
    `【知识点】${t.topic}`,
    `【级别】${t.level ? LEVEL_DESC[t.level] ?? t.level : '三级/高级工'}`,
    `【标准依据】《人工智能训练师国家职业技能标准（2021年版）》${t.ref ? `条款 ${t.ref}` : '三级/高级工及以上'}`,
    `【考纲描述】${t.detail || '（无，请按知识点名称合理展开）'}`,
    '命题依据：《人工智能训练师国家职业技能标准（2021年版）》三级/高级工及以上。',
  ].join('\n');

  try {
    const stream = await chatStream(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'explain', maxTokens: 1200, temperature: 0.5 },
    );
    // 流式转发的同时落库：用 tee 分流，后台收集全文
    const [a, b] = stream.tee();
    (async () => {
      const reader = b.getReader();
      const dec = new TextDecoder();
      let full = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += dec.decode(value, { stream: true });
        }
        if (full.trim()) {
          qRun(`INSERT INTO lessons (topic_id, content, created_at) VALUES (?,?, datetime('now','localtime'))
                ON CONFLICT(topic_id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`,
            topicId, full);
        }
      } catch { /* 忽略缓存写入失败 */ }
    })();
    return new Response(a, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

/** 取已缓存的讲解（二次打开秒出） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = Number(searchParams.get('topicId'));
  const row = qGet<{ content: string; anim_html: string | null }>(
    'SELECT content, anim_html FROM lessons WHERE topic_id = ?', topicId,
  );
  return NextResponse.json({ content: row?.content ?? '', animHtml: row?.anim_html ?? '' });
}
