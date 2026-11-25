import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import { qAll } from '@/lib/db';
import ExamStarter from '@/components/ExamStarter';

export const dynamic = 'force-dynamic';

export default function ExamPage() {
  const history = qAll<{
    id: number; mode: string; score: number | null; total: number | null;
    correct: number | null; duration_sec: number | null; finished_at: string;
  }>(`SELECT id, mode, score, total, correct, duration_sec, finished_at
      FROM exams WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 10`);

  const MODE_LABEL: Record<string, string> = {
    sample45: '全真模拟', quick20: '快速模拟', sprint10: '冲刺小卷',
  };

  // finished_at 为 "YYYY-MM-DD HH:mm:ss" 本地时间字符串，展示成 "MM-DD HH:mm"
  function fmtTime(s: string) {
    return s.slice(5, 16) ?? s;
  }
  function fmtDuration(sec: number | null) {
    const s = sec ?? 0;
    return s < 60 ? `${s} 秒` : `${Math.round(s / 60)} 分钟`;
  }

  return (
    <div className="fade-up space-y-5">
      <div className="pt-1">
        <h1 className="text-lg font-bold">模拟考试</h1>
        <p className="mt-0.5 text-xs text-zinc-500">全真模式按官方样卷结构组题：数字人15 · 业务分析15 · 智能训练8 · 系统设计7</p>
      </div>
      <Link href="/finals" className="card flex items-center gap-3 border-cyan-400/25 bg-cyan-400/[0.06] p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15">
          <Trophy size={17} className="text-cyan-300" />
        </span>
        <p className="flex-1 text-sm">
          <span className="font-semibold text-cyan-200">决赛模拟</span>
          <span className="ml-1 text-zinc-400">全国总决赛题型：57 题 · 100 分 · 180 分钟</span>
        </p>
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
      </Link>
      <ExamStarter />

      {history.length > 0 && (
        <div className="card p-5">
          <p className="mb-3 text-sm font-semibold">历史成绩</p>
          <div className="space-y-2.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <span className={`w-12 shrink-0 text-right text-xl font-bold tabular-nums ${((h.score ?? 0) >= 60) ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {h.score}<span className="ml-0.5 text-[10px] font-medium">分</span>
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-medium text-zinc-300">
                    {MODE_LABEL[h.mode] ?? h.mode} · 答对 {h.correct}/{h.total}
                  </p>
                  <p className="mt-0.5 text-zinc-500">
                    {fmtTime(h.finished_at)} · 用时 {fmtDuration(h.duration_sec)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
