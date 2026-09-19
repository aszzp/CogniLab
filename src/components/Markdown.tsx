'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h3 className="mb-2 mt-3 text-[15px] font-bold text-zinc-100" {...p} />,
        h2: (p) => <h3 className="mb-2 mt-3 text-[15px] font-bold text-zinc-100" {...p} />,
        h3: (p) => <h4 className="mb-1.5 mt-3 text-[14px] font-bold grad-text" {...p} />,
        p: (p) => <p className="my-2 text-[13.5px] leading-relaxed text-zinc-300" {...p} />,
        ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed text-zinc-300" {...p} />,
        ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-zinc-300" {...p} />,
        li: (p) => <li className="marker:text-violet-400" {...p} />,
        strong: (p) => <strong className="font-semibold text-zinc-100" {...p} />,
        code: (p) => <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-cyan-300" {...p} />,
        pre: (p) => <pre className="code-area my-2 overflow-x-auto rounded-xl border border-white/10 bg-[#0c0c14] p-3 text-zinc-300" {...p} />,
        table: (p) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]" {...p} />
          </div>
        ),
        th: (p) => <th className="border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-left font-semibold text-zinc-200" {...p} />,
        td: (p) => <td className="border border-white/10 px-2.5 py-1.5 text-zinc-400" {...p} />,
        blockquote: (p) => <blockquote className="my-2 border-l-2 border-violet-400/50 pl-3 text-zinc-400" {...p} />,
        a: (p) => <a className="text-cyan-300 underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
