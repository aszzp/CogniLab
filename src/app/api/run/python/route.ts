import { NextResponse } from 'next/server';
import { qGet } from '@/lib/db';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';


const MARK = '@@RESULT@@';

function buildRunner(userCode: string, checkpoints: { label: string; code: string }[]): string {
  const cpJson = JSON.stringify(checkpoints);
  return `
import json, sys, io, traceback

results = []
user_error = None
ns = {'__name__': '__main__'}

try:
    import pandas as pd
    import numpy as np
    ns['pd'] = pd
    ns['np'] = np
except Exception as e:
    print(json.dumps({"user_error": "环境缺少依赖: %s" % e, "checkpoints": []}))
    sys.exit(0)

buf = io.StringIO()
try:
    with __import__('contextlib').redirect_stdout(buf):
        exec(${JSON.stringify(userCode)}, ns)
except Exception:
    user_error = traceback.format_exc(limit=2).strip().splitlines()[-1]

cps = json.loads(${JSON.stringify(cpJson)})
for cp in cps:
    try:
        with __import__('contextlib').redirect_stdout(io.StringIO()):
            exec(cp["code"], ns)
        results.append({"label": cp["label"], "pass": True, "msg": ""})
    except Exception as e:
        results.append({"label": cp["label"], "pass": False, "msg": str(e)[:160]})

print("@@RESULT@@" + json.dumps({"user_error": user_error, "checkpoints": results}, ensure_ascii=False))
`.trim();
}

export async function POST(req: Request) {
  const { taskId, code } = await req.json();
  const t = qGet<{ meta: string }>('SELECT meta FROM tasks WHERE id = ?', taskId);
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const meta = JSON.parse(t.meta) as { preload?: string; checkpoints?: { label: string; code: string; points: number }[] };
  if (!meta.checkpoints) return NextResponse.json({ error: '任务配置缺失' }, { status: 400 });

  const dir = mkdtempSync(path.join(tmpdir(), 'cognilab-'));
  try {
    writeFileSync(path.join(dir, 'data.csv'), meta.preload ?? '', 'utf-8');
    writeFileSync(path.join(dir, 'runner.py'), buildRunner(String(code || ''), meta.checkpoints), 'utf-8');

    const out = await new Promise<string>((resolve) => {
      const p = spawn('python3', ['runner.py'], { cwd: dir, timeout: 45000 } as never);
      let so = '';
      p.stdout.on('data', (d) => (so += d));
      p.stderr.on('data', (d) => (so += d));
      p.on('error', (e) => resolve(JSON.stringify({ user_error: String(e), checkpoints: [] })));
      p.on('close', () => resolve(so));
    });

    const idx = out.lastIndexOf(MARK);
    if (idx === -1) {
      return NextResponse.json({ userError: out.slice(-400) || '运行无输出（可能超时）', checkpoints: [] });
    }
    let payload: { user_error: string | null; checkpoints: { label: string; pass: boolean; msg: string }[] };
    try {
      payload = JSON.parse(out.slice(idx + MARK.length).trim());
    } catch {
      return NextResponse.json({ userError: out.slice(-400), checkpoints: [] });
    }
    const cps = payload.checkpoints ?? [];
    const passedPoints = cps.filter((c) => c.pass).length;
    return NextResponse.json({
      userError: payload.user_error,
      checkpoints: cps,
      passed: passedPoints,
      total: cps.length,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
