import { NextResponse } from 'next/server';
import { qAll, qGet, qRun } from '@/lib/db';
import { chat } from '@/lib/ai';
import { lessonMessages } from '@/lib/lessongen';
import { generateAnim } from '@/lib/animgen';
import { generateQuestions, type GenQ } from '@/lib/quizgen';

interface PregenState {
  running: boolean;
  stopRequested: boolean;
  phase: '' | 'lesson' | 'quiz' | 'anim' | 'done' | 'stopped';
  done: number;
  total: number;
  current: string;
  failed: { topic: string; kind: string; error: string }[];
}

const g = globalThis as unknown as { __cognilab_pregen?: PregenState };

function state(): PregenState {
  if (!g.__cognilab_pregen) {
    g.__cognilab_pregen = { running: false, stopRequested: false, phase: '', done: 0, total: 0, current: '', failed: [] };
  }
  return g.__cognilab_pregen;
}

export async function GET() {
  const s = state();
  return NextResponse.json({
    running: s.running, phase: s.phase, done: s.done, total: s.total,
    current: s.current, failed: s.failed.slice(-10),
  });
}

export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({ action: 'start' }));
  const s = state();
  if (action === 'stop') {
    s.stopRequested = true;
    return NextResponse.json({ ok: true, running: s.running });
  }
  if (s.running) return NextResponse.json({ ok: true, running: true, message: '已在进行中' });

  const topics = qAll<{ id: number; module: string; section: string; topic: string; detail: string; level: string; ref: string }>(
    'SELECT id, module, section, topic, detail, level, ref FROM syllabus ORDER BY module, sort, id',
  );
  if (!topics.length) return NextResponse.json({ error: '考纲为空' }, { status: 400 });

  s.running = true;
  s.stopRequested = false;
  s.phase = 'lesson';
  s.done = 0;
  s.total = topics.length * 3;
  s.current = '';
  s.failed = [];

  // 后台顺序执行：全部讲解 → 全部模拟题 → 全部动画（最有价值的先完成），可随时中止、断点续跑
  (async () => {
    const steps: { kind: 'lesson' | 'quiz' | 'anim'; phase: 'lesson' | 'quiz' | 'anim' }[] = [
      { kind: 'lesson', phase: 'lesson' },
      { kind: 'quiz', phase: 'quiz' },
      { kind: 'anim', phase: 'anim' },
    ];
    for (const { kind, phase } of steps) {
      s.phase = phase;
      for (const t of topics) {
        if (s.stopRequested) { s.phase = 'stopped'; s.running = false; return; }
        const row = qGet<{ content: string | null; anim_html: string | null; quiz_json: string | null }>(
          'SELECT content, anim_html, quiz_json FROM lessons WHERE topic_id = ?', t.id,
        );
        if (kind === 'lesson' && row?.content?.trim()) { s.done++; continue; }
        if (kind === 'quiz' && row?.quiz_json) { s.done++; continue; }
        if (kind === 'anim' && row?.anim_html) { s.done++; continue; }
        s.current = `${t.topic} · ${phase === 'lesson' ? '讲解' : phase === 'quiz' ? '模拟题' : '动画'}`;
        try {
          if (kind === 'lesson') {
            const { system, user } = lessonMessages(t);
            const { content } = await chat(
              [{ role: 'system', content: system }, { role: 'user', content: user }],
              { purpose: 'explain', maxTokens: 1200, temperature: 0.5 },
            );
            if (content.trim()) {
              qRun(`INSERT INTO lessons (topic_id, content, created_at) VALUES (?,?, datetime('now','localtime'))
                    ON CONFLICT(topic_id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`,
                t.id, content);
            }
          } else if (kind === 'quiz') {
            const list = await generateQuestions([t], 3);
            const withModule: GenQ[] = list.map((q) => ({ ...q, module: t.module }));
            qRun(`INSERT INTO lessons (topic_id, content, quiz_json) VALUES (?, '', ?)
                  ON CONFLICT(topic_id) DO UPDATE SET quiz_json = excluded.quiz_json`,
              t.id, JSON.stringify(withModule));
          } else {
            const html = await generateAnim(t);
            qRun(`INSERT INTO lessons (topic_id, content, anim_html) VALUES (?, '', ?)
                  ON CONFLICT(topic_id) DO UPDATE SET anim_html = excluded.anim_html`, t.id, html);
          }
        } catch (e) {
          s.failed.push({ topic: t.topic, kind, error: e instanceof Error ? e.message : String(e) });
        }
        s.done++;
      }
    }
    s.phase = s.stopRequested ? 'stopped' : 'done';
    s.running = false;
    s.current = '';
  })();

  return NextResponse.json({ ok: true, running: true, total: s.total });
}
