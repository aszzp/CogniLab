'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import KunChat from './KunChat';
import { Ctx } from './kun-context';

export default function KunProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState('');
  const [askText, setAskText] = useState('');
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const askSeq = useRef(0);

  const ask = useCallback((text: string) => {
    setQuote('');
    setAskText(text);
    askSeq.current += 1;
    setOpen(true);
  }, []);

  // 全局选中文字 → "问坤哥"气泡
  useEffect(() => {
    const onUp = () => {
      // 等一下让 selection 稳定
      setTimeout(() => {
        const s = window.getSelection();
        const text = s?.toString().trim() ?? '';
        if (!s || s.rangeCount === 0 || text.length < 2 || text.length > 2000) {
          setSel(null);
          return;
        }
        const anchor = s.anchorNode;
        const el = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (!el || !el.closest('main')) {
          setSel(null);
          return;
        }
        const rect = s.getRangeAt(0).getBoundingClientRect();
        const x = Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60);
        const y = Math.min(rect.bottom + 8, window.innerHeight - 56);
        setSel({ text, x, y });
      }, 10);
    };
    const clear = () => setSel(null);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    document.addEventListener('scroll', clear, true);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('scroll', clear, true);
    };
  }, []);

  return (
    <Ctx.Provider value={{ open, setOpen, quote, setQuote, ask }}>
      {children}
      {/* 选中文字气泡 */}
      {sel && !open && (
        <button
          onClick={() => {
            setQuote(sel.text);
            setOpen(true);
            window.getSelection()?.removeAllRanges();
            setSel(null);
          }}
          className="fixed z-[60] -translate-x-1/2 rounded-full border border-violet-400/40 bg-[#1a1526]/95 px-3.5 py-1.5 text-xs font-medium text-violet-200 shadow-lg shadow-violet-500/20 backdrop-blur-md"
          style={{ left: sel.x, top: sel.y }}
        >
          ✨ 问坤哥
        </button>
      )}
      <KunChat askText={askText} askSeq={askSeq.current} />
    </Ctx.Provider>
  );
}
