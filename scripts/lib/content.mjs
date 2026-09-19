import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (root, name) => {
  try { return JSON.parse(readFileSync(path.join(root, name), 'utf8')); }
  catch (error) { throw new Error(`无法读取 ${name}: ${error.message}`, { cause: error }); }
};
export function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

export function readExpansion(root = PROJECT_ROOT) {
  const base = 'data/expansion/';
  return {
    syllabus: readJson(root, 'data/seed-syllabus.json'),
    questions: readJson(root, `${base}questions-v1.json`),
    tasks: readJson(root, `${base}tasks-v1.json`),
    sources: readJson(root, `${base}sources-v1.json`),
    plan: readJson(root, `${base}plan-v1.json`),
    officialNotes: readJson(root, `${base}official-notes-v1.json`),
  };
}

const questionIdentity = (q) => ({
  type: q.type, module: q.module, stem: q.stem,
  options: q.options, source: q.source ?? '',
});
const taskIdentity = (t) => ({ kind: t.kind, title: t.title });

/** Read legacy seeds without overwriting them. The original official answer/order is immutable. */
export function loadContent(root = PROJECT_ROOT) {
  const expansion = readExpansion(root);
  const originalQuestions = readJson(root, 'data/seed-questions.json');
  const originalTasks = readJson(root, 'data/seed-tasks.json');
  if (!Array.isArray(originalQuestions) || !Array.isArray(originalTasks)) {
    throw new Error('原题库必须是 JSON 数组；请保留仓库原始 seed-questions.json / seed-tasks.json。');
  }
  const topics = new Map(expansion.syllabus.map((s) => [s.key, s]));
  const notes = new Map(expansion.officialNotes.map((n) => [n.number, n]));
  const officialCount = originalQuestions.filter((q) => q.source === '官方样题').length;
  if (officialCount !== expansion.plan.official_questions_expected) {
    throw new Error(`样题基线已变化：期望45题，读到${officialCount}题。请先复核题号映射，不能按猜测套用校订说明。`);
  }
  for (const [name, expected] of [['data/seed-questions.json', expansion.plan.legacy_questions_git_blob], ['data/seed-tasks.json', expansion.plan.legacy_tasks_git_blob]]) {
    const bytes = readFileSync(path.join(root, name));
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (expected && hash !== expected) throw new Error(`${name}: 原始题库基线已改变，须复核题号和迁移映射，不能直接套用旧校订说明。`);
  }
  let ordinal = 0;
  const occurrences = new Map();
  const questions = originalQuestions.map((original) => {
    const q = structuredClone(original);
    q._legacy = questionIdentity(original);
    q._legacyPayload = structuredClone(original);
    q.source_ids = ['REPO'];
    q.topic_keys = [];
    q.review_status = 'legacy_unmapped';
    if (q.source === '官方样题') {
      ordinal += 1;
      const note = notes.get(ordinal);
      if (!note) throw new Error(`缺少样题Q${ordinal}说明`);
      q.key = `base-official-${String(ordinal).padStart(3, '0')}`;
      q.topic_keys = [...note.topic_keys];
      q.review_status = note.review_status;
      q.official_number = ordinal;
      q.module = topics.get(note.topic_keys[0]).module;
      q.source_ids = ['REPO', 'SAMPLE'];
      q.explanation = `【仓库样题Q${ordinal}；PDF尚未逐题复核】保留现存答案 ${original.answer}。${note.explanation}`;
      if (ordinal === 32) q.duplicate_of = 'base-official-028';
      // Deliberately never assign q.answer here.
    } else {
      const fingerprint = digest(questionIdentity(original));
      const n = (occurrences.get(fingerprint) ?? 0) + 1;
      occurrences.set(fingerprint, n);
      q.key = `base-q-${fingerprint}-${n}`;
      // Correct identifiable handwritten overstatements only, retaining answer-letter order.
      if (q.options.some((o) => o === '《知识产权法》')) {
        q.options = q.options.map((o) => o === '《知识产权法》' ? '知识产权相关法律' : o);
        q.explanation = '应按知识产权相关法律知识领域学习，包含著作权、专利、商标等基础；各法律的正式名称及版本应另行核对，标准列目仍待PDF复核。';
      }
      if (q.stem.includes('本地化适配训练可以包括')) {
        q.stem = '围绕地方语言、地方事件与文化内容，哪些是数字人主播本地化的专项语料或资源？';
        q.explanation = '前三项属于本地专项资源；通用翻译模型可作辅助工具，但本身不等同于这些专项语料。不能概括为翻译与本地化无关。';
      }
      if (q.explanation?.includes('情感识别不属于视觉交互')) {
        q.explanation = '手势、表情、姿态可作为视觉输入。情感识别是分析任务，也可能使用视觉信息，不能把两者当作普遍互斥概念。';
      }
      if (q.stem.includes('model.score(X_test, y_test) 对分类模型')) {
        q.stem = 'scikit-learn 的 LogisticRegression 在默认无样本权重时，model.score(X_test, y_test) 返回什么？';
        q.explanation = 'LogisticRegression.score 默认返回分类准确率。其他估计器的score含义应查其接口，不能一概泛化。';
      }
    }
    return q;
  });
  const taskOccurrences = new Map();
  const tasks = originalTasks.map((original) => {
    const t = structuredClone(original);
    const fingerprint = digest(taskIdentity(original));
    const n = (taskOccurrences.get(fingerprint) ?? 0) + 1;
    taskOccurrences.set(fingerprint, n);
    t.key = `base-task-${fingerprint}-${n}`;
    t._legacy = taskIdentity(original);
    t._legacyPayload = structuredClone(original);
    t.category = ({ '系统设计': '智能系统设计', '数字人': '数字人专项' })[t.category] ?? t.category;
    t.topic_keys = []; t.review_status = 'legacy_unmapped';
    return t;
  });
  const snapshotPath = path.join(root, 'data/expansion/legacy-syllabus.snapshot.json');
  if (existsSync(snapshotPath)) {
    const bytes = readFileSync(snapshotPath);
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (hash !== expansion.plan.legacy_syllabus_git_blob) throw new Error('旧考纲快照不匹配已审阅基线，拒绝据此迁移用户编辑。');
    const snapshot = readJson(root, 'data/expansion/legacy-syllabus.snapshot.json');
    const oldTopics = new Map(snapshot.map((s, i) => [`${s.module}\0${s.topic}`, { ...s, sort: i }]));
    for (const s of expansion.syllabus) {
      const old = [s.topic, ...(s.legacy_topics ?? [])].map(t => oldTopics.get(`${s.module}\0${t}`)).find(Boolean);
      if (old) s._legacyPayload = old;
    }
  }
  return {
    ...expansion,
    questions: [...questions, ...expansion.questions],
    tasks: [...tasks, ...expansion.tasks],
    baseline: { questions: originalQuestions.length, tasks: originalTasks.length, official: officialCount },
  };
}
