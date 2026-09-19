'use client';

import { useState, useRef } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { Question } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = { single: '单选', multi: '多选', judge: '判断' };

export default function AIExplain({ question }: { question: Question }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  async function run() {
    if (loading) return;
    if (!open) setOpen(true);
    if (started.current && text) return; // 已有内容则直接展开
    started.current = true;
    setLoading(true);
    setText('');
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } catch {
      setText('⚠️ AI 解析请求失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={run}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 py-2.5 text-sm font-medium text-violet-300 transition-colors active:scale-[0.98]"
      >
        <Sparkles size={15} className={loading ? 'pulse-soft' : ''} />
        {loading ? 'AI 教练思考中…' : 'AI 解析'}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-4">
      <button
        onClick={() => setOpen(false)}
        className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-300"
      >
        <Sparkles size={13} /> AI 教练解析
        <ChevronUp size={13} className="ml-auto" />
      </button>
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-300">
        {text}
        {loading && <span className="pulse-soft ml-0.5">▍</span>}
      </p>
      {!loading && (
        <button
          onClick={run}
          className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          <ChevronDown size={12} /> 重新生成
        </button>
      )}
    </div>
  );
}

export { TYPE_LABEL };
