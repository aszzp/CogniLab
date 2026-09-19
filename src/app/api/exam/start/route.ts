import { NextResponse } from 'next/server';
import { qAll, qGet, qRun } from '@/lib/db';

export const EXAM_PLANS: Record<string, { label: string; count: number; sec: number; mix?: [string, number][] }> = {
  sample45: { label: '全真模拟（45题·90分钟）', count: 45, sec: 90 * 60, mix: [['数字人专项', 15], ['数据处理与标注', 13], ['业务分析', 10], ['智能系统设计', 4], ['智能训练', 3]] },
  quick20: { label: '快速模拟（20题·40分钟）', count: 20, sec: 40 * 60 },
  sprint10: { label: '冲刺小卷（10题·15分钟）', count: 10, sec: 15 * 60 },
};

function pick(module: string | null, n: number): number[] {
  const rows = module
    ? qAll<{ id: number }>('SELECT id FROM questions WHERE module = ? ORDER BY RANDOM() LIMIT ?', module, n)
    : qAll<{ id: number }>('SELECT id FROM questions ORDER BY RANDOM() LIMIT ?', n);
  return rows.map((r) => r.id);
}

export async function POST(req: Request) {
  const { mode } = await req.json();
  const plan = EXAM_PLANS[mode];
  if (!plan) return NextResponse.json({ error: 'unknown mode' }, { status: 400 });

  let ids: number[] = [];
  if (plan.mix) {
    for (const [mod, n] of plan.mix) {
      let got = pick(mod, n);
      if (got.length < n) got = got.concat(pick(null, n - got.length)); // 池不足时其他模块补
      ids = ids.concat(got);
    }
  } else {
    ids = pick(null, plan.count);
  }
  qRun('INSERT INTO exams (mode, question_ids) VALUES (?,?)', mode, JSON.stringify(ids));
  const row = qGet<{ id: number }>('SELECT MAX(id) AS id FROM exams');
  return NextResponse.json({ id: row!.id, durationSec: plan.sec, label: plan.label });
}
