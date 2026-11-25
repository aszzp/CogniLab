'use client';

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-python';

export default function CodeEditor({
  value, onChange, language, placeholder, minHeight = 160, tabSize = 2, autoIndent = false,
}: {
  value: string;
  onChange: (v: string) => void;
  language: 'sql' | 'python';
  placeholder?: string;
  minHeight?: number;
  tabSize?: number;
  /** 回车时沿用当前行的缩进，行尾是冒号则再缩进一级 */
  autoIndent?: boolean;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>) {
    if (!autoIndent || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLTextAreaElement;
    const { selectionStart: start, selectionEnd: end, value: text } = el;
    const line = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
    const indent = /^\s*/.exec(line)?.[0] ?? '';
    const extra = /:\s*(#.*)?$/.test(line) ? ' '.repeat(tabSize) : '';
    const inserted = `\n${indent}${extra}`;
    onChange(text.slice(0, start) + inserted + text.slice(end));
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + inserted.length; });
  }

  return (
    <div className="overflow-auto rounded-xl border border-white/10 bg-[#0c0c14] p-3">
      <Editor
        value={value}
        onValueChange={onChange}
        onKeyDown={handleKeyDown}
        tabSize={tabSize}
        highlight={(code) => Prism.highlight(code, Prism.languages[language], language)}
        padding={10}
        placeholder={placeholder}
        className="code-area focus:outline-none"
        textareaClassName="focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
