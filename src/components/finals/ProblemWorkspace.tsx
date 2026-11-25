'use client';

import { useRef, useState } from 'react';
import { Check, Play, RotateCcw, X } from 'lucide-react';
import CodeEditor from '@/components/trainers/CodeEditor';
import Markdown from '@/components/Markdown';
import { useEscape } from '@/lib/use-escape';
import type { CodePublic } from '@/lib/finals-content';
import type { ProblemSubmissions } from '@/lib/finals-store';

interface CaseRow {
  status: string; ms: number;
  args?: unknown; expected?: unknown; actual?: unknown; error?: string; stdout?: string;
}
interface SampleResult { scope: 'sample'; passed: number; total: number; results: CaseRow[] }
export interface FullResult {
  scope: 'full'; passed: number; total: number; status: string; label: string;
  maxMs: number; maxMemMb: number; results: CaseRow[]; submissions?: ProblemSubmissions;
}

const STATUS_TEXT: Record<string, string> = {
  AC: '通过', WA: '答案错误', TLE: '运行超时', MLE: '内存超限', RE: '运行出错', SE: '判题服务异常',
};
const STATUS_TONE: Record<string, string> = {
  AC: 'text-emerald-300', WA: 'text-rose-300', TLE: 'text-amber-300', MLE: 'text-amber-300', RE: 'text-rose-300', SE: 'text-zinc-400',
};
const STATUS_DOT: Record<string, string> = {
  AC: 'bg-emerald-400', WA: 'bg-rose-400', TLE: 'bg-amber-400', MLE: 'bg-amber-400', RE: 'bg-rose-400', SE: 'bg-zinc-500',
};
const PRE = 'code-area mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-white/8 bg-[#0c0c14] p-2.5 text-xs leading-5 text-zinc-300';

function show(value: unknown): string {
  if (value === undefined) return '（没有返回值）';
  const text = JSON.stringify(value, null, 2) ?? String(value);
  return text.length > 1600 ? `${text.slice(0, 1600)}\n…（内容过长，已截断）` : text;
}

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('zh-CN', { hour12: false });

