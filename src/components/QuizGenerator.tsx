'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Check, PlusCircle } from 'lucide-react';

const MODULES = ['职业道德与基础知识', '数据处理与标注', '业务分析', '智能训练', '智能系统设计', '培训与指导', '数字人专项'];

interface GenQ {
  type: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

export default function QuizGenerator() {
  const router = useRouter();
  const [mod, setMod] = useState('数字人');
  const [qs, setQs] = useState<GenQ[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    setQs(null);
    setSaved(null);
    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: mod }),
      });
      const data = await res.json();
      if (data.questions) setQs(data.questions);
      else alert(data.error || '生成失败');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!qs) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: mod, save: true, questions: qs }),
      });
      const data = await res.json();
      setSaved(data.saved ?? 0);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles size={14} className="text-violet-300" /> AI 出题扩充题库
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">按大纲知识点生成新题，预览确认后入库</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <button key={m} onClick={() => setMod(m)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${mod === m ? 'border-violet-400/60 bg-violet-500/15 text-violet-200' : 'border-white/12 text-zinc-500'}`}>
            {m}
          </button>
        ))}
      </div>
      <button onClick={generate} disabled={loading}
        className="grad-btn mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
        {loading ? '命题中…' : `生成 5 道「${mod}」新题`}
      </button>

      {qs && (
        <div className="fade-up mt-4 space-y-2.5">
          {qs.map((q, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] p-3 text-[12.5px]">
              <p className="text-zinc-200">
                <span className="mr-1 rounded bg-white/10 px-1 text-[10px] text-zinc-400">{q.type === 'judge' ? '判断' : '单选'}</span>
                {q.stem}
              </p>
              <p className="mt-1 text-[11px] text-emerald-300/80">答案 {q.answer} · {q.explanation}</p>
            </div>
          ))}
          {saved === null ? (
            <button onClick={save} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white active:scale-[0.98]">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              确认无误，全部入库
            </button>
          ) : (
            <p className="text-center text-xs text-emerald-300">✓ 已入库 {saved} 题，去刷题模块使用吧</p>
          )}
        </div>
      )}
    </div>
  );
}
