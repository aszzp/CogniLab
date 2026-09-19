import Link from 'next/link';
import { ChevronRight, BookOpen } from 'lucide-react';
import { moduleStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

const MODULE_DESC: Record<string, string> = {
  职业道德与基础知识: '职业守则 · 四部法律 · 鉴定方式 · 权重表（标准§1/§2）',
  数据处理与标注: '数据采集处理 · 清洗标注 · 标注类型 · 系统运维（五级/四级功能）',
  业务分析: '采集/处理/审核流程设计 · 特征工程 · SQL · 业务架构挖掘（三级→一级功能1）',
  智能训练: '清洗标注规范 · 算法测试 · 黄金测试集 · 训练调优（三级→一级功能2）',
  智能系统设计: '监控优化 · 人机交互流程 · 解决方案设计 · 产品功能实现（三级→一级功能3）',
  培训与指导: '培训讲义 · 指导初中级工 · 培训计划与体系（三级→一级功能4）',
  数字人专项: 'Prompt人设 · 多模态 · 口型同步 · 幻觉率（工种特色知识）',
};

export default function PracticePage() {
  const stats = moduleStats();
  return (
    <div className="fade-up space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <BookOpen size={18} className="text-violet-300" />
        <h1 className="text-lg font-bold">模块刷题</h1>
        <span className="ml-auto text-xs text-zinc-500">{stats.reduce((a, b) => a + b.total, 0)} 题</span>
      </div>
      {stats.map((m) => (
        <Link key={m.module} href={`/practice/${encodeURIComponent(m.module)}`} className="card block p-5 transition-transform active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-[15px] font-semibold">{m.module}</p>
                <span className="text-[11px] text-zinc-500">
                  {m.attempted ? `正确率 ${m.accuracy}%` : '未开始'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{MODULE_DESC[m.module] ?? ''}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700"
                  style={{ width: `${m.attempted ? Math.max(5, (m.attempted / m.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10.5px] text-zinc-600">已练 {m.attempted} / {m.total} 题</p>
            </div>
            <ChevronRight size={18} className="text-zinc-600" />
          </div>
        </Link>
      ))}
    </div>
  );
}
