'use client';

import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Eye, EyeOff, Lightbulb } from 'lucide-react';
import CodeEditor from './CodeEditor';
import type { Task } from '@/lib/types';

interface SqlResp {
  error?: string;
  pass?: boolean;
  colsMatch?: boolean;
  rowsMatch?: boolean;
  yourCount?: number;
  expectedCount?: number;
  result?: { columns: string[]; rows: (string | number | null)[][] };
}

export default function SqlTrainer({ task }: { task: Task }) {
  const [code, setCode] = useState('SELECT r.xm AS "username", ...\nFROM use_record r\nWHERE ...');
  const [resp, setResp] = useState<SqlResp | null>(null);
  const [running, setRunning] = useState(false);
  const [showRef, setShowRef] = useState(false);

  async function run() {
    setRunning(true);
    setResp(null);
    try {
      const res = await fetch('/api/run/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, code }),
      });
      setResp(await res.json());
    } catch {
      setResp({ error: '请求失败' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <CodeEditor value={code} onChange={setCode} language="sql" />

      <div className="flex gap-3">
        <button onClick={run} disabled={running}
          className="grad-btn flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white">
          <Play size={15} /> {running ? '执行中…' : '运行并判分'}
        </button>
        <button onClick={() => setShowRef(!showRef)}
          className="flex items-center gap-1.5 rounded-xl border border-white/12 px-4 text-xs text-zinc-400">
          {showRef ? <EyeOff size={13} /> : <Eye size={13} />} 参考
        </button>
      </div>

      {resp?.error && (
        <div className="card border-rose-400/30 bg-rose-400/[0.06] p-3 text-[13px] text-rose-200">{resp.error}</div>
      )}

      {resp?.result && (
        <div className="fade-up space-y-3">
          {resp.pass !== undefined && (
            <div className={`card flex items-center gap-2 p-3.5 text-sm font-semibold ${resp.pass ? 'border-emerald-400/40 text-emerald-300' : 'border-amber-400/40 text-amber-300'}`}>
              {resp.pass ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
              {resp.pass ? '完全正确！结果集与标准答案一致' : '结果与标准答案不一致'}
              {!resp.pass && (
                <span className="ml-1 text-[11px] font-normal text-zinc-400">
                  字段{resp.colsMatch ? '✓' : '✗'} 行数 {resp.yourCount}/{resp.expectedCount} 行内容{resp.rowsMatch ? '✓' : '✗'}
                </span>
              )}
            </div>
          )}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.03]">
                  {resp.result.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2.5 font-semibold text-zinc-300">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resp.result.rows.slice(0, 12).map((r, i) => (
                  <tr key={i} className="border-b border-white/4">
                    {r.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-2 text-zinc-400">{v ?? 'NULL'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {resp.result.rows.length > 12 && (
              <p className="px-3 py-2 text-[11px] text-zinc-600">…共 {resp.result.rows.length} 行</p>
            )}
          </div>
        </div>
      )}

      {showRef && (
        <div className="card border-white/15 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <Lightbulb size={13} /> 参考答案（先自己写再对照）
          </p>
          <pre className="code-area whitespace-pre-wrap text-[12.5px] text-zinc-300">
            {task.meta.expectedSql}
          </pre>
        </div>
      )}
    </div>
  );
}
