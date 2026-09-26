import { NextResponse } from 'next/server';
import { qAll } from '@/lib/db';
import { insertQuestions, generateQuestions, type GenQ } from '@/lib/quizgen';

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
  const topics = qAll<{ module: string; section: string; topic: string; detail: string; level: string; ref: string }>(
    `SELECT module, section, topic, detail, level, ref FROM syllabus WHERE id IN (${ids.map(() => '?').join(',') || '0'})`, ...ids,
  );
  if (!topics.length) return NextResponse.json({ error: '未选择知识点' }, { status: 400 });

  const n = Math.min(Math.max(count ?? topics.length * 2, 1), 12);
  try {
    const list = await generateQuestions(topics, n);
    const withModule = list.map((q) => ({ ...q, module: topics[0].module }));
    return NextResponse.json({ questions: withModule });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
