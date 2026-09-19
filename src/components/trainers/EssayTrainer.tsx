'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Task } from '@/lib/types';

interface GradeResp {
  error?: string;
  items?: { label: string; score: number; max: number; comment: string }[];
  overall?: string;
  total?: number;
  max?: number;
}

export default function EssayTrainer({ task }: { task: Task }) {
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<GradeResp | null>(null);
  const [loading, setLoading] = useState(false);
  const rubric = task.meta.rubric ?? [];

  async function submit() {
    if (answer.trim().length < 20) {
      setGrade({ error: '请先认真作答（至少 20 字）再提交批改' });
      return;
    }
    setLoading(true);
    setGrade(null);
    try {
      const res = await fetch('/api/ai/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, answer }),
      });
      setGrade(await res.json());
    } catch {
      setGrade({ error: '批改请求失败，请重试' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 评分点 */}
      <div className="card p-4">
        <p className="mb-2.5 text-xs font-semibold text-zinc-300">评分标准（共 {rubric.reduce((a, b) => a + b.points, 0)} 分）</p>
        <div className="space-y-2">
          {rubric.map((r) => (
            <div key={r.label} className="rounded-xl bg-white/[0.03] p-3">
              <p className="text-[13px] font-medium text-zinc-200">
                {r.label} <span className="ml-1 text-[11px] text-zinc-500">（{r.points} 分）</span>
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="在此作答…（建议按评分点分段，条理清晰）"
        rows={12}
        className="w-full rounded-2xl border border-white/10 bg-[#0c0c14] p-4 text-[14px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-zinc-600">{answer.length} 字</span>
        <button onClick={submit} disabled={loading}
          className="grad-btn flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? 'AI 评委批改中…' : '提交 AI 批改'}
        </button>
      </div>

      {grade?.error && (
        <div className="card border-amber-400/30 bg-amber-400/[0.06] p-3 text-[13px] text-amber-200">{grade.error}</div>
      )}

      {grade?.items && (
        <div className="fade-up space-y-3">
          <div className="card p-5 text-center">
            <p className="text-xs text-zinc-400">AI 评分</p>
            <p className="mt-1 text-4xl font-bold grad-text">
              {grade.total}<span className="text-lg text-zinc-500"> / {grade.max}</span>
            </p>
          </div>
          {grade.items.map((it) => (
            <div key={it.label} className="card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[13.5px] font-semibold text-zinc-200">{it.label}</p>
                <p className={`text-sm font-bold ${it.score / it.max >= 0.6 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {it.score} / {it.max}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full ${it.score / it.max >= 0.6 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, (it.score / it.max) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">{it.comment}</p>
            </div>
          ))}
          {grade.overall && (
            <div className="card border-violet-400/25 bg-violet-500/[0.06] p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                <Sparkles size={13} /> 总评与改进建议
              </p>
              <p className="text-[13px] leading-relaxed text-zinc-300">{grade.overall}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
