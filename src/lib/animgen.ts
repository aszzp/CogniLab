import { chat } from './ai';
import type { TopicRow } from './lessongen';

/** 动画演示生成：prompt + 稳健的 HTML 提取（模型偶发输出不规范 JSON 也能兜住） */

function animMessages(t: TopicRow): { system: string; user: string } {
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
  return { system, user };
}

/** 单遍反转义：把 JSON 字符串转义（\" \\n \\t \\\\）还原为真实字符 */
function unescapeJsonString(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '"') { out += '"'; i++; continue; }
      if (n === 'n') { out += '\n'; i++; continue; }
      if (n === 't') { out += '\t'; i++; continue; }
      if (n === 'r') { out += ''; i++; continue; }
      if (n === '\\') { out += '\\'; i++; continue; }
      if (n === '/') { out += '/'; i++; continue; }
    }
    out += c;
  }
  return out;
}

/** 从模型输出中提取完整 HTML 文档：JSON 正常/畸形、围栏、前后杂文本均能处理 */
export function extractHtml(content: string): string {
  const cleaned = content.replace(/```json|```/g, '').trim();
  // 1. 标准 JSON 解析
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s !== -1 && e > s) {
    try {
      const j = JSON.parse(cleaned.slice(s, e + 1));
      if (typeof j?.html === 'string' && j.html.includes('<')) return j.html;
    } catch { /* 落到提取式解析 */ }
  }
  // 2. 直接定位 HTML 文档本体（含 JSON 转义形态）
  const startRe = /<!DOCTYPE\s+html|<html[\s>]/i;
  const m = cleaned.match(startRe);
  if (m && m.index !== undefined) {
    const endIdx = cleaned.toLowerCase().lastIndexOf('</html>');
    if (endIdx > m.index) {
      let doc = cleaned.slice(m.index, endIdx + '</html>'.length);
      if (/\\[ntr"\\/]/.test(doc)) doc = unescapeJsonString(doc);
      if (doc.includes('<')) return doc;
    }
  }
  // 3. 原有的正则路径（html 字段到末尾）
  const rm = cleaned.match(/"html"\s*:\s*"([\s\S]*)"\s*}\s*$/);
  if (rm) {
    try {
      const html = JSON.parse(`"${rm[1].replace(/\n/g, '\\n')}"`);
      if (html.includes('<')) return html;
    } catch { /* 放弃 */ }
  }
  return '';
}

/** 生成动画 HTML：解析失败自动重试一次 */
export async function generateAnim(t: TopicRow): Promise<string> {
  const { system, user } = animMessages(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: attempt === 0 ? user : user + '\n（上一次输出无法解析。请严格只输出一个合法 JSON 对象，html 字段为完整 HTML，字符串内不得有真实换行。）' },
      ],
      { purpose: 'anim', maxTokens: 6000, temperature: attempt === 0 ? 0.6 : 0.3 },
    );
    const html = extractHtml(content);
    if (html.length >= 200) return html;
  }
  throw new Error('动画生成失败，请重试');
}
