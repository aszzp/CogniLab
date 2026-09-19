import Link from 'next/link';
import { AlarmClock, ChevronRight, Undo2 } from 'lucide-react';
import { dueReview } from '@/lib/quiz';
import { qAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function WrongPage() {
  const due = dueReview(100);
  const all = qAll<{ n: number }>('SELECT COUNT(*) AS n FROM review_queue')?.[0]?.n ?? 0;

  return (
    <div className="fade-up space-y-4">
      <div className="card flex items-center gap-3 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15">
          <Undo2 size={20} className="text-amber-300" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">错题本 · 间隔重复</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            共 {all} 题在复习计划中 · 到期 {due.length} 题
          </p>
        </div>
      </div>

      {due.length > 0 ? (
        <Link href="/wrong/review" className="grad-btn flex items-center gap-3 rounded-2xl p-4">
          <AlarmClock size={20} className="text-white" />
          <p className="flex-1 text-sm font-semibold text-white">开始复习（{due.length} 题）</p>
          <ChevronRight size={18} className="text-white/70" />
        </Link>
      ) : (
        <div className="card p-6 text-center text-sm text-zinc-500">
          暂无到期错题 🎉 继续保持！
        </div>
      )}

      {due.length > 0 && (
        <div className="card divide-y divide-white/6 p-2">
          {due.slice(0, 20).map((q) => (
            <div key={q.id} className="flex items-start gap-2 p-3 text-[13px]">
              <span className="mt-0.5 shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-zinc-400">{q.module}</span>
              <p className="line-clamp-2 flex-1 text-zinc-400">{q.stem}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
