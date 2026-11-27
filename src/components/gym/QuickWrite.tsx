'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, CornerDownLeft, Eye, EyeOff, Keyboard, RotateCcw, Timer, XCircle,
} from 'lucide-react';
import type { GymItem } from '@/lib/gym/types';

type Status = 'idle' | 'wrong' | 'done';
type Mode = 'quick' | 'full';

/** 去掉行尾注释，避免速写时被迫输入解释文字。 */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

function toLines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map(stripComment)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

/** 空格、缩进、引号写法不计错；代码 token 和顺序仍然严格比较。 */
function normalizeLine(line: string): string {
  return line
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/'/g, '"')
    .replace(/;+$/, '');
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function diffParts(typed: string, expected: string) {
  let prefix = 0;
  while (prefix < typed.length && prefix < expected.length && typed[prefix] === expected[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < typed.length - prefix
    && suffix < expected.length - prefix
    && typed[typed.length - 1 - suffix] === expected[expected.length - 1 - suffix]
  ) suffix++;
  return {
    prefix,
    typedMid: typed.slice(prefix, typed.length - suffix),
    expectedMid: expected.slice(prefix, expected.length - suffix),
    suffix,
  };
}

function LineDiff({ typed, expected }: { typed: string; expected: string }) {
  const { prefix, typedMid, expectedMid, suffix } = diffParts(typed, expected);
  const typedPrefix = typed.slice(0, prefix);
  const typedSuffix = typed.slice(typed.length - suffix);
  const expectedPrefix = expected.slice(0, prefix);
  const expectedSuffix = expected.slice(expected.length - suffix);
  return (
    <div className="space-y-1.5 rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-3">
      <p className="flex items-center gap-1 text-[11px] font-medium text-rose-200">
        <XCircle size={12} /> 这一行有出入
      </p>
      <div>
        <p className="text-[9.5px] uppercase tracking-wider text-zinc-500">你的输入</p>
        <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/25 px-2.5 py-2 font-mono text-[11.5px] leading-5 text-zinc-300">
          {typedPrefix}
          {typedMid
            ? <span className="rounded bg-rose-500/25 px-0.5 text-rose-200 underline decoration-rose-400/70">{typedMid}</span>
            : <span className="rounded bg-rose-500/15 px-0.5 text-[10px] text-rose-300">（缺少）</span>}
          {typedSuffix}
        </pre>
      </div>
      <div>
        <p className="text-[9.5px] uppercase tracking-wider text-zinc-500">正确写法</p>
        <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/25 px-2.5 py-2 font-mono text-[11.5px] leading-5 text-emerald-200/90">
          {expectedPrefix}
          {expectedMid
            ? <span className="rounded bg-emerald-500/20 px-0.5 text-emerald-200 underline decoration-emerald-400/60">{expectedMid}</span>
            : <span className="text-emerald-300">（无需补字符）</span>}
          {expectedSuffix}
        </pre>
      </div>
      <p className="text-[10px] text-zinc-500">
        空格、缩进、单双引号不计错；改完再按 Enter。⌘/Ctrl+R 可以从头再来。
      </p>
    </div>
  );
}

export default function QuickWrite({ item }: { item: GymItem }) {
  const quickSource = item.quickCode ?? item.formula?.code ?? '';
  const fullSource = item.skeleton ?? '';
  const [mode, setMode] = useState<Mode>('quick');
  const source = mode === 'full' && fullSource ? fullSource : quickSource;
  const lines = useMemo(() => toLines(source), [source]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [wrong, setWrong] = useState<{ typed: string; expected: string } | null>(null);
  const [showRef, setShowRef] = useState(true);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!started || status === 'done') return;
    const id = window.setInterval(() => {
      if (startedAt.current != null) setElapsed(Date.now() - startedAt.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [started, status]);

  // 速写页挂着时，⌘/Ctrl+R 在页面任意位置都重开，不触发浏览器刷新。
  useEffect(() => {
    function onShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetRef.current();
      }
    }
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  function reset(nextMode = mode) {
    if (nextMode !== mode) {
      setMode(nextMode);
      setBest(null);
    }
    setIndex(0);
    setValue('');
    setStatus('idle');
    setWrong(null);
    setStarted(false);
    setElapsed(0);
    startedAt.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    resetRef.current = reset;
  });

  function change(next: string) {
    if (status === 'done') return;
    if (!started) {
      startedAt.current = Date.now();
      setStarted(true);
    }
    setValue(next);
    if (status === 'wrong') {
      setStatus('idle');
      setWrong(null);
    }
  }

  function check() {
    const expected = lines[index];
    if (!expected) return;
    if (!started) {
      startedAt.current = Date.now();
      setStarted(true);
    }
    const typed = stripComment(value).trim();
    if (normalizeLine(typed) === normalizeLine(expected)) {
      setWrong(null);
      if (index + 1 >= lines.length) {
        const finalMs = startedAt.current == null ? 0 : Date.now() - startedAt.current;
        setElapsed(finalMs);
        setBest((prev) => (prev == null ? finalMs : Math.min(prev, finalMs)));
        setStatus('done');
      } else {
        setIndex((i) => i + 1);
        setValue('');
        setStatus('idle');
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } else {
      setWrong({ typed, expected });
      setStatus('wrong');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (
      e.key === 'Enter'
      && e.target === inputRef.current
      && !e.metaKey && !e.ctrlKey && !e.altKey
      && !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      check();
    }
  }

  if (!lines.length) {
    return <div className="card p-5 text-[12px] text-zinc-500">这张卡还没有速写内容。</div>;
  }

  const progress = status === 'done' ? 100 : Math.round((index / lines.length) * 100);

  return (
    <section
      className="card space-y-3 p-4"
      onKeyDown={handleKeyDown}
      aria-label="代码速写练习"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-2 py-0.5 text-[10px] font-medium text-cyan-200">
            <Keyboard size={10} /> 代码速写
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">
            {mode === 'full' ? '完整函数' : (item.formula?.label ?? '核心代码')}
          </span>
          <span className="flex items-center gap-1 text-[10px] tabular-nums text-zinc-500">
            <Timer size={10} /> {formatTime(elapsed)}
          </span>
          {best != null && <span className="text-[10px] tabular-nums text-amber-200/80">最佳 {formatTime(best)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 text-[10.5px]">
          <p className="text-zinc-500">逐行默写：按 Enter 检查当前行，错了会标出差异。</p>
          <p className="shrink-0 tabular-nums text-zinc-400">{Math.min(index + 1, lines.length)} / {lines.length}</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => reset('quick')}
          aria-pressed={mode === 'quick'}
          className={`rounded-lg border px-2.5 py-1 text-[10.5px] transition-colors ${
            mode === 'quick' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          核心行
        </button>
        {fullSource && (
          <button
            type="button"
            onClick={() => reset('full')}
            aria-pressed={mode === 'full'}
            className={`rounded-lg border px-2.5 py-1 text-[10.5px] transition-colors ${
              mode === 'full' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            完整函数
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowRef((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10.5px] text-zinc-400 hover:text-zinc-200"
        >
          {showRef ? <EyeOff size={11} /> : <Eye size={11} />} {showRef ? '隐藏参考' : '看参考'}
        </button>
      </div>

      {showRef ? (
        <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0c0c14] p-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded px-1.5 py-0.5 font-mono text-[11.5px] leading-5 ${
                i === index && status !== 'done'
                  ? 'bg-cyan-400/10 text-cyan-100'
                  : i < index || status === 'done'
                    ? 'text-emerald-300/70'
                    : 'text-zinc-500'
              }`}
            >
              <span className="w-4 shrink-0 select-none pt-0.5 text-right text-[9px] tabular-nums text-zinc-700">{i + 1}</span>
              <span className="whitespace-pre">{line}</span>
              {(i < index || status === 'done') && <CheckCircle2 size={11} className="ml-auto mt-1 shrink-0 text-emerald-400" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-4 text-[11.5px] text-zinc-500">
          <EyeOff size={13} /> 参考已隐藏，先凭记忆写第 {index + 1} 行；答错会自动显示差异。
        </div>
      )}

      {status === 'done' ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4 text-center">
          <CheckCircle2 size={24} className="mx-auto text-emerald-300" />
          <p className="mt-1 text-[13px] font-semibold text-emerald-100">这一组写完了</p>
          <p className="mt-0.5 text-[11.5px] tabular-nums text-emerald-200/70">
            {lines.length} 行 · 用时 {formatTime(elapsed)}{best != null && best === elapsed ? ' · 新纪录' : ''}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="grad-btn mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
          >
            <RotateCcw size={13} /> 再来一次
          </button>
          <p className="mt-2 text-[10px] text-zinc-500">⌘/Ctrl+R 也可以直接清空重来</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[11px] text-zinc-400">
              <CornerDownLeft size={12} className="text-cyan-300" /> 输入第 {index + 1} 行
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              <RotateCcw size={10} /> 清空
            </button>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => change(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={`速写第 ${index + 1} 行`}
              placeholder={index === 0 ? '从第一行开始…' : '继续下一行…'}
              className={`min-w-0 flex-1 rounded-xl border bg-[#0c0c14] px-3 py-2.5 font-mono text-[12px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 ${
                status === 'wrong' ? 'border-rose-400/60 focus:border-rose-300' : 'border-cyan-400/30 focus:border-cyan-300'
              }`}
            />
            <button
              type="button"
              onClick={check}
              className="grad-btn flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2.5 text-[11.5px] font-semibold text-white"
            >
              <CornerDownLeft size={12} /> 检查
            </button>
          </div>
          {status === 'wrong' && wrong && <LineDiff typed={wrong.typed} expected={wrong.expected} />}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><CornerDownLeft size={10} /> Enter 检查</span>
            <span>⌘/Ctrl+R 清空</span>
            <span className="ml-auto">空格/缩进/单双引号不计错</span>
          </div>
        </div>
      )}

      {mode === 'full' && (
        <p className="text-[10px] leading-relaxed text-zinc-600">
          完整函数模式按行拆开，缩进不参与比较；用于练结构和关键词顺序。
        </p>
      )}
    </section>
  );
}