export default function ProblemWorkspace({
  problem, initialCode, pythonLabel, attemptId, practice = false, revealErrors = false,
  submissions, onChange, onSubmitted, onNext,
}: {
  problem: CodePublic;
  initialCode: string;
  pythonLabel: string;
  /** 有值为考试内的作答；练习模式下的专项练习不传 */
  attemptId?: number;
  practice?: boolean;
  /** 考试的练习模式：提交后可以看到运行错误信息 */
  revealErrors?: boolean;
  submissions?: ProblemSubmissions;
  onChange: (code: string) => void;
  onSubmitted?: (problemKey: string, subs: ProblemSubmissions, passed: number) => void;
  onNext?: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [tab, setTab] = useState<'desc' | 'history'>('desc');
  const [pane, setPane] = useState<'cases' | 'result'>('cases');
  const [mobile, setMobile] = useState<'desc' | 'code' | 'test'>('code');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [full, setFull] = useState<FullResult | null>(null);
  const [running, setRunning] = useState<'sample' | 'full' | null>(null);
  const [dialog, setDialog] = useState<FullResult | null>(null);
  const revision = useRef(0);
  useEscape(!!dialog, () => setDialog(null));

  function updateCode(value: string) {
    revision.current += 1;
    setCode(value);
    onChange(value);
  }

  async function judge(scope: 'sample' | 'full') {
    if (running) return null;
    const sent = revision.current;
    setRunning(scope);
    try {
      const res = await fetch('/api/finals/judge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemKey: problem.key, code, scope, attemptId, practice: practice || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `运行请求失败（${res.status}）`);
      // 自测运行只给当前这份代码看：期间改过代码就丢弃结果。正式提交已被服务器记账，必须展示。
      if (scope === 'sample' && revision.current !== sent) return null;
      if (scope === 'sample') setSample(data as SampleResult);
      else {
        setFull(data as FullResult);
        setDialog(data as FullResult);
        onSubmitted?.(problem.key, data.submissions, data.passed as number);
      }
      setPane('result');
      setMobile('test');
      return data;
    } catch (error) {
      if (scope === 'sample' && revision.current !== sent) return null;
      const message = error instanceof Error ? error.message : '请求失败';
      const count = scope === 'sample' ? problem.samples.length : 10;
      const results: CaseRow[] = Array.from({ length: count }, () => ({ status: 'SE', ms: 0, error: message }));
      // 请求本身失败（网络、作答已结束等）：只展示原因，不算一次提交
      if (scope === 'sample') setSample({ scope: 'sample', passed: 0, total: count, results });
      else setFull({ scope: 'full', passed: 0, total: count, status: 'SE', label: STATUS_TEXT.SE, maxMs: 0, maxMemMb: 0, results });
      setPane('result');
      setMobile('test');
      return null;
    } finally {
      setRunning(null);
    }
  }

  const current = problem.samples[sampleIdx];
  const tabBtn = (active: boolean, label: string, onClick: () => void) => (
    <button
      role="tab" aria-selected={active} onClick={onClick}
      className={`-mb-px border-b-2 px-3 pb-2 transition-colors ${
        active ? 'border-indigo-400 font-medium text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  );
  const allPassed = !!dialog && dialog.passed === dialog.total;
  const firstError = dialog?.results.find((r) => r.error)?.error;
  const canInspect = practice || revealErrors;

  return (
    <div className="space-y-3">
      {/* 窄屏：三个面板轮流显示 */}
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs lg:hidden">
        {([['desc', '题目描述'], ['code', '写代码'], ['test', '测试']] as const).map(([key, label]) => (
          <button
            key={key} role="tab" aria-selected={mobile === key} onClick={() => setMobile(key)}
            className={`rounded-lg py-1.5 ${mobile === key ? 'bg-violet-500/25 font-medium text-white' : 'text-zinc-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className={`card p-4 lg:col-span-5 ${mobile === 'desc' ? 'block' : 'hidden lg:block'}`}>
          <div role="tablist" className="mb-3 flex gap-1 border-b border-white/8 text-[13px]">
            {tabBtn(tab === 'desc', '题目描述', () => setTab('desc'))}
            {tabBtn(tab === 'history', '提交记录', () => setTab('history'))}
          </div>
          {tab === 'history' ? (
            !submissions || submissions.count === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-500">还没有提交记录</p>
            ) : (
              <ol className="space-y-2">
                {[...submissions.history].reverse().map((h, i) => (
                  <li key={submissions.count - i} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 text-xs">
                    <span className="text-zinc-300">第 {submissions.count - i} 次提交</span>
                    <span className={STATUS_TONE[h.status] ?? 'text-zinc-400'}>
                      通过 {h.passed}/{h.total} · {STATUS_TEXT[h.status] ?? h.status}
                    </span>
                    <span className="tabular-nums text-zinc-500">{timeOf(h.at)}</span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <>
              <h2 className="text-[16px] font-bold leading-snug text-zinc-100">{problem.title}（第 {problem.no} 题，10 分）</h2>
              <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                <li><span className="mr-1.5 text-zinc-400">能力项</span>{problem.ability}</li>
                <li><span className="mr-1.5 text-zinc-400">知识点</span>{problem.knowledge}</li>
                <li><span className="mr-1.5 text-zinc-400">编程语言</span>{pythonLabel} ｜ 判题：10 个测试点，每个 1 分</li>
              </ul>
              <p className="mt-3 rounded-lg border-l-2 border-indigo-400/50 bg-indigo-400/[0.07] p-2.5 text-xs leading-relaxed text-zinc-400">
                运行限制：单次运行限时 5 秒，内存上限 128MB。超时显示「运行超时」，内存超限显示「内存超限」，都不计为通过。请仅使用 Python 标准库。
              </p>
              <Markdown>{problem.description}</Markdown>
            </>
          )}
        </section>

        <div className="space-y-3 lg:col-span-7">
          <div className={`card p-3 ${mobile === 'code' ? 'block' : 'hidden lg:block'}`}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">⌁ {pythonLabel}</span>
              <button onClick={() => updateCode(problem.starter)} className="flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-200">
                <RotateCcw size={12} /> 恢复初始状态
              </button>
            </div>
            <CodeEditor value={code} onChange={updateCode} language="python" tabSize={4} autoIndent minHeight={340} />
          </div>

          <section className={`card ${mobile === 'test' ? 'block' : 'hidden lg:block'}`}>
            <div role="tablist" className="flex gap-1 border-b border-white/8 px-4 text-[13px]">
              {tabBtn(pane === 'cases', '测试用例', () => setPane('cases'))}
              {tabBtn(pane === 'result', '测试结果', () => setPane('result'))}
            </div>
            <div className="max-h-[46vh] min-h-[200px] overflow-auto p-4">
              {pane === 'cases' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {problem.samples.map((s, i) => (
                      <button
                        key={i} onClick={() => setSampleIdx(i)}
                        className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                          i === sampleIdx ? 'border-indigo-400/60 bg-indigo-400/10 text-zinc-100' : 'border-white/12 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Case {i + 1}
                      </button>
                    ))}
                  </div>
                  {problem.params.map((name, i) => (
                    <div key={name}>
                      <p className="mt-3 text-xs text-zinc-500">{name}</p>
                      <pre className={PRE}>{show(current.args[i])}</pre>
                    </div>
                  ))}
                  <p className="mt-3 text-xs text-zinc-500">期望输出</p>
                  <pre className={PRE}>{show(current.expected)}</pre>
                </>
              ) : !sample && !full ? (
                <p className="py-12 text-center text-xs leading-relaxed text-zinc-500">
                  点击「自测运行」会用上方的样例检验代码；<br />确认无误后点「提交」，由 10 个测试点判分。
                </p>
              ) : (
                <div className="space-y-4 text-xs">
                  {sample && (
                    <div>
                      <p className="font-medium text-zinc-300">自测运行：通过 {sample.passed} / {sample.total}</p>
                      {sample.results.map((r, i) => (
                        <div key={i} className="mt-2 rounded-xl border border-white/8 p-3">
                          <p className={`flex items-center gap-1.5 font-medium ${STATUS_TONE[r.status] ?? 'text-zinc-400'}`}>
                            {r.status === 'AC' ? <Check size={13} /> : <X size={13} />}
                            Case {i + 1} · {STATUS_TEXT[r.status] ?? r.status} · {r.ms} ms
                          </p>
                          {r.status === 'AC' ? (
                            <p className="mt-1.5 text-emerald-300/80">结果符合预期，可以提交答案了。</p>
                          ) : (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <div><p className="text-zinc-500">期望输出</p><pre className={PRE}>{show(r.expected)}</pre></div>
                              <div><p className="text-zinc-500">实际输出</p><pre className={PRE}>{show(r.actual)}</pre></div>
                            </div>
                          )}
                          {r.error && <pre className="mt-2 whitespace-pre-wrap break-all text-rose-300">{r.error}</pre>}
                          {r.stdout && (
                            <details className="mt-2 text-zinc-500">
                              <summary className="cursor-pointer">标准输出</summary>
                              <pre className={PRE}>{r.stdout}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {full && (
                    <div>
                      <p className="font-medium text-zinc-300">
                        最近一次提交：通过 <span className="text-zinc-100">{full.passed} / {full.total}</span> · {full.label}
                      </p>
                      <p className="mt-1 text-zinc-500">执行用时 {full.maxMs} ms · 消耗内存 {full.maxMemMb} MB</p>
                      <ol className="mt-3 grid grid-cols-10 gap-1.5" aria-label="各测试点结果">
                        {full.results.map((r, i) => (
                          <li key={i} title={`测试点 ${i + 1}：${STATUS_TEXT[r.status] ?? r.status}`}
                            className={`h-2 rounded ${STATUS_DOT[r.status] ?? 'bg-zinc-600'}`} />
                        ))}
                      </ol>
                      {canInspect && full.results.some((r) => r.status !== 'AC') && (
                        <div className="mt-3 space-y-2">
                          {full.results.map((r, i) => r.status === 'AC' ? null : (
                            <details key={i} className="rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3">
                              <summary className={`cursor-pointer font-medium ${STATUS_TONE[r.status] ?? 'text-zinc-400'}`}>
                                测试点 {i + 1} · {STATUS_TEXT[r.status] ?? r.status}
                              </summary>
                              {r.error && <pre className="mt-2 whitespace-pre-wrap break-all text-rose-300">{r.error}</pre>}
                              {r.args !== undefined && (
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                  <div><p className="text-zinc-500">输入</p><pre className={PRE}>{show(r.args)}</pre></div>
                                  <div><p className="text-zinc-500">期望输出</p><pre className={PRE}>{show(r.expected)}</pre></div>
                                  <div><p className="text-zinc-500">实际输出</p><pre className={PRE}>{show(r.actual)}</pre></div>
                                </div>
                              )}
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/8 p-3">
              <button onClick={() => void judge('sample')} disabled={!!running}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/8 disabled:opacity-50">
                <Play size={13} /> {running === 'sample' ? '运行中…' : '自测运行'}
              </button>
              <button onClick={() => void judge('full')} disabled={!!running}
                className="rounded-full border border-white/15 bg-zinc-950 px-6 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50">
                {running === 'full' ? '判题中…' : '提交'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* 提交结果：与官方平台一致，只给结论 */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setDialog(null)}>
          <div role="dialog" aria-modal="true" aria-label="提交结果" className="card drawer-in w-full max-w-sm rounded-3xl bg-[#11111a] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className={`text-lg font-bold ${allPassed ? 'text-indigo-300' : 'text-rose-300'}`}>{allPassed ? '通过' : '错误'}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {allPassed ? '全部测试点通过，本题得 10 分' : `测试点通过 ${dialog.passed} / ${dialog.total}，本题得 ${dialog.passed} 分 · ${dialog.label}`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] py-2.5">
                <p className="text-base font-semibold tabular-nums text-zinc-200">{dialog.maxMs}<span className="text-[10px] font-normal">ms</span></p>
                <p className="text-[11px] text-zinc-500">执行用时</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] py-2.5">
                <p className="text-base font-semibold tabular-nums text-zinc-200">{dialog.maxMemMb}<span className="text-[10px] font-normal">MB</span></p>
                <p className="text-[11px] text-zinc-500">消耗内存</p>
              </div>
            </div>
            {!allPassed && canInspect && firstError && (
              <pre className="code-area mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-rose-400/20 p-2.5 text-left text-xs text-rose-300">{firstError}</pre>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDialog(null)} className="flex-1 rounded-full border border-white/15 py-2.5 text-sm text-zinc-200">
                {allPassed ? '留在本题' : practice ? '查看未通过用例' : '继续答题'}
              </button>
              {onNext && (
                <button onClick={() => { setDialog(null); onNext(); }} className="flex-1 rounded-full bg-zinc-950 py-2.5 text-sm font-semibold text-white">
                  下一题
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
