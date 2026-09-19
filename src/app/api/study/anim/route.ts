import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { chat } from '@/lib/ai';

/** 为知识点生成沙箱动画（自包含 HTML） */
export async function POST(req: Request) {
  const { topicId } = await req.json();
  const t = qGet<{ module: string; section: string; topic: string; detail: string }>(
    'SELECT module, section, topic, detail FROM syllabus WHERE id = ?', topicId,
  );
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const system =
    '你是一位精通 Web 动画的科普讲师。请为给定知识点生成一个"单文件自包含 HTML 动画演示"，' +
    '将抽象概念可视化。硬性要求：\n' +
    '1. 只输出一个 JSON 对象：{"html": "<!DOCTYPE html>...完整HTML..."}，不要输出其他文字；\n' +
    '2. HTML 中不得引用任何外部资源（无 CDN/图片/字体），所有逻辑内联在 <script>；\n' +
    '3. 深色背景 #0d0d16，全屏自适应（html,body{width:100%;height:100%;margin:0}），主体内容居中；\n' +
    '4. 用 Canvas 或 DOM+CSS 实现 10~30 秒的可循环动画，画面有节奏地分步骤演示概念（可用阶段标题/文字说明，中文）；\n' +
    '5. 配色以紫(#7c5cff)、青(#22d3ee)、白为主，文字清晰、元素圆润，整体精致美观；\n' +
    '6. 动画要真正解释概念（例如数据流动、流程分支、对比演示），而不是装饰性粒子。';

  const user = [
    `【模块】${t.module} / ${t.section}`,
    `【知识点】${t.topic}`,
    `【考纲描述】${t.detail}`,
  ].join('\n');

  try {
    const { content } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'anim', maxTokens: 6000, temperature: 0.6 },
    );
    const m = content.match(/"html"\s*:\s*"([\s\S]*)"\s*}\s*$/);
    let html = '';
    if (m) {
      try {
        html = JSON.parse(`"${m[1].replace(/\n/g, '\\n')}"`);
      } catch {
        html = '';
      }
    }
    if (!html || !html.includes('<')) {
      // 兜底：尝试整体 JSON 解析
      try {
        const s = content.indexOf('{');
        const e = content.lastIndexOf('}');
        const j = JSON.parse(content.slice(s, e + 1).replace(/```json|```/g, ''));
        html = j.html ?? '';
      } catch { /* ignore */ }
    }
    if (!html || !html.includes('<') || html.length < 200) {
      return NextResponse.json({ error: '动画生成失败，请重试' }, { status: 502 });
    }
    qRun(`UPDATE lessons SET anim_html=? WHERE topic_id=?`, html, topicId);
    // 若无 lessons 行则插入
    qRun(`INSERT OR IGNORE INTO lessons (topic_id, content, anim_html) VALUES (?, '', ?)`, topicId, html);
    return NextResponse.json({ html });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
