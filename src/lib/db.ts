import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'cognilab.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  module TEXT NOT NULL,
  stem TEXT NOT NULL,
  options TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT DEFAULT '',
  difficulty INTEGER DEFAULT 2,
  source TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  source TEXT DEFAULT '',
  meta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  time_ms INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'practice',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_q ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_t ON attempts(created_at);
CREATE TABLE IF NOT EXISTS task_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  score INTEGER,
  detail TEXT,
  answer TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS review_queue (
  question_id INTEGER PRIMARY KEY,
  ease REAL DEFAULT 2.5,
  interval_days REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  due_at TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  answers TEXT,
  score REAL,
  total INTEGER,
  correct INTEGER,
  duration_sec INTEGER,
  started_at TEXT DEFAULT (datetime('now','localtime')),
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS syllabus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  section TEXT NOT NULL,
  topic TEXT NOT NULL,
  detail TEXT DEFAULT '',
  level TEXT DEFAULT '',
  ref TEXT DEFAULT '',
  mastered INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  UNIQUE(module, section, topic)
);
CREATE TABLE IF NOT EXISTS lessons (
  topic_id INTEGER PRIMARY KEY,
  content TEXT,
  anim_html TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS finals_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing',
  started_at INTEGER NOT NULL,
  deadline_at INTEGER,
  finished_at INTEGER,
  end_reason TEXT,
  answers TEXT NOT NULL DEFAULT '{}',
  code TEXT NOT NULL DEFAULT '{}',
  submissions TEXT NOT NULL DEFAULT '{}',
  switch_count INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL DEFAULT 0,
  score REAL,
  theory_score REAL,
  code_score REAL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS finals_practice (
  problem_key TEXT PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  best_passed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS gym_progress (
  item_key TEXT PRIMARY KEY,
  mastery INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  last_result TEXT,
  next_review_at INTEGER,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS gym_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT NOT NULL,
  drill_id TEXT NOT NULL,
  type TEXT NOT NULL,
  correct INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  trap TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_gym_attempts_item ON gym_attempts(item_key);
CREATE INDEX IF NOT EXISTS idx_gym_attempts_time ON gym_attempts(created_at);
`;

function migrate(d: DatabaseSync) {
  const cols = d.prepare('PRAGMA table_info(syllabus)').all() as { name: string }[];
  if (cols.length && !cols.some((c) => c.name === 'level')) {
    d.exec("ALTER TABLE syllabus ADD COLUMN level TEXT DEFAULT ''");
  }
  if (cols.length && !cols.some((c) => c.name === 'ref')) {
    d.exec("ALTER TABLE syllabus ADD COLUMN ref TEXT DEFAULT ''");
  }
  const lessonCols = d.prepare('PRAGMA table_info(lessons)').all() as { name: string }[];
  if (lessonCols.length && !lessonCols.some((c) => c.name === 'quiz_json')) {
    d.exec('ALTER TABLE lessons ADD COLUMN quiz_json TEXT');
  }
}

const g = globalThis as unknown as { __cognilab_db?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__cognilab_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const d = new DatabaseSync(DB_PATH);
    d.exec(SCHEMA);
    migrate(d);
    g.__cognilab_db = d;
  }
  return g.__cognilab_db;
}

export function qAll<T = Record<string, unknown>>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function qGet<T = Record<string, unknown>>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function qRun(sql: string, ...params: (string | number | null)[]): void {
  db().prepare(sql).run(...params);
}
