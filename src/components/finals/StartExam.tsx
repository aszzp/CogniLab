'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEscape } from '@/lib/use-escape';

const NOTICE: [string, (strict: boolean) => string][] = [
  ['比赛类型', (strict) => `全国总决赛模拟（${strict ? '全真' : '练习'}模式），用于熟悉比赛平台操作及考试题型；`],
  ['比赛时长', (strict) => (strict ? '180 分钟。点击后即开始计时，中途不可暂停，计时结束自动交卷；' : '练习模式不限时，可随时交卷查看成绩；')],
  ['比赛题型及分值', () => '单选题（50 道 0.6 分 = 30 分）+ 编程题（7 道 10 分 = 70 分），满分 100 分；'],
  ['编程题运行限制', () => '单次运行 5 秒、内存 128MB；数值处理使用 Python round。每题 10 个测试点，每个 1 分，全部通过得满分；'],
  ['作答次数', () => '本模拟不限制作答次数，交卷后可查看成绩、解析与参考代码；'],
  ['切屏限制', (strict) => (strict ? '全真模式累计切屏 3 次即自动交卷；' : '练习模式不统计切屏；')],
];

export default function StartExam({ setId }: { setId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<'strict' | 'practice' | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  useEscape(pending !== null, () => { if (!starting) setPending(null); });

  async function begin() {
    if (!pending || starting) return;
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/finals/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId, mode: pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `开考失败（${res.status}）`);
      router.push(`/finals/attempt/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '开考失败');
      setStarting(false);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => setPending('strict')}
          className="grad-btn flex items-center gap-4 rounded-2xl p-5 text-left active:scale-[0.98]">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">全真模拟</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-white/75">180 分钟计时 · 切屏 3 次自动交卷 · 与正式赛同口径</span>
          </span>
        </button>
        <button onClick={() => setPending('practice')}
          className="flex items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.03] p-5 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.98]">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-zinc-100">练习模式</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-400">不限时 · 不判切屏 · 提交后可看运行错误信息</span>
          </span>
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => { if (!starting) setPending(null); }}>
          <div role="dialog" aria-modal="true" aria-label="考前须知" className="card drawer-in w-full max-w-md rounded-3xl bg-[#11111a] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-zinc-100">考前须知</p>
            <ol className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-zinc-300">
              {NOTICE.map(([label, text], i) => (
                <li key={label}>
                  <span className="text-zinc-500">{i + 1}. {label}：</span>{text(pending === 'strict')}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-zinc-500">作答过程中草稿会自动保存；意外关闭页面后可从「决赛模拟」页继续作答。</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setPending(null)} disabled={starting} className="flex-1 rounded-xl border border-white/12 py-2.5 text-sm text-zinc-300 disabled:opacity-50">
                取消
              </button>
              <button onClick={() => void begin()} disabled={starting}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {starting ? '正在开考…' : '开始答题'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
