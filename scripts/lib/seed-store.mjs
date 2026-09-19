import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const CORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, module TEXT NOT NULL,
 stem TEXT NOT NULL, options TEXT NOT NULL, answer TEXT NOT NULL,
 explanation TEXT DEFAULT '', difficulty INTEGER DEFAULT 2, source TEXT DEFAULT '',
 created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL,
 category TEXT NOT NULL, prompt TEXT NOT NULL, points INTEGER DEFAULT 10,
 source TEXT DEFAULT '', meta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS syllabus (
 id INTEGER PRIMARY KEY AUTOINCREMENT, module TEXT NOT NULL, section TEXT NOT NULL,
 topic TEXT NOT NULL, detail TEXT DEFAULT '', level TEXT DEFAULT '', ref TEXT DEFAULT '',
 mastered INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, UNIQUE(module, section, topic)
);
CREATE TABLE IF NOT EXISTS lessons (
 topic_id INTEGER PRIMARY KEY, content TEXT, anim_html TEXT,
 created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY, value TEXT NOT NULL,
 updated_at TEXT DEFAULT (datetime('now','localtime'))
);
`;
const KINDS = {
  questions: ['type', 'module', 'stem', 'options', 'answer', 'explanation', 'difficulty', 'source', 'content_meta'],
  tasks: ['kind', 'title', 'category', 'prompt', 'points', 'source', 'meta'],
  syllabus: ['module', 'section', 'topic', 'detail', 'level', 'ref', 'sort', 'content_meta'],
};
const canonical = (x) => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const json = (x) => JSON.stringify(canonical(x));
const parse = (x) => { try { return JSON.parse(x); } catch { return null; } };

function metadata(item) {
  return {
    key: item.key, topic_keys: item.topic_keys ?? [], source_ids: item.source_ids ?? [],
    review_status: item.review_status ?? item.evidence_status ?? 'legacy_unmapped',
    ...(item.official_number ? { official_number: item.official_number } : {}),
    ...(item.duplicate_of ? { duplicate_of: item.duplicate_of } : {}),
  };
}
function payload(kind, item, index, legacy = false) {
  if (kind === 'questions') return {
    type: item.type, module: item.module, stem: item.stem, options: json(item.options),
    answer: item.answer, explanation: item.explanation ?? '', difficulty: item.difficulty ?? 2,
    source: item.source ?? '', ...(!legacy ? { content_meta: json(metadata(item)) } : {}),
  };
  if (kind === 'tasks') return {
    kind: item.kind, title: item.title, category: item.category, prompt: item.prompt,
    points: item.points ?? 10, source: item.source ?? '',
    meta: json(legacy ? item.meta : { ...item.meta, content: metadata(item) }),
  };
  return {
    module: item.module, section: item.section, topic: item.topic, detail: item.detail ?? '',
    level: item.level ?? '', ref: item.ref ?? '', sort: item.sort ?? index,
    ...(!legacy ? { content_meta: json({ ...metadata(item), priority: item.priority, assessable: item.assessable }) } : {}),
  };
}
function equivalent(a, b, field) {
  return ['options', 'meta', 'content_meta'].includes(field) ? json(parse(a)) === json(parse(b)) : a === b;
}

export function migrate(db) {
  db.exec(CORE_SCHEMA);
  for (const table of Object.keys(KINDS)) {
    const names = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    if (!names.has('stable_key')) db.exec(`ALTER TABLE ${table} ADD COLUMN stable_key TEXT`);
    if (table !== 'tasks' && !names.has('content_meta')) db.exec(`ALTER TABLE ${table} ADD COLUMN content_meta TEXT NOT NULL DEFAULT '{}'`);
    if (table === 'syllabus') for (const c of ['level', 'ref']) if (!names.has(c)) db.exec(`ALTER TABLE syllabus ADD COLUMN ${c} TEXT DEFAULT ''`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_stable_key ON ${table}(stable_key)`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS seed_registry (
    kind TEXT NOT NULL, stable_key TEXT NOT NULL, row_id INTEGER NOT NULL,
    last_payload TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(kind, stable_key), UNIQUE(kind, row_id)
  );
  CREATE TABLE IF NOT EXISTS seed_topic_links (
    kind TEXT NOT NULL, row_id INTEGER NOT NULL, topic_key TEXT NOT NULL,
    PRIMARY KEY(kind, row_id, topic_key)
  );
  CREATE TABLE IF NOT EXISTS seed_lesson_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER NOT NULL,
    content TEXT, anim_html TEXT, original_created_at TEXT,
    old_detail TEXT, new_detail TEXT, reason TEXT NOT NULL,
    archived_at TEXT DEFAULT (datetime('now'))
  );`);
}

/** A SQLite snapshot includes committed WAL data. Called outside an active transaction. */
export function backupDatabase(db, directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const name = `cognilab-before-seed-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.db`;
  const target = path.join(directory, name);
  if (existsSync(target)) throw new Error('拒绝覆盖已有数据库备份');
  db.prepare('VACUUM INTO ?').run(target);
  chmodSync(target, 0o600);
  return target;
}

function findLegacy(db, kind, item) {
  let rows = [];
  if (kind === 'questions' && item._legacy) {
    const o = item._legacy;
    rows = db.prepare('SELECT * FROM questions WHERE type=? AND stem=? AND source=?').all(o.type, o.stem, o.source);
    const matches = rows.filter((r) => r.module === o.module && json(parse(r.options)) === json(o.options));
    if (!matches.length && rows.length) throw new Error(`${item.key}: 发现题干相同但内容不同的旧题，请人工核对，未新建重复题`);
    rows = matches;
  } else if (kind === 'tasks' && item._legacy) {
    rows = db.prepare('SELECT * FROM tasks WHERE kind=? AND title=?').all(item._legacy.kind, item._legacy.title);
  } else if (kind === 'syllabus') {
    const names = [...new Set([item.topic, ...(item.legacy_topics ?? [])])];
    rows = db.prepare(`SELECT * FROM syllabus WHERE module=? AND topic IN (${names.map(() => '?').join(',')})`).all(item.module, ...names);
  }
  if (rows.length > 1) throw new Error(`${item.key}: 旧库中有${rows.length}个候选项，拒绝猜测ID`);
  if (rows[0]?.stable_key && rows[0].stable_key !== item.key) throw new Error(`${item.key}: 旧记录已归属于另一个稳定键`);
  return rows[0];
}

/** One transaction, no destructive reset. Never modifies learning-history tables. */
export function importContent(db, content) {
  const result = { inserted: 0, updated: 0, adopted: 0, unchanged: 0, archivedLessons: 0, conflicts: [] };
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('BEGIN IMMEDIATE');
  try {
    migrate(db);
    for (const [kind, fields] of Object.entries(KINDS)) {
      const items = content[kind];
      if (!Array.isArray(items)) throw new Error(`缺少${kind}`);
      if (new Set(items.map((item) => item.key)).size !== items.length) throw new Error(`${kind}: 重复稳定键，拒绝导入`);
      for (const [index, item] of items.entries()) {
        if (!item.key) throw new Error(`${kind}: 缺少稳定键`);
        const incoming = payload(kind, item, index);
        let row = db.prepare(`SELECT * FROM ${kind} WHERE stable_key=?`).get(item.key);
        let adopted = false;
        if (!row) { row = findLegacy(db, kind, item); adopted = !!row; }
        let id;
        if (!row) {
          const insert = db.prepare(`INSERT INTO ${kind} (stable_key,${fields.join(',')}) VALUES (${Array(fields.length + 1).fill('?').join(',')})`);
          id = Number(insert.run(item.key, ...fields.map((f) => incoming[f])).lastInsertRowid);
          result.inserted += 1;
        } else {
          id = row.id;
          const registry = db.prepare('SELECT * FROM seed_registry WHERE kind=? AND stable_key=?').get(kind, item.key);
          if (registry && registry.row_id !== id) throw new Error(`${item.key}: 注册表ID不一致`);
          let previous = registry ? JSON.parse(registry.last_payload) : item._legacyPayload ? payload(kind, item._legacyPayload, index, true) : null;
          if (kind === 'syllabus' && !previous) {
            throw new Error(`${item.key}: 缺少旧考纲快照，不能安全区分用户编辑。请通过APPLY.py安装（自动保存legacy-syllabus.snapshot.json）。`);
          }
          previous ??= {};
          const merged = {};
          for (const f of fields) {
            // Three-way merge: preserve a user-edited field, even on the first legacy adoption.
            const userChanged = Object.hasOwn(previous, f) && !equivalent(row[f], previous[f], f);
            if (userChanged && !equivalent(row[f], incoming[f], f)) {
              merged[f] = row[f];
              if (!equivalent(incoming[f], previous[f], f)) result.conflicts.push({ kind, key: item.key, field: f, resolution: 'preserved_user_value' });
            } else merged[f] = incoming[f];
          }
          const changed = fields.some((f) => !equivalent(row[f], merged[f], f));
          if (kind === 'syllabus' && ['detail', 'ref', 'level', 'topic'].some((f) => row[f] !== merged[f])) {
            const lesson = db.prepare('SELECT * FROM lessons WHERE topic_id=?').get(id);
            if (lesson) {
              db.prepare(`INSERT INTO seed_lesson_archive (topic_id,content,anim_html,original_created_at,old_detail,new_detail,reason) VALUES (?,?,?,?,?,?,?)`)
                .run(id, lesson.content, lesson.anim_html, lesson.created_at, row.detail, merged.detail, '考点内容校订，归档旧生成课程后重新生成');
              db.prepare('DELETE FROM lessons WHERE topic_id=?').run(id);
              result.archivedLessons += 1;
            }
          }
          db.prepare(`UPDATE ${kind} SET stable_key=?,${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`)
            .run(item.key, ...fields.map((f) => merged[f]), id);
          if (adopted) result.adopted += 1;
          if (changed) result.updated += 1; else result.unchanged += 1;
        }
        db.prepare(`INSERT INTO seed_registry (kind,stable_key,row_id,last_payload) VALUES (?,?,?,?)
          ON CONFLICT(kind,stable_key) DO UPDATE SET row_id=excluded.row_id,last_payload=excluded.last_payload,updated_at=datetime('now')`)
          .run(kind, item.key, id, json(incoming));
        db.prepare('DELETE FROM seed_topic_links WHERE kind=? AND row_id=?').run(kind, id);
        const topicKeys = kind === 'syllabus' ? [item.key] : item.topic_keys ?? [];
        for (const key of new Set(topicKeys)) db.prepare('INSERT INTO seed_topic_links (kind,row_id,topic_key) VALUES (?,?,?)').run(kind, id, key);
      }
    }
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK'); throw error;
  }
}
