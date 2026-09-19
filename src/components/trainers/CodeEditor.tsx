'use client';

import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-python';

export default function CodeEditor({
  value, onChange, language, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  language: 'sql' | 'python';
  placeholder?: string;
}) {
  return (
    <div className="overflow-auto rounded-xl border border-white/10 bg-[#0c0c14] p-3">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => Prism.highlight(code, Prism.languages[language], language)}
        padding={10}
        placeholder={placeholder}
        className="code-area min-h-[160px] focus:outline-none"
        textareaClassName="focus:outline-none"
        style={{ minHeight: 160 }}
      />
    </div>
  );
}
