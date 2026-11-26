'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bot, X, Send, Loader2, Wrench, Quote } from 'lucide-react';
import Markdown from '../Markdown';
import { useKun } from './kun-context';
import { useEscape } from '@/lib/use-escape';

// 滚动期间隐藏悬浮球：短视口下悬浮球总会盖住某段内容，滚动结束 800ms 后浮现
function useFabHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      setHidden(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setHidden(false), 800);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return hidden;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  quote?: string;
  trace?: { name: string; summary: string }[];
  /** 仅流式输出期间为 true；不写入 localStorage */
  streaming?: boolean;
}

const STORE_KEY = 'kun_chat_v1';
const EMPTY_MSGS: Msg[] = [];

// 聊天记录做成组件外的小型外部存储：读写与 localStorage 持久化都在事件路径完成，
// 组件经 useSyncExternalStore 订阅；水合期间回退空列表，避免在 effect 里 setState。
let storeMsgs: Msg[] = EMPTY_MSGS;
const storeListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) storeMsgs = JSON.parse(saved).slice(-40);
  } catch { /* ignore */ }
}
const subscribeMsgs = (callback: () => void) => {
  storeListeners.add(callback);
  return () => { storeListeners.delete(callback); };
};
const getMsgs = () => storeMsgs;
const getServerMsgs = () => EMPTY_MSGS;
function setMsgs(next: Msg[] | ((prev: Msg[]) => Msg[]), persist = true) {
  storeMsgs = typeof next === 'function' ? next(storeMsgs) : next;
  if (persist) {
    try {
      const saved = storeMsgs.slice(-40).map((m) => ({
        role: m.role, content: m.content, quote: m.quote, trace: m.trace,
      }));
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch { /* ignore */ }
  }
  for (const listener of storeListeners) listener();
}

type KunProvider = 'g4' | 'zhipu';
const PROVIDER_KEY = 'kun_provider_v1';
const PROVIDER_LABEL: Record<KunProvider, string> = { g4: 'DeepSeek', zhipu: 'ZCode' };
const PROVIDER_HINT: Record<KunProvider, string> = { g4: 'G4 中继', zhipu: '智谱 ZCode' };

// 与聊天记录相同的组件外存储：首屏用 g4，水合后切到用户上次选择。
let storeProvider: KunProvider = 'g4';
const providerListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(PROVIDER_KEY);
    if (saved === 'g4' || saved === 'zhipu') storeProvider = saved;
  } catch { /* ignore */ }
}
const subscribeProvider = (callback: () => void) => {
  providerListeners.add(callback);
  return () => { providerListeners.delete(callback); };
};
const getProvider = () => storeProvider;
const getServerProvider = () => 'g4' as KunProvider;
function setProvider(next: KunProvider) {
  storeProvider = next;
  try { localStorage.setItem(PROVIDER_KEY, next); } catch { /* ignore */ }
  for (const listener of providerListeners) listener();
}

