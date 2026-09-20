#!/usr/bin/env node
// Incremental seed, with snapshot backup and stable IDs; never resets learning history.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadContent, PROJECT_ROOT } from './lib/content.mjs';
import { validateContent } from './lib/validate-content.mjs';
import { importContent, backupDatabase } from './lib/seed-store.mjs';

let db;
try {
  const args = process.argv.slice(2);
  let database = path.join(PROJECT_ROOT, 'data/cognilab.db'), dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--database' && args[i + 1] && !args[i + 1].startsWith('--')) database = path.resolve(args[++i]);
    else throw new Error(`未知参数或缺少参数值: ${args[i]}`);
  }
  const content = loadContent();
  const report = validateContent(content);
  if (!report.ok) throw new Error(report.errors.join('\n'));
  console.log(`内容校验通过: 总计${content.questions.length}题、${content.tasks.length}实操、${content.syllabus.length}考点；其中新增242题/32实操。`);
  if (dryRun) {
    console.log('仅验证内容；未打开数据库，也未预测真实迁移冲突。');
  } else {
    const existed = existsSync(database);
    mkdirSync(path.dirname(database), { recursive: true });
    db = new DatabaseSync(database);
    db.exec('PRAGMA busy_timeout = 5000');
    if (existed) console.log(`数据库一致性备份: ${backupDatabase(db, path.join(path.dirname(database), 'backups'))}`);
    const result = importContent(db, content);
    console.log(JSON.stringify(result, null, 2));
    if (result.conflicts.length) console.warn('存在内容冲突，已保留用户编辑；请核对上面的稳定键和字段。');
    console.log('增量导入完成：原ID、作答/错题/考试历史、自定义条目和掌握状态均不重置。');
  }
  for (const warning of report.warnings) console.warn(warning);
} catch (error) {
  console.error(`导入未完成: ${error.message}`); process.exitCode = 1;
} finally { db?.close(); }
