import { NextResponse } from 'next/server';
import { qGet, qRun } from '@/lib/db';
import { chat, extractJson } from '@/lib/ai';

interface GradeItem {
  label: string;
  score: number;
  max: number;
  comment: string;
}
interface GradeResult {
  items: GradeItem[];
  total: number;
  max: number;
  overall: string;
}

export async function POST(req: Request) {
  const { taskId, answer } = await req.json();
  if (!answer || String(answer).trim().length < 20) {
    return NextResponse.json({ error: '答案太短，请认真作答后再提交批改' }, { status: 400 });
  }
  const t = qGet<{ title: string; prompt: string; points: number; meta: string }>(
    'SELECT title, prompt, points, meta FROM tasks WHERE id = ?', taskId,
  );
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const meta = JSON.parse(t.meta) as { rubric: { label: string; points: number; desc: string }[] };

  const system =
    '你是"人工智能数字人训练师"赛项的实操评委。请严格按照评分点对学员答案评分。' +
    '只输出一个 JSON 对象，不要输出其他任何文字，格式：' +
    '{"items":[{"label":"评分点名","score":得分,"max":满分,"comment":"一句话点评"}],"total":总分,"max":满分合计,"overall":"总评与改进建议(80字内)"}';

  const user = [
    `【任务】${t.title}`,
    `【任务要求】${t.prompt}`,
    `【评分点】${meta.rubric.map((r) => `${r.label}（${r.points}分）：${r.desc}`).join('\n')}`,
    `【学员答案】${String(answer).slice(0, 4000)}`,
  ].join('\n\n');

  try {
    const { content: raw } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'grade', maxTokens: 1400 },
    );
    const grade = extractJson<GradeResult>(raw);
    if (!grade || !Array.isArray(grade.items)) {
      return NextResponse.json({ error: '批改结果解析失败，请重试' }, { status: 502 });
    }
    const detail = {
      items: grade.items.map((it) => ({
        label: String(it.label).slice(0, 40),
        score: Math.max(0, Math.min(Number(it.score) || 0, Number(it.max) || 100)),
        max: Number(it.max) || 100,
        comment: String(it.comment ?? '').slice(0, 300),
      })),
      overall: String(grade.overall ?? '').slice(0, 400),
    };
    const total = detail.items.reduce((a, b) => a + b.score, 0);
    const max = detail.items.reduce((a, b) => a + b.max, 0);
    qRun('INSERT INTO task_attempts (task_id, score, detail, answer) VALUES (?,?,?,?)',
      taskId, total, JSON.stringify({ ...detail, total, max }), String(answer).slice(0, 8000));
    return NextResponse.json({ ...detail, total, max });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
