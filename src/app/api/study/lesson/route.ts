import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { chatStream } from '@/lib/ai';
import { lessonMessages } from '@/lib/lessongen';

export async function POST(req: Request) {
  const { topicId } = await req.json();
  const t = qGet<{ module: string; section: string; topic: string; detail: string; level: string; ref: string }>(
    'SELECT module, section, topic, detail, level, ref FROM syllabus WHERE id = ?', topicId,
  );
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { system, user } = lessonMessages(t);

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

/** 取已缓存的内容（讲解/动画/模拟题，二次打开秒出、不走流式） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = Number(searchParams.get('topicId'));
  const row = qGet<{ content: string; anim_html: string | null; quiz_json: string | null }>(
    'SELECT content, anim_html, quiz_json FROM lessons WHERE topic_id = ?', topicId,
  );
  let quiz = null;
  if (row?.quiz_json) {
    try { quiz = JSON.parse(row.quiz_json); } catch { /* 忽略坏缓存 */ }
  }
  return NextResponse.json({ content: row?.content ?? '', animHtml: row?.anim_html ?? '', quiz });
}
