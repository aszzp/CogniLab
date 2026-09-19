'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Loader2, Wrench, Quote } from 'lucide-react';
import Markdown from '../Markdown';
import { useKun } from './kun-context';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  quote?: string;
  trace?: { name: string; summary: string }[];
}

const STORE_KEY = 'kun_chat_v1';

export default function KunChat({ askText, askSeq }: { askText: string; askSeq: number }) {
  const { open, setOpen, quote, setQuote } = useKun();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const lastSeq = useRef(askSeq);
  const listRef = useRef<HTMLDivElement>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) setMsgs(JSON.parse(saved).slice(-40));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (askSeq !== lastSeq.current && askText) {
      lastSeq.current = askSeq;
      send(askText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSeq, askText]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch { /* ignore */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    const q = quote;
    if (!content || loading) return;
    setInput('');
    setQuote('');
    const userMsg: Msg = { role: 'user', content, quote: q || undefined };
    setMsgs((m) => [...m, userMsg]);
    setLoading(true);

    // 收集当前页面上下文
    const page = {
      route: location.pathname,
      title: document.title,
      text: (document.querySelector('main')?.innerText ?? '').slice(0, 1500),
    };

    try {
      const res = await fetch('/api/ai/kun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...msgs, userMsg].map((m) => ({ role: m.role, content: m.quote ? `[引用] ${m.quote}\n\n${m.content}` : m.content })),
          page,
        }),
      });
      const data = await res.json();
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: data.content || data.error || '（坤哥走神了，再问一次）', trace: data.trace },
      ]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '⚠️ 网络异常，请重试' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* 悬浮球 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="打开坤哥助手"
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl shadow-violet-500/30 transition-transform active:scale-90 md:bottom-8"
        >
          <Bot size={26} className="text-white" />
          <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-bold text-white">坤</span>
        </button>
      )}

      {/* 对话面板 */}
      {open && (
        <div className="fixed inset-x-2 bottom-2 top-14 z-50 flex flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b13]/97 shadow-2xl backdrop-blur-xl md:inset-x-auto md:right-6 md:top-auto md:bottom-24 md:h-[600px] md:w-[420px]">
          {/* 头部 */}
          <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500">
              <Bot size={19} className="text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">坤哥 <span className="ml-1 text-[10px] font-normal text-zinc-500">AI 学习管家</span></p>
              <p className="text-[10px] text-emerald-400">● 在线 · 持有题库/错题/考纲工具</p>
            </div>
            {msgs.length > 0 && (
              <button
                onClick={() => { if (confirm('清空与坤哥的对话？')) setMsgs([]); }}
                className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                清空
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:text-white">
              <X size={17} />
            </button>
          </div>

          {/* 消息列表 */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
            {msgs.length === 0 && (
              <div className="mt-6 space-y-3 px-2 text-center">
                <p className="text-2xl">👋</p>
                <p className="text-[13px] text-zinc-400">我是坤哥，随时帮你备考。可以问我：</p>
                <div className="space-y-2 text-left">
                  {['我最近的正确率怎么样？该重点补哪个模块？', '把数字人模块的考纲知识点给我讲讲', '给我出 5 道业务分析的新题', 'SQL 的 WHERE IN 是什么意思？'].map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-zinc-300 transition-colors active:scale-[0.98]">
                      {s}
                    </button>
                  ))}
                </div>
                <p className="pt-2 text-[10.5px] text-zinc-600">提示：在任意页面选中文字，点「问坤哥」可以带引用提问</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white' : 'border border-white/10 bg-white/[0.04]'}`}>
                  {m.quote && (
                    <div className="mb-1.5 flex items-start gap-1.5 rounded-lg bg-black/25 px-2.5 py-1.5 text-[11px] leading-relaxed opacity-80">
                      <Quote size={10} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-3">{m.quote}</span>
                    </div>
                  )}
                  {m.role === 'user'
                    ? <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.content}</p>
                    : <Markdown>{m.content}</Markdown>}
                  {m.trace && m.trace.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-white/8 pt-2">
                      {m.trace.map((t, j) => (
                        <p key={j} className="flex items-center gap-1 text-[10.5px] text-cyan-300/70">
                          <Wrench size={9} /> {t.summary}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-violet-300" />
                  <span className="text-[12px] text-zinc-400">坤哥查资料 / 思考中…</span>
                </div>
              </div>
            )}
          </div>

          {/* 引用提示 + 输入区 */}
          <div className="border-t border-white/8 p-3">
            {quote && (
              <div className="mb-2 flex items-start gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] text-violet-200">
                <Quote size={10} className="mt-0.5 shrink-0" />
                <span className="line-clamp-2 flex-1">{quote}</span>
                <button onClick={() => setQuote('')} className="shrink-0 text-violet-300/60 hover:text-white"><X size={12} /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="问坤哥 anything…（Enter 发送）"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none"
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="grad-btn flex h-[42px] w-[46px] items-center justify-center rounded-2xl text-white">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
