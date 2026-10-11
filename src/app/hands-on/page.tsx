import { FlaskConical } from 'lucide-react';
import { qAll } from '@/lib/db';
import HandsOnList from '@/components/HandsOnList';

export const dynamic = 'force-dynamic';

export default function HandsOnPage() {
  const rows = qAll<{
    id: number; kind: string; title: string; category: string; points: number; source: string;
  }>('SELECT id, kind, title, category, points, source FROM tasks ORDER BY id');
  // node:sqlite 返回 null 原型对象，需转为普通对象才能传给 Client 组件
  const tasks = rows.map((r) => ({
    id: r.id, kind: r.kind, title: r.title, category: r.category,
    points: r.points, source: r.source ?? '',
  }));

  return (
    <div className="fade-up space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <FlaskConical size={18} className="text-violet-300" />
        <h1 className="text-lg font-bold">实操训练</h1>
        <span className="ml-auto text-xs text-zinc-500">对标样卷实操 55 分</span>
      </div>
      <HandsOnList tasks={tasks} />
    </div>
  );
}
