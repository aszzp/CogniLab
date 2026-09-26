import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { generateAnim } from '@/lib/animgen';

/** 为知识点生成沙箱动画（自包含 HTML），解析失败自动重试 */
export async function POST(req: Request) {
  const { topicId } = await req.json();
  const t = qGet<{ module: string; section: string; topic: string; detail: string; level: string; ref: string }>(
    'SELECT module, section, topic, detail, level, ref FROM syllabus WHERE id = ?', topicId,
  );
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const html = await generateAnim(t);
    qRun(`INSERT INTO lessons (topic_id, content, anim_html) VALUES (?, '', ?)
          ON CONFLICT(topic_id) DO UPDATE SET anim_html = excluded.anim_html`, topicId, html);
    return NextResponse.json({ html });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
