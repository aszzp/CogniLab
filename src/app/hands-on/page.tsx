import Link from 'next/link';
import { Database, Code2, Sparkles, BarChart3, GitBranch, ChevronRight, FlaskConical } from 'lucide-react';
import { qAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

const KIND_META: Record<string, { icon: typeof Database; label: string; cls: string }> = {
  sql: { icon: Database, label: 'SQL', cls: 'text-cyan-300 bg-cyan-400/12' },
  python: { icon: Code2, label: 'Python', cls: 'text-emerald-300 bg-emerald-400/12' },
  essay: { icon: Sparkles, label: '方案设计', cls: 'text-violet-300 bg-violet-400/12' },
  chart: { icon: BarChart3, label: '图表配置', cls: 'text-amber-300 bg-amber-400/12' },
  flow: { icon: GitBranch, label: '流程设计', cls: 'text-rose-300 bg-rose-400/12' },
};

export default function HandsOnPage() {
  const tasks = qAll<{
    id: number; kind: string; title: string; category: string; points: number; source: string;
  }>('SELECT id, kind, title, category, points, source FROM tasks ORDER BY id');

  return (
    <div className="fade-up space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <FlaskConical size={18} className="text-violet-300" />
        <h1 className="text-lg font-bold">实操训练</h1>
        <span className="ml-auto text-xs text-zinc-500">对标样卷实操 55 分</span>
      </div>
      {tasks.map((t) => {
        const m = KIND_META[t.kind];
        const Icon = m.icon;
        return (
          <Link key={t.id} href={`/hands-on/${t.id}`} className="card flex items-center gap-3.5 p-4 transition-transform active:scale-[0.99]">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.cls}`}>
              <Icon size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="truncate text-[14.5px] font-semibold">{t.title}</p>
                <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-zinc-400">{m.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {t.category} · {t.points} 分制 · {t.source}
              </p>
            </div>
            <ChevronRight size={17} className="shrink-0 text-zinc-600" />
          </Link>
        );
      })}
    </div>
  );
}
