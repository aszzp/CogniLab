'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import type { Task } from '@/lib/types';
import type { ECharts } from 'echarts';

const TYPES = ['娱乐时事', '政治时事', '民生时事'];

interface Cfg {
  chartType: 'bar' | 'line' | 'heatmap' | 'pie';
  rowDim: string;
  colDim: string;
  metric: string;
  agg: 'sum' | 'count' | 'avg';
  ageMin: number;
  ageMax: number;
  types: string[];
  title: string;
}

const DEFAULT: Cfg = {
  chartType: 'bar', rowDim: 'type', colDim: 'age', metric: 'times',
  agg: 'count', ageMin: 18, ageMax: 25, types: ['娱乐时事'], title: '',
};

export default function ChartTrainer({ task }: { task: Task }) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dataset = task.meta.dataset!;
  const target = task.meta.target as unknown as Cfg & { ageRange: [number, number] };

  const pivot = useMemo(() => {
    const rows = dataset.rows.filter(
      (r) => Number(r[0]) >= cfg.ageMin && Number(r[0]) <= cfg.ageMax && cfg.types.includes(String(r[1])),
    );
    const rowVals = [...new Set(rows.map((r) => String(r[cfg.rowDim === 'age' ? 0 : 1])))].sort((a, b) => Number(a) - Number(b));
    const colVals = [...new Set(rows.map((r) => String(r[cfg.colDim === 'age' ? 0 : 1])))].sort((a, b) => Number(a) - Number(b));
    const cell = new Map<string, number[]>();
    for (const r of rows) {
      const k = `${r[cfg.rowDim === 'age' ? 0 : 1]}|${r[cfg.colDim === 'age' ? 0 : 1]}`;
      const arr = cell.get(k) ?? [];
      arr.push(Number(r[2]));
      cell.set(k, arr);
    }
    const aggArr = (arr: number[] | undefined) => {
      if (!arr?.length) return 0;
      if (cfg.agg === 'sum') return arr.reduce((a, b) => a + b, 0);
      if (cfg.agg === 'count') return arr.length;
      return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    };
    const byRow = rowVals.map((rv) => {
      const arr = [...cell.entries()].filter(([k]) => k.startsWith(rv + '|')).flatMap(([, v]) => v);
      return aggArr(arr);
    });
    const heat: [number, number, number][] = [];
    let maxV = 0;
    rowVals.forEach((rv, yi) =>
      colVals.forEach((cv, xi) => {
        const v = aggArr(cell.get(`${rv}|${cv}`));
        maxV = Math.max(maxV, v);
        heat.push([xi, yi, v]);
      }),
    );
    return { rowVals, colVals, byRow, heat, maxV };
  }, [cfg, dataset]);

  useEffect(() => {
    let chart: ECharts | undefined;
    let dead = false;
    import('echarts').then((echarts) => {
      if (dead || !ref.current) return;
      chart = echarts.init(ref.current);
      const { rowVals, colVals, byRow, heat, maxV } = pivot;
      const base = { backgroundColor: 'transparent', textStyle: { color: '#a1a1aa' } };
      const title = { text: cfg.title || '（未设置标题）', textStyle: { color: '#e4e4e7', fontSize: 13 }, left: 'center' };
      if (cfg.chartType === 'heatmap') {
        chart.setOption({
          ...base, title,
          grid: { left: 50, right: 20, top: 40, bottom: 50 },
          xAxis: { type: 'category', data: colVals },
          yAxis: { type: 'category', data: rowVals },
          visualMap: {
            min: 0, max: maxV || 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
            inRange: { color: ['#1e1b4b', '#7c3aed', '#22d3ee'] }, textStyle: { color: '#71717a' },
          },
          series: [{ type: 'heatmap', data: heat, label: { show: true, color: '#e4e4e7', fontSize: 10 } }],
        });
      } else if (cfg.chartType === 'pie') {
        chart.setOption({
          ...base, title,
          series: [{
            type: 'pie', radius: ['35%', '62%'],
            data: rowVals.map((rv, i) => ({ name: rv, value: byRow[i] })),
            label: { color: '#a1a1aa' },
          }],
        });
      } else {
        chart.setOption({
          ...base, title,
          grid: { left: 50, right: 20, top: 40, bottom: 40 },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: rowVals },
          yAxis: { type: 'value' },
          series: [{ type: cfg.chartType, smooth: true, data: byRow, itemStyle: { color: '#7c3aed' } }],
        });
      }
    });
    return () => { dead = true; chart?.dispose(); };
  }, [cfg, pivot]);

  const checks = useMemo(() => {
    if (!checked) return null;
    return [
      { label: '图表类型', ok: cfg.chartType === target.chartType, want: labelOf(target.chartType), got: labelOf(cfg.chartType) },
      { label: '行维度', ok: cfg.rowDim === target.rowDim, want: target.rowDim, got: cfg.rowDim },
      { label: '列维度', ok: cfg.colDim === target.colDim, want: target.colDim, got: cfg.colDim },
      { label: '指标字段', ok: cfg.metric === target.metric, want: target.metric, got: cfg.metric },
      { label: '聚合方式', ok: cfg.agg === target.agg, want: target.agg.toUpperCase(), got: cfg.agg.toUpperCase() },
      { label: '年龄范围', ok: cfg.ageMin === target.ageRange[0] && cfg.ageMax === target.ageRange[1], want: `${target.ageRange[0]}~${target.ageRange[1]}`, got: `${cfg.ageMin}~${cfg.ageMax}` },
      { label: '数据范围（资讯类型）', ok: new Set(cfg.types).size === target.types.length && target.types.every((t) => cfg.types.includes(t)), want: target.types.join('/'), got: cfg.types.join('/') || '（空）' },
      { label: '图表标题', ok: cfg.title.trim() === target.title, want: target.title, got: cfg.title.trim() || '（空）' },
    ];
  }, [checked, cfg, target]);

  const sel = 'flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13px] text-zinc-200 focus:border-violet-400/50 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <BarChart3 size={13} className="text-cyan-300" /> 图表配置
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10.5px] text-zinc-500">图表类型</label>
            <select className={sel} value={cfg.chartType} onChange={(e) => setCfg({ ...cfg, chartType: e.target.value as Cfg['chartType'] })}>
              <option value="bar">柱状图</option><option value="line">折线图</option>
              <option value="heatmap">热力图</option><option value="pie">饼图</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-zinc-500">聚合方式</label>
            <select className={sel} value={cfg.agg} onChange={(e) => setCfg({ ...cfg, agg: e.target.value as Cfg['agg'] })}>
              <option value="sum">SUM</option><option value="count">COUNT</option><option value="avg">AVG</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-zinc-500">行维度</label>
            <select className={sel} value={cfg.rowDim} onChange={(e) => setCfg({ ...cfg, rowDim: e.target.value })}>
              <option value="age">age（年龄）</option><option value="type">type（资讯类型）</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-zinc-500">列维度</label>
            <select className={sel} value={cfg.colDim} onChange={(e) => setCfg({ ...cfg, colDim: e.target.value })}>
              <option value="age">age（年龄）</option><option value="type">type（资讯类型）</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] text-zinc-500">指标字段</label>
            <select className={sel} value={cfg.metric} onChange={(e) => setCfg({ ...cfg, metric: e.target.value })}>
              <option value="times">times（查看次数）</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10.5px] text-zinc-500">年龄 ≥</label>
              <input type="number" min={16} max={60} value={cfg.ageMin}
                onChange={(e) => setCfg({ ...cfg, ageMin: Number(e.target.value) })}
                className={`${sel} appearance-none`} />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10.5px] text-zinc-500">≤</label>
              <input type="number" min={16} max={60} value={cfg.ageMax}
                onChange={(e) => setCfg({ ...cfg, ageMax: Number(e.target.value) })}
                className={`${sel} appearance-none`} />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[10.5px] text-zinc-500">数据范围（资讯类型）</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const on = cfg.types.includes(t);
              return (
                <button key={t}
                  onClick={() => setCfg({ ...cfg, types: on ? cfg.types.filter((x) => x !== t) : [...cfg.types, t] })}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? 'border-violet-400/60 bg-violet-500/15 text-violet-200' : 'border-white/12 text-zinc-500'}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] text-zinc-500">图表标题</label>
          <input value={cfg.title} onChange={(e) => setCfg({ ...cfg, title: e.target.value })}
            placeholder="输入标题…" className={`${sel} py-0`} />
        </div>
      </div>

      {/* 预览 */}
      <div className="card p-4">
        <p className="mb-2 text-xs font-semibold text-zinc-300">实时预览</p>
        <div ref={ref} className="h-72 w-full" />
      </div>

      <button onClick={() => setChecked(true)}
        className="grad-btn w-full rounded-xl py-3 text-sm font-semibold text-white">
        对照标准答案判分
      </button>

      {checks && (
        <div className="fade-up card divide-y divide-white/6 p-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 px-3 py-2.5 text-[13px]">
              {c.ok
                ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                : <XCircle size={15} className="shrink-0 text-rose-400" />}
              <span className="w-24 shrink-0 text-zinc-400">{c.label}</span>
              <span className="min-w-0 flex-1">
                {c.ok ? <span className="text-emerald-200">✓ {c.got}</span> : (
                  <>
                    <span className="text-rose-300 line-through">{c.got}</span>
                    <span className="ml-2 text-emerald-300">→ {c.want}</span>
                  </>
                )}
              </span>
            </div>
          ))}
          <p className="px-3 py-2.5 text-xs text-zinc-500">
            通过 {checks.filter((c) => c.ok).length} / {checks.length} 项
            {checks.every((c) => c.ok) && ' 🎉 与监控图表配置完全一致！'}
          </p>
        </div>
      )}
    </div>
  );
}

function labelOf(t: string) {
  return ({ bar: '柱状图', line: '折线图', heatmap: '热力图', pie: '饼图' } as Record<string, string>)[t] ?? t;
}
