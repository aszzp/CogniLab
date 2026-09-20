import { DatabaseSync } from 'node:sqlite';

function query(initSql, sql) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(initSql);
    db.exec('PRAGMA query_only=ON');
    const statement = db.prepare(sql);
    statement.setReturnArrays(true);
    const rows = statement.all().map(row => row.map(value => {
      if (value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return value;
      throw new Error('当前题库判分只支持有限数值、字符串或NULL结果。');
    }));
    return { columns: statement.columns().map((c) => c.name), rows };
  } finally { db.close(); }
}
// Typed JSON encoding avoids collisions between NULL, literal separators and stringified numbers.
const rowKey = (row) => JSON.stringify(row.map((value) => [value === null ? 'null' : typeof value, value]));

export function compareQueryResults(actual, expected, options = {}) {
  const aNames = actual.columns.map((s) => s.toLowerCase());
  const eNames = expected.columns.map((s) => s.toLowerCase());
  const unique = new Set(aNames).size === aNames.length && new Set(eNames).size === eNames.length;
  const colsMatch = unique && aNames.length === eNames.length && eNames.every((s) => aNames.includes(s))
    && (!options.columnOrderMatters || JSON.stringify(aNames) === JSON.stringify(eNames));
  if (!colsMatch) return { pass: false, colsMatch: false, rowsMatch: false };
  // If column order is unspecified, compare values after aligning by column name.
  const aligned = actual.rows.map((row) => eNames.map((name) => row[aNames.indexOf(name)]));
  let a = aligned.map(rowKey), e = expected.rows.map(rowKey);
  if (!options.rowOrderMatters) { a = a.sort(); e = e.sort(); }
  const rowsMatch = JSON.stringify(a) === JSON.stringify(e);
  return { pass: colsMatch && rowsMatch, colsMatch, rowsMatch };
}

export function gradeSql(meta, code) {
  if (typeof code !== 'string' || !code.trim() || code.length > 64000 || !/^(select|with)\b/i.test(code.trim())) {
    throw new Error('只接受非空SELECT/WITH查询，最长64000字符。');
  }
  if (!meta || typeof meta.initSql !== 'string' || typeof meta.expectedSql !== 'string') {
    throw new Error('题目SQL配置不完整。');
  }
  // Separate memory databases prevent a user query from changing reference fixtures.
  const expected = query(meta.initSql, meta.expectedSql);
  const actual = query(meta.initSql, code.trim());
  const comparison = compareQueryResults(actual, expected, meta);
  return { ...comparison, yourCount: actual.rows.length, expectedCount: expected.rows.length, result: actual };
}
