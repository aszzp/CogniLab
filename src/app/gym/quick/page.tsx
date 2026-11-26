import Link from 'next/link';
import { ArrowLeft, Play } from 'lucide-react';
import { buildQuickQueue, findGymItem } from '@/lib/gym/content';
import { gymProgressRows } from '@/lib/gym/store';
import { pythonVersion } from '@/lib/python-judge.mjs';
import GymDrillSession, { type DrillEntry } from '@/components/gym/GymDrillSession';

export const dynamic = 'force-dynamic';

export default async function GymQuickPage() {
  const progress = gymProgressRows();
  const version = await pythonVersion();
  const queue = buildQuickQueue(progress, 10);
  const entries: DrillEntry[] = queue.flatMap((entry) => {
    const item = findGymItem(entry.itemKey);
    const drill = item?.drills.find((d) => d.id === entry.drillId);
    return item && drill ? [{
      itemKey: item.key,
      drillId: drill.id,
      itemTitle: item.title,
      kind: item.kind,
      drill,
    }] : [];
  });

  return (
    <div className="fade-up space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <Link href="/gym" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> 道场
        </Link>
        <span className="text-zinc-700">/</span>
        <h1 className="flex items-center gap-1.5 text-sm font-semibold">
          <Play size={14} className="text-violet-300" /> 今日速练
        </h1>
        <span className="ml-auto text-[11px] text-zinc-500">{entries.length} 题</span>
      </div>
      <p className="px-1 text-[11.5px] leading-relaxed text-zinc-500">
        按「到期优先、薄弱优先」混合出题，覆盖七式与惯用法。做完会即时判分并安排下次复习。
      </p>
      {entries.length ? (
        <GymDrillSession entries={entries} pythonLabel={version ? `Python (${version})` : 'Python'} finishHref="/gym" finishLabel="回到道场" />
      ) : (
        <div className="card p-6 text-center text-sm text-zinc-500">还没有可练的题，先去道场学一张卡。</div>
      )}
    </div>
  );
}
