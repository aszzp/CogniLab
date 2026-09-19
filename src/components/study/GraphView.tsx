'use client';

import { useMemo, useState } from 'react';
import { CircleDot, CheckCircle2, CircleCheckBig } from 'lucide-react';
import type { SyllabusItem } from '@/app/study/page';

const MODULE_ORDER = ['职业道德与基础知识', '数据处理与标注', '业务分析', '智能训练', '智能系统设计', '培训与指导', '数字人专项'];
const MODULE_COLOR: Record<string, string> = {
  职业道德与基础知识: '#f59e0b',
  数据处理与标注: '#38bdf8',
  业务分析: '#22d3ee',
  智能训练: '#34d399',
  智能系统设计: '#fb7185',
  培训与指导: '#a78bfa',
  数字人专项: '#e879f9',
};

const SHORT: Record<string, [string, string]> = {
  职业道德与基础知识: ['职业道德', '基础知识'],
  数据处理与标注: ['数据处理', '与标注'],
  业务分析: ['业务', '分析'],
  智能训练: ['智能', '训练'],
  智能系统设计: ['系统', '设计'],
  培训与指导: ['培训', '指导'],
  数字人专项: ['数字人', '专项'],
};

export default function GraphView({
  items,
  onSelectTopic,
}: {
  items: SyllabusItem[];
  onSelectTopic: (t: SyllabusItem) => void;
}) {
  const [activeSection, setActiveSection] = useState<{ module: string; section: string } | null>(null);

  const layout = useMemo(() => {
    const modules = MODULE_ORDER.filter((m) => items.some((x) => x.module === m)).map((m, i, arr) => {
      const angle = (-90 + (360 / arr.length) * i) * (Math.PI / 180);
      const secs = [...new Set(items.filter((x) => x.module === m).map((x) => x.section))];
      const spread = (58 * (Math.PI / 180));
      const sectionNodes = secs.map((sec, j) => {
        const a = secs.length === 1 ? angle : angle - spread / 2 + (spread / (secs.length - 1)) * j;
        return { sec, x: Math.cos(a) * 235, y: Math.sin(a) * 235 };
      });
      const list = items.filter((x) => x.module === m);
      return {
        name: m,
        color: MODULE_COLOR[m] ?? '#8b5cf6',
        x: Math.cos(angle) * 118,
        y: Math.sin(angle) * 118,
        sections: sectionNodes,
        mastered: list.filter((x) => x.mastered === 2).length,
        total: list.length,
      };
    });
    return modules;
  }, [items]);

  const activeItems = activeSection ? items.filter((x) => x.module === activeSection.module && x.section === activeSection.section) : [];
  const MASTER_ICON = [CircleDot, CheckCircle2, CircleCheckBig];
  const MASTER_CLS = ['text-zinc-600', 'text-cyan-300', 'text-emerald-400'];

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto p-2">
        <p className="px-2 pb-1 pt-1 text-[10.5px] text-zinc-600">知识图谱 · 点击章节节点查看知识点（左右滑动查看全图）</p>
        <svg viewBox="-320 -320 640 640" className="h-[min(78vw,560px)] min-w-[540px]">
          <defs>
            {layout.map((m) => (
              <radialGradient key={m.name} id={`g-${m.name}`}>
                <stop offset="0%" stopColor={m.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0.45" />
              </radialGradient>
            ))}
          </defs>
          {/* 连线 */}
          {layout.map((m) => (
            <g key={`l-${m.name}`}>
              <line x1={0} y1={0} x2={m.x} y2={m.y} stroke={m.color} strokeOpacity={0.35} strokeWidth={3} />
              {m.sections.map((s) => (
                <line key={s.sec} x1={m.x} y1={m.y} x2={s.x} y2={s.y} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1.5} />
              ))}
            </g>
          ))}
          {/* 中心 */}
          <circle r={52} fill="#12101e" stroke="#8b5cf6" strokeOpacity={0.5} strokeWidth={2} />
          <circle r={52} fill="url(#g-数字人)" fillOpacity={0.12} />
          <text y={-8} textAnchor="middle" fill="#e4e4e7" fontSize={15} fontWeight={700}>AI 数字人</text>
          <text y={12} textAnchor="middle" fill="#a1a1aa" fontSize={11}>训练师 · 备赛考纲</text>
          <text y={30} textAnchor="middle" fill="#71717a" fontSize={9}>
            {items.length} 知识点 · 掌握 {items.filter((x) => x.mastered === 2).length}
          </text>
          {/* 模块与章节 */}
          {layout.map((m) => (
            <g key={m.name}>
              <circle cx={m.x} cy={m.y} r={36} fill={`url(#g-${m.name})`} stroke={m.color} strokeOpacity={0.7} strokeWidth={1.5} />
              <text x={m.x} y={m.y - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{SHORT[m.name]?.[0] ?? m.name}</text>
              <text x={m.x} y={m.y + 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{SHORT[m.name]?.[1] ?? ''}</text>
              <text x={m.x} y={m.y + 19} textAnchor="middle" fill="#ffffff" fillOpacity={0.75} fontSize={8.5}>{m.mastered}/{m.total}</text>
              {m.sections.map((s) => {
                const active = activeSection?.module === m.name && activeSection?.section === s.sec;
                const w = Math.max(s.sec.length * 11 + 22, 64);
                return (
                  <g key={s.sec} onClick={() => setActiveSection(active ? null : { module: m.name, section: s.sec })}
                    className="cursor-pointer">
                    <rect x={s.x - w / 2} y={s.y - 14} width={w} height={28} rx={14}
                      fill={active ? m.color : '#15151f'} fillOpacity={active ? 0.85 : 0.95}
                      stroke={m.color} strokeOpacity={active ? 1 : 0.35} strokeWidth={1.2} />
                    <text x={s.x} y={s.y + 4.5} textAnchor="middle" fill={active ? '#fff' : '#d4d4d8'} fontSize={11}>
                      {s.sec.length > 8 ? s.sec.slice(0, 8) + '…' : s.sec}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* 选中章节的知识点 */}
      {activeSection && (
        <div className="fade-up card p-4">
          <p className="mb-3 text-[13px] font-semibold">
            <span style={{ color: MODULE_COLOR[activeSection.module] }}>{activeSection.module}</span>
            <span className="mx-1.5 text-zinc-600">/</span>
            {activeSection.section}
            <span className="ml-2 text-[11px] font-normal text-zinc-500">{activeItems.length} 个知识点 · 点击学习</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {activeItems.map((it) => {
              const MIcon = MASTER_ICON[it.mastered];
              return (
                <button key={it.id} onClick={() => onSelectTopic(it)}
                  className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] py-1.5 pl-2 pr-3 text-[12.5px] text-zinc-300 transition-colors active:scale-[0.97]">
                  <MIcon size={12} className={MASTER_CLS[it.mastered]} />
                  {it.topic}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
