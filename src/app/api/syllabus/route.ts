import { NextResponse } from 'next/server';
import { qAll, qRun, qGet } from '@/lib/db';

export async function GET() {
  const rows = qAll<{ id: number; module: string; section: string; topic: string; detail: string; level: string; ref: string; mastered: number }>(
    'SELECT id, module, section, topic, detail, level, ref, mastered FROM syllabus ORDER BY module, sort, id',
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { module, section, topic, detail } = await req.json();
  if (!module || !section || !topic) {
    return NextResponse.json({ error: '模块、章节、知识点名称均不能为空' }, { status: 400 });
  }
  const dup = qGet('SELECT id FROM syllabus WHERE module=? AND section=? AND topic=?', module, section, topic);
  if (dup) return NextResponse.json({ error: '该知识点已存在' }, { status: 400 });
  const max = qGet<{ m: number }>('SELECT MAX(sort) AS m FROM syllabus WHERE module=?', module)?.m ?? 0;
  qRun('INSERT INTO syllabus (module, section, topic, detail, sort) VALUES (?,?,?,?,?)',
    module, section, topic, detail ?? '', max + 1);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { id, mastered, topic, detail, section } = await req.json();
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  if (mastered !== undefined) {
    qRun('UPDATE syllabus SET mastered=? WHERE id=?', Math.max(0, Math.min(2, mastered | 0)), id);
  }
  if (topic !== undefined || detail !== undefined || section !== undefined) {
    const cur = qGet<{ topic: string; detail: string; section: string }>('SELECT topic, detail, section FROM syllabus WHERE id=?', id);
    if (cur) {
      qRun('UPDATE syllabus SET topic=?, detail=?, section=? WHERE id=?',
        topic ?? cur.topic, detail ?? cur.detail, section ?? cur.section, id);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
  qRun('DELETE FROM syllabus WHERE id=?', id);
  qRun('DELETE FROM lessons WHERE topic_id=?', id);
  return NextResponse.json({ ok: true });
}
