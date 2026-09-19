#!/usr/bin/env node
// 初始化/重建题库：node scripts/seed.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'cognilab.db'));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, module TEXT NOT NULL, stem TEXT NOT NULL,
  options TEXT NOT NULL, answer TEXT NOT NULL, explanation TEXT DEFAULT '',
  difficulty INTEGER DEFAULT 2, source TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL,
  prompt TEXT NOT NULL, points INTEGER DEFAULT 10, source TEXT DEFAULT '', meta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS syllabus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL, section TEXT NOT NULL, topic TEXT NOT NULL,
  detail TEXT DEFAULT '', level TEXT DEFAULT '', ref TEXT DEFAULT '',
  mastered INTEGER DEFAULT 0, sort INTEGER DEFAULT 0,
  UNIQUE(module, section, topic)
);
CREATE TABLE IF NOT EXISTS lessons (
  topic_id INTEGER PRIMARY KEY,
  content TEXT, anim_html TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`;

db.exec(SCHEMA);
// 旧库迁移：补充 level / ref 列
{
  const cols = db.prepare('PRAGMA table_info(syllabus)').all().map((c) => c.name);
  if (cols.length && !cols.includes('level')) db.exec("ALTER TABLE syllabus ADD COLUMN level TEXT DEFAULT ''");
  if (cols.length && !cols.includes('ref')) db.exec("ALTER TABLE syllabus ADD COLUMN ref TEXT DEFAULT ''");
}

const questions = JSON.parse(readFileSync(path.join(DATA_DIR, 'seed-questions.json'), 'utf-8'));
const tasks = JSON.parse(readFileSync(path.join(DATA_DIR, 'seed-tasks.json'), 'utf-8'));
const syllabus = JSON.parse(readFileSync(path.join(DATA_DIR, 'seed-syllabus.json'), 'utf-8'));

db.exec('DELETE FROM questions');
db.exec('DELETE FROM tasks');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('questions','tasks')");
const iq = db.prepare(
  'INSERT INTO questions (type,module,stem,options,answer,explanation,difficulty,source) VALUES (?,?,?,?,?,?,?,?)',
);
for (const q of questions) {
  iq.run(q.type, q.module, q.stem, JSON.stringify(q.options), q.answer, q.explanation, q.difficulty, q.source);
}
const it = db.prepare(
  'INSERT INTO tasks (kind,title,category,prompt,points,source,meta) VALUES (?,?,?,?,?,?,?)',
);
for (const t of tasks) {
  it.run(t.kind, t.title, t.category, t.prompt, t.points, t.source, JSON.stringify(t.meta));
}
// 考纲：增量合并（保留用户编辑与掌握状态），移除已不在种子中的条目
const isyl = db.prepare(
  'INSERT INTO syllabus (module,section,topic,detail,level,ref,sort) VALUES (?,?,?,?,?,?,?) ON CONFLICT(module,section,topic) DO UPDATE SET detail = excluded.detail, level = excluded.level, ref = excluded.ref',
);
syllabus.forEach((s, i) => isyl.run(s.module, s.section, s.topic, s.detail, s.level ?? '', s.ref ?? '', i));
const keepKeys = syllabus.map((s) => [s.module, s.section, s.topic]);
const existing = db.prepare('SELECT id, module, section, topic FROM syllabus').all();
const del = db.prepare('DELETE FROM syllabus WHERE id = ?');
for (const row of existing) {
  if (!keepKeys.some(([m, sec, t]) => m === row.module && sec === row.section && t === row.topic)) {
    del.run(row.id);
  }
}
console.log(`✓ 题库已灌入：${questions.length} 道题，${tasks.length} 个实操任务，${syllabus.length} 个考纲知识点`);
