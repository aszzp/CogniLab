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

  return (
    <div className="fade-up space-y-5">
      <div className="pt-1">
        <h1 className="text-lg font-bold">模拟考试</h1>
        <p className="mt-0.5 text-xs text-zinc-500">全真模式按官方样卷结构组题：数字人15 · 业务分析15 · 智能训练8 · 系统设计7</p>
      </div>
      <ExamStarter />

      {history.length > 0 && (
        <div className="card p-5">
          <p className="mb-3 text-sm font-semibold">历史成绩</p>
          <div className="space-y-2.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <span className={`text-xl font-bold ${((h.score ?? 0) >= 60) ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {h.score}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-medium text-zinc-300">
                    {MODE_LABEL[h.mode] ?? h.mode} · 答对 {h.correct}/{h.total}
                  </p>
                  <p className="mt-0.5 text-zinc-600">
                    {h.finished_at} · 用时 {Math.round((h.duration_sec ?? 0) / 60)} 分钟
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
