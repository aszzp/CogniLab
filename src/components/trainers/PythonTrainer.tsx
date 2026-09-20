'use client';

import { useRef, useState } from 'react';
import { Play, CheckCircle2, XCircle } from 'lucide-react';
import CodeEditor from './CodeEditor';
import type { Task } from '@/lib/types';

interface PyResp {
  userError?: string | null;
  checkpoints?: { label: string; pass: boolean; msg: string }[];
  passed?: number;
  total?: number;
}

const STARTER = `import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

# 读取本题 data.csv；按题干要求完成清洗、划分、训练与评估。
# 保留题干指定的变量名供检查，不能只输出截图。
`;

export default function PythonTrainer({ task }: { task: Task }) {
  return <PythonExercise key={task.id} task={task} />;
}

function PythonExercise({ task }: { task: Task }) {
  const [code, setCode] = useState(task.meta.starter ?? STARTER);
  const [resp, setResp] = useState<PyResp | null>(null);
  const [running, setRunning] = useState(false);
  const revision = useRef(0);

  async function run() {
    if (running) return;
    const sentRevision = revision.current;
    setRunning(true); setResp(null);
    try {
      const res = await fetch('/api/run/python', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `运行请求失败（${res.status}）`);
      if (revision.current === sentRevision) setResp(data);
    } catch (error) {
      if (revision.current === sentRevision) setResp({ userError: error instanceof Error ? error.message : '请求失败' });
    } finally { setRunning(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-6 text-zinc-500">当前执行器面向可信本地练习，尚非隔离沙箱；不要粘贴不可信来源代码。</p>
      <CodeEditor value={code} onChange={(value) => { revision.current += 1; setCode(value); setResp(null); }} language="python" placeholder="在这里编写 Python 代码" />
      <button type="button" onClick={run} disabled={running}
        className="grad-btn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50">
        <Play size={15} /> {running ? '运行中…' : '运行并检查'}
      </button>
      {resp?.userError && (
        <div role="alert" className="card border-rose-400/30 bg-rose-400/[0.06] p-3">
          <p className="text-xs font-semibold text-rose-300">代码运行出错</p>
          <pre className="code-area mt-1.5 whitespace-pre-wrap text-xs text-rose-200">{resp.userError}</pre>
        </div>
      )}
      {resp?.checkpoints && resp.checkpoints.length > 0 && (
        <div className="card divide-y divide-white/6 p-2" role="status">
          <p className="px-3 py-2 text-xs text-zinc-400">检查点通过 {resp.passed} / {resp.total}。检查点用于练习反馈，不是安全性或全面正确性证明。</p>
          {resp.checkpoints.map((cp, index) => (
            <div key={`${index}-${cp.label}`} className="flex items-start gap-2.5 px-3 py-2.5">
              {cp.pass ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-300">{cp.label}</p>
                {!cp.pass && cp.msg && <p className="code-area mt-1 break-all text-xs text-rose-300/80">{cp.msg}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {task.meta.referenceCode && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm text-violet-200">查看参考实现（建议先独立作答）</summary>
          <pre className="code-area mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-zinc-300">{task.meta.referenceCode}</pre>
        </details>
      )}
    </div>
  );
}
