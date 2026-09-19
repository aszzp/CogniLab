import Link from 'next/link';
import { BookMarked, FileText, CalendarClock, Info } from 'lucide-react';
import QuizGenerator from '@/components/QuizGenerator';
import ModelSettings from '@/components/ModelSettings';
import { totalAttempts, overallAccuracy, streakDays, EXAM_DATE } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default function MePage() {
  return (
    <div className="fade-up space-y-4">
      <div className="card p-5">
        <p className="text-sm font-semibold">备赛档案</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            { v: totalAttempts(), l: '累计答题' },
            { v: `${overallAccuracy()}%`, l: '正确率' },
            { v: `${streakDays()} 天`, l: '连续练习' },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-white/[0.03] py-3">
              <p className="text-lg font-bold">{x.v}</p>
              <p className="text-[10.5px] text-zinc-500">{x.l}</p>
            </div>
          ))}
        </div>
      </div>

      <QuizGenerator />
      <ModelSettings />

      <div className="card space-y-3 p-5 text-[13px]">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock size={14} className="text-amber-300" /> 赛程
        </p>
        <div className="space-y-1.5 text-zinc-400">
          <p>· 省级选拔赛：2026 年 10 月中旬（拟定 {EXAM_DATE}）</p>
          <p>· 全国总决赛：2026 年 10 月 · 北京</p>
          <p>· 报名截止：2026-09-30 18:00 · <Link href="https://cmdr.com.cn" target="_blank" className="text-cyan-300 underline underline-offset-2">cmdr.com.cn</Link></p>
        </div>
      </div>

      <div className="card space-y-2.5 p-5 text-[12.5px] text-zinc-400">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          <BookMarked size={14} className="text-cyan-300" /> 备考资料位置
        </p>
        <p className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0 text-zinc-600" /> 官方样题（含答案）：Sync/工作/网安/04_行业比赛/20260919 人工智能赛事/附件1…样题.pdf</p>
        <p className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0 text-zinc-600" /> 考试大纲与考点清单：同目录《考试大纲与考点清单.md》</p>
        <p className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0 text-zinc-600" /> 职业技能标准（2021版）：同目录《人工智能训练师国家职业技能标准2021.pdf》</p>
      </div>

      <div className="card space-y-2 p-5 text-[12px] text-zinc-500">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300">
          <Info size={14} /> 关于 CogniLab
        </p>
        <p>AI 原生备赛训练系统 · 单人本地版。题库：官方样题 45 题 + 大纲手写题，支持 AI 出题扩充；实操覆盖 SQL / Python / 图表 / 流程 / 方案五类判分。</p>
        <p>AI 引擎：阿里云 Coding Plan + 智谱 ZCode 双供应商，可在上方配置按用途分配。数据存储于本地 data/cognilab.db。</p>
      </div>
    </div>
  );
}
