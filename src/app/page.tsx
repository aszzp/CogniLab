import Link from 'next/link';
import { Zap, BookOpen, Timer, Flame, Target, TrendingUp, ChevronRight, BarChart3, ChartColumn } from 'lucide-react';
import {
  moduleStats, dueCount, streakDays, weekActivity, totalAttempts, overallAccuracy, daysToExam,
} from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default function Home() {
  const stats = moduleStats();
  const due = dueCount();
  const streak = streakDays();
  const week = weekActivity();
  const maxWeek = Math.max(...week.map((w) => w.count), 1);

  return (
    <div className="fade-up space-y-4">
      {/* 倒计时 */}
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
        <p className="text-xs font-medium tracking-wider text-zinc-400">距省级选拔赛（10 月中旬）</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-5xl font-bold grad-text">{daysToExam()}</span>
          <span className="pb-1.5 text-sm text-zinc-400">天</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">理论 30% + 实操 70% · 依据《人工智能训练师国家职业技能标准（2021版）》三级命题</p>
      </div>

      {/* 今日速刷 CTA */}
      <Link href="/quick" className="grad-btn block rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Zap size={24} className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[16px] font-semibold text-white">碎片速刷 10 题</p>
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-medium text-white/90">约 5 分钟</span>
            </div>
            <p className="mt-1 text-xs text-white/75">智能组卷 · 到期错题 + 薄弱模块</p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-white/70" />
        </div>
      </Link>

      {/* 行入口 */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/practice" className="card p-4 transition-transform active:scale-[0.98]">
          <BookOpen size={20} className="text-violet-300" />
          <p className="mt-2 text-sm font-semibold">模块刷题</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">五大模块 · 即时判分</p>
        </Link>
        <Link href="/exam" className="card p-4 transition-transform active:scale-[0.98]">
          <Timer size={20} className="text-cyan-300" />
          <p className="mt-2 text-sm font-semibold">模拟考试</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">全真 45 题 · 计时判分</p>
        </Link>
      </div>

      {due > 0 && (
        <Link href="/wrong" className="card flex items-center gap-3 border-amber-400/25 bg-amber-400/[0.06] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
            <Target size={17} className="text-amber-300" />
          </span>
          <p className="flex-1 text-sm">
            <span className="font-semibold text-amber-200">{due} 道错题到期</span>
            <span className="ml-1 text-zinc-400">该复习了</span>
          </p>
          <ChevronRight size={16} className="shrink-0 text-zinc-500" />
        </Link>
      )}

      {/* 数据概览 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, v: streak, label: '连续天数', cls: 'text-orange-300' },
          { icon: TrendingUp, v: totalAttempts(), label: '累计答题', cls: 'text-cyan-300' },
          { icon: Target, v: `${overallAccuracy()}%`, label: '总体正确率', cls: 'text-emerald-300' },
        ].map(({ icon: Icon, v, label, cls }) => (
          <div key={label} className="card p-3 text-center">
            <Icon size={16} className={`mx-auto ${cls}`} />
            <p className="mt-1.5 text-xl font-bold tabular-nums">{v}</p>
            <p className="mt-0.5 text-[10.5px] text-zinc-400">{label}</p>
          </div>
        ))}
      </div>

      {/* 模块掌握度：条形长度 = 正确率 */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-1.5">
          <BarChart3 size={15} className="text-violet-300" />
          <p className="text-sm font-semibold">模块掌握度</p>
        </div>
        {stats.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">题库为空，先运行 npm run seed 灌入题库</p>
        ) : (
          <div className="space-y-4">
            {stats.map((m) => (
              <div key={m.module}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="shrink-0 font-medium text-zinc-300">{m.module}</span>
                  <span className="truncate text-zinc-500">
                    {m.attempted ? `${m.accuracy}% 正确` : '未开始'} · {m.attempted}/{m.total} 题
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  {m.attempted ? (
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        m.accuracy >= 80
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : m.accuracy >= 60
                            ? 'bg-gradient-to-r from-violet-500 to-cyan-400'
                            : 'bg-gradient-to-r from-amber-500 to-rose-400'
                      }`}
                      style={{ width: `${Math.max(4, m.accuracy)}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 近7日活跃 */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-1.5">
          <ChartColumn size={15} className="text-cyan-300" />
          <p className="text-sm font-semibold">近 7 日练习</p>
        </div>
        <div className="flex h-28 items-end justify-between gap-2">
          {week.map((w, i) => {
            const isToday = i === week.length - 1;
            return (
              <div key={w.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="h-3.5 text-[10px] font-semibold leading-none tabular-nums text-zinc-300">
                  {w.count > 0 ? w.count : ''}
                </span>
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-md ${w.count ? 'bg-gradient-to-t from-violet-500/60 to-cyan-400/80' : 'bg-white/10'}`}
                    style={{ height: w.count ? `${Math.max(8, (w.count / maxWeek) * 88)}px` : '3px' }}
                  />
                </div>
                <span className={`text-[10px] tabular-nums ${isToday ? 'font-semibold text-violet-300' : 'text-zinc-500'}`}>
                  {w.date}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