export default function KunChat({ askText, askSeq }: { askText: string; askSeq: number }) {
  const { open, setOpen, quote, setQuote } = useKun();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'streaming'>('idle');
  const msgs = useSyncExternalStore(subscribeMsgs, getMsgs, getServerMsgs);
  const provider = useSyncExternalStore(subscribeProvider, getProvider, getServerProvider);
  const lastSeq = useRef(askSeq);
  const listRef = useRef<HTMLDivElement>(null);
  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (askSeq !== lastSeq.current && askText) {
      lastSeq.current = askSeq;
      send(askText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSeq, askText]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    const q = quote;
    if (!content || loading) return;
    setInput('');
    setQuote('');
    setLoading(true);
    setPhase('thinking');
    const userMsg: Msg = { role: 'user', content, quote: q || undefined };
    setMsgs((m) => [...m, userMsg]);

    // 收集当前页面上下文
    const page = {
      route: location.pathname,
      title: document.title,
      text: (document.querySelector('main')?.innerText ?? '').slice(0, 1500),
    };

    let assistant = '';
    let traces: { name: string; summary: string }[] = [];
    let finalized = false;
    let lastPaint = 0;

    const paint = (persist = false, force = false) => {
      const now = Date.now();
      if (!persist && !force && now - lastPaint < 60) return;
      lastPaint = now;
      setMsgs((m) => m.map((msg) => (msg.streaming ? {
        ...msg,
        content: assistant,
        trace: traces.length ? traces : undefined,
      } : msg)), persist);
    };

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      setMsgs((m) => m.map((msg) => (msg.streaming ? {
        ...msg,
        content: assistant || '（坤哥走神了，再问一次）',
        trace: traces.length ? traces : undefined,
        streaming: false,
      } : msg)), true);
    };

    setMsgs((m) => [...m, { role: 'assistant', content: '', streaming: true }], false);

    try {
      const res = await fetch('/api/ai/kun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...msgs, userMsg].map((m) => ({ role: m.role, content: m.quote ? `[引用] ${m.quote}\n\n${m.content}` : m.content })),
          page,
          provider,
        }),
      });
      if (!res.ok) {
        let message = `请求失败（${res.status}）`;
        try {
          const data = await res.json() as { error?: string };
          if (data?.error) message = String(data.error);
        } catch { /* ignore */ }
        throw new Error(message);
      }
      if (!res.body) throw new Error('浏览器未收到流式响应');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sawDone = false;
      const handle = (payload: string) => {
        let ev: {
          type?: string;
          text?: string;
          content?: string;
          error?: string;
          trace?: { name?: string; summary?: string } | { name?: string; summary?: string }[];
        };
        try {
          ev = JSON.parse(payload);
        } catch {
          return;
        }
        if (ev.type === 'delta') {
          assistant += ev.text ?? '';
          setPhase('streaming');
          paint();
        } else if (ev.type === 'status') {
          setPhase('thinking');
        } else if (ev.type === 'trace') {
          if (ev.trace && !Array.isArray(ev.trace) && ev.trace.summary) {
            traces = [...traces, { name: String(ev.trace.name ?? '工具'), summary: String(ev.trace.summary) }];
            paint(false, true);
          }
        } else if (ev.type === 'done') {
          if (ev.content) assistant = ev.content;
          if (Array.isArray(ev.trace)) {
            traces = ev.trace
              .map((t) => ({ name: String(t.name ?? '工具'), summary: String(t.summary ?? '') }))
              .filter((t) => t.summary);
          }
          sawDone = true;
          setPhase('idle');
          finalize();
        } else if (ev.type === 'error') {
          throw new Error(ev.error || '流式请求失败');
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.split(/\r?\n/).find((l) => l.startsWith('data:'));
          const payload = line?.slice(5).trim();
          if (payload) handle(payload);
        }
      }
      const tail = buffer.split(/\r?\n/).find((l) => l.startsWith('data:'));
      const tailPayload = tail?.slice(5).trim();
      if (tailPayload) handle(tailPayload);
      if (!sawDone) {
        if (!assistant) throw new Error('流式响应意外中断');
        finalize();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      assistant = assistant ? `${assistant}\n\n⚠️ ${message}` : `⚠️ ${message}`;
      finalize();
    } finally {
      setLoading(false);
      setPhase('idle');
    }
  }

  return (
    <>
      {/* 悬浮球 */}
      {!open && <FabButton onOpen={() => setOpen(true)} />}

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
                onClick={() => { if (!loading && confirm('清空与坤哥的对话？')) setMsgs([]); }}
                disabled={loading}
                className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                清空
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:text-white">
              <X size={17} />
            </button>
          </div>

          {/* 模型切换：DeepSeek（G4 中继）/ ZCode（智谱） */}
          <div className="flex items-center gap-1.5 border-b border-white/8 px-4 py-2">
            <span className="text-[10px] text-zinc-600">模型</span>
            <div role="group" aria-label="选择坤哥模型" className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {(['g4', 'zhipu'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={provider === key}
                  onClick={() => setProvider(key)}
                  disabled={loading}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    provider === key ? 'bg-violet-500/30 font-medium text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {PROVIDER_LABEL[key]}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-zinc-600">{PROVIDER_HINT[provider]}</span>
          </div>

          {/* 消息列表 */}
          <div ref={listRef} aria-live="polite" aria-busy={loading} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
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
                    : (
                      <>
                        <Markdown>{m.content || ' '}</Markdown>
                        {m.streaming && (
                          <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse rounded-full bg-violet-300 align-middle" />
                        )}
                      </>
                    )}
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
            {loading && phase === 'thinking' && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-violet-300" />
                  <span className="text-[12px] text-zinc-400">{PROVIDER_LABEL[provider]} 查资料 / 思考中…</span>
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
                placeholder="问坤哥…（Enter 发送）"
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

function FabButton({ onOpen }: { onOpen: () => void }) {
  const hidden = useFabHidden();
  return (
    <button
      onClick={onOpen}
      aria-label="打开坤哥助手"
      className={`fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl shadow-violet-500/30 transition-all duration-300 active:scale-90 md:bottom-8 ${
        hidden ? 'pointer-events-none translate-y-2 opacity-0' : 'opacity-100'
      }`}
    >
      <Bot size={26} className="text-white" />
      <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-bold text-white">坤</span>
    </button>
  );
}
