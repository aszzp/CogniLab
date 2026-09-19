'use client';

import { useEffect, useState } from 'react';
import { Settings2, Plus, X, Loader2, Check, Brain } from 'lucide-react';

interface ProviderConf {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  thinkingStyle: string;
}
interface AIConfig {
  providers: Record<string, ProviderConf>;
  assign: Record<string, string>;
  thinking: 'on' | 'off';
}

const PURPOSES: [string, string][] = [
  ['explain', '题目 AI 解析'],
  ['grade', '主观题批改'],
  ['quiz', 'AI 出题'],
  ['anim', '动画生成'],
  ['kun', '坤哥助手'],
];

export default function ModelSettings() {
  const [cfg, setCfg] = useState<AIConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newModel, setNewModel] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setCfg);
  }, []);

  if (!cfg) {
    return (
      <div className="card flex items-center justify-center gap-2 p-6 text-[13px] text-zinc-500">
        <Loader2 size={14} className="animate-spin" /> 加载模型配置…
      </div>
    );
  }

  const options: { value: string; label: string }[] = [];
  for (const [pid, p] of Object.entries(cfg.providers)) {
    for (const m of p.models) options.push({ value: `${pid}:${m}`, label: `${p.name} · ${m}` });
  }

  function patch(fn: (draft: AIConfig) => void) {
    setSaved(false);
    setCfg((c) => {
      if (!c) return c;
      const d = JSON.parse(JSON.stringify(c)) as AIConfig;
      fn(d);
      return d;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else alert(data.error || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none';

  return (
    <div className="card p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Settings2 size={14} className="text-cyan-300" /> 模型接口配置
      </p>

      {/* 思考模式 */}
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
        <Brain size={16} className={cfg.thinking === 'on' ? 'text-violet-300' : 'text-zinc-600'} />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-zinc-200">深度思考</p>
          <p className="text-[10.5px] text-zinc-500">开启后模型先推理再作答（更准但更慢）</p>
        </div>
        <button
          onClick={() => patch((d) => { d.thinking = d.thinking === 'on' ? 'off' : 'on'; })}
          className={`relative h-6.5 w-11 rounded-full transition-colors ${cfg.thinking === 'on' ? 'bg-gradient-to-r from-violet-500 to-cyan-500' : 'bg-white/12'}`}
          style={{ height: 26 }}>
          <span
            className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: cfg.thinking === 'on' ? 22 : 3 }}
          />
        </button>
      </div>

      {/* 供应商 */}
      {Object.entries(cfg.providers).map(([pid, p]) => (
        <div key={pid} className="mt-3 space-y-2 rounded-xl bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-zinc-200">{p.name}</p>
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9.5px] text-zinc-500">{pid}</span>
          </div>
          <input value={p.baseUrl} onChange={(e) => patch((d) => { d.providers[pid].baseUrl = e.target.value; })}
            placeholder="Base URL" className={`${inp} font-mono text-[11px]`} />
          <input value={p.apiKey} onChange={(e) => patch((d) => { d.providers[pid].apiKey = e.target.value; })}
            placeholder="API Key" className={`${inp} font-mono text-[11px]`} />
          <div className="flex flex-wrap items-center gap-1.5">
            {p.models.map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] py-1 pl-2.5 pr-1.5 text-[11px] text-zinc-300">
                {m}
                <button onClick={() => patch((d) => { d.providers[pid].models = d.providers[pid].models.filter((x) => x !== m); })}>
                  <X size={10} className="text-zinc-600 hover:text-rose-300" />
                </button>
              </span>
            ))}
            <span className="flex items-center gap-1">
              <input
                value={newModel[pid] ?? ''}
                onChange={(e) => setNewModel((s) => ({ ...s, [pid]: e.target.value }))}
                placeholder="添加模型…"
                className="w-24 rounded-full border border-dashed border-white/15 bg-transparent px-2.5 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
              />
              <button
                onClick={() => {
                  const v = (newModel[pid] ?? '').trim();
                  if (!v) return;
                  patch((d) => { if (!d.providers[pid].models.includes(v)) d.providers[pid].models.push(v); });
                  setNewModel((s) => ({ ...s, [pid]: '' }));
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-zinc-400">
                <Plus size={10} />
              </button>
            </span>
          </div>
        </div>
      ))}

      {/* 用途分配 */}
      <div className="mt-3 space-y-2">
        <p className="text-[12px] font-semibold text-zinc-300">功能 → 模型分配</p>
        {PURPOSES.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-[76px] shrink-0 text-[11.5px] text-zinc-500">{label}</span>
            <select
              value={cfg.assign[key] ?? options[0]?.value}
              onChange={(e) => patch((d) => { d.assign[key] = e.target.value; })}
              className={`${inp} flex-1 py-1.5`}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="grad-btn mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white">
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saving ? '保存中…' : saved ? '已保存' : '保存配置'}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        配置保存在本地数据库（settings 表），Key 仅服务端使用不会下发到浏览器。思考开关：阿里云 coding plan 用 enable_thinking，智谱 ZCode 用 thinking.type 参数。
      </p>
    </div>
  );
}
