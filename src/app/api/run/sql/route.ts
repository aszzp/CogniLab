import { NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import { qGet } from '@/lib/db';

interface QueryResult { columns: string[]; rows: (string | number | null)[][] }

function runQuery(db: DatabaseSync, sql: string): QueryResult {
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return {
    columns,
    rows: rows.map((r) => columns.map((c) => {
      const v = r[c];
      return v === null || v === undefined ? null : typeof v === 'number' ? v : String(v);
    })),
  };
}

function keyOf(r: (string | number | null)[]) {
  return r.map((v) => (v === null ? '∅' : String(v).trim())).join('\u0001');
}

export async function POST(req: Request) {
  const { taskId, code } = await req.json();
  const sql = String(code || '').trim().replace(/;+\s*$/, '');
  if (!/^(select|with)\b/i.test(sql)) {
    return NextResponse.json({ error: '只允许执行 SELECT / WITH 查询语句' }, { status: 400 });
  }
  const t = qGet<{ meta: string }>('SELECT meta FROM tasks WHERE id = ?', taskId);
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const meta = JSON.parse(t.meta) as { initSql: string; expectedSql: string };

  let userRes: QueryResult;
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(meta.initSql);
    userRes = runQuery(db, sql);
  } catch (e) {
    return NextResponse.json({ error: `SQL 执行错误：${String(e).slice(0, 200)}` }, { status: 200 });
  }
  let expectRes: QueryResult;
  try {
    expectRes = runQuery(db, meta.expectedSql);
  } catch {
    return NextResponse.json({ error: '标准答案异常，请联系管理员' }, { status: 500 });
  }

  const colsMatch =
    userRes.columns.map((c) => c.toLowerCase()).sort().join(',') ===
    expectRes.columns.map((c) => c.toLowerCase()).sort().join(',');
  const userBag = userRes.rows.map(keyOf).sort().join('\u0002');
  const expectBag = expectRes.rows.map(keyOf).sort().join('\u0002');
  const rowsMatch = userBag === expectBag;
  const pass = colsMatch && rowsMatch;

  return NextResponse.json({
    pass,
    colsMatch,
    rowsMatch,
    yourCount: userRes.rows.length,
    expectedCount: expectRes.rows.length,
    result: userRes,
  });
}
