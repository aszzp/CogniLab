import Link from 'next/link';
import { ChevronRight, Dumbbell, FlaskConical } from 'lucide-react';
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
      <Link href="/gym" className="card flex items-center gap-3 border-violet-400/25 bg-violet-400/[0.06] p-4 transition-colors hover:border-violet-400/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/15">
          <Dumbbell size={17} className="text-violet-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-violet-200">实操道场 · 七式速练</span>
          <span className="block text-[11px] text-zinc-500">决赛 51–57 题的模板、可视化与快速练习</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
      </Link>

      <HandsOnList tasks={tasks} />
    </div>
  );
}
