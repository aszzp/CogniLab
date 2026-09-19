'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timer } from 'lucide-react';

const MODES = [
  { mode: 'sample45', title: '全真模拟', desc: '45 题 · 90 分钟 · 对标官方样卷结构', cls: 'from-violet-600 to-cyan-600' },
  { mode: 'quick20', title: '快速模拟', desc: '20 题 · 40 分钟 · 随机抽题', cls: 'from-indigo-500 to-violet-500' },
  { mode: 'sprint10', title: '冲刺小卷', desc: '10 题 · 15 分钟 · 碎片时间冲刺', cls: 'from-cyan-600 to-teal-500' },
];

export default function ExamStarter() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function start(mode: string) {
    setLoading(mode);
    try {
      const res = await fetch('/api/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.id) router.push(`/exam/${data.id}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => start(m.mode)}
          disabled={!!loading}
          className={`flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r ${m.cls} p-5 text-left transition-transform active:scale-[0.98] disabled:opacity-50`}
        >
          <Timer size={22} className="text-white/90" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-white">{m.title}</p>
            <p className="mt-0.5 text-[11px] text-white/70">{m.desc}</p>
          </div>
          <span className="text-xs font-medium text-white/80">
            {loading === m.mode ? '组卷中…' : '开始'}
          </span>
        </button>
      ))}
    </div>
  );
}
