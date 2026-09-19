'use client';

import { useState } from 'react';
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

# ① 读取 data.csv → 变量 data
# ② 查看 head(15) 与 describe()
# ③ 处理缺失值、重复值
# ④ 划分特征 X 与标签 y（是否会购买）
# ⑤ 8:2 划分训练/测试集（random_state=2020）
# ⑥ 训练/测试特征转二维数组
# ⑦ 定义逻辑回归并训练
# ⑧ 输出 accuracy 与 y_pred
`;

export default function PythonTrainer({ task }: { task: Task }) {
  const [code, setCode] = useState(STARTER);
  const [resp, setResp] = useState<PyResp | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResp(null);
    try {
      const res = await fetch('/api/run/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, code }),
      });
      setResp(await res.json());
    } catch {
      setResp({ userError: '请求失败' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <CodeEditor value={code} onChange={setCode} language="python" placeholder="在这里编写 Python 代码" />

      <button onClick={run} disabled={running}
        className="grad-btn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white">
        <Play size={15} /> {running ? '运行中（最长 45 秒）…' : '运行并判分'}
      </button>

      {resp?.userError && (
        <div className="card border-rose-400/30 bg-rose-400/[0.06] p-3">
          <p className="text-xs font-semibold text-rose-300">代码运行出错</p>
          <pre className="code-area mt-1.5 whitespace-pre-wrap text-[12px] text-rose-200">{resp.userError}</pre>
        </div>
      )}

      {resp?.checkpoints && resp.checkpoints.length > 0 && (
        <div className="fade-up card divide-y divide-white/6 p-2">
          <p className="px-3 py-2 text-xs text-zinc-400">
            检查点通过 <span className="font-bold text-emerald-300">{resp.passed}</span> / {resp.total}
            {resp.passed === resp.total && <span className="ml-2 text-emerald-300">🎉 全部通过！</span>}
          </p>
          {resp.checkpoints.map((cp, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
              {cp.pass
                ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                : <XCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />}
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${cp.pass ? 'text-zinc-300' : 'text-zinc-200'}`}>{cp.label}</p>
                {!cp.pass && cp.msg && <p className="code-area mt-1 break-all text-[11px] text-rose-300/80">{cp.msg}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
