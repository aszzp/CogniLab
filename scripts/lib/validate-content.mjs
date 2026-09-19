import { DatabaseSync } from 'node:sqlite';

function countBy(items, field) {
  return items.reduce((acc, row) => { acc[row[field]] = (acc[row[field]] ?? 0) + 1; return acc; }, {});
}
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const normalized = (v) => String(v).normalize('NFKC').replace(/\s+/g, '').toLowerCase();

/** Pure structural validation except trusted SQL reference execution in fresh memory databases. */
export function validateContent(content) {
  const errors = [], warnings = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const { syllabus, questions, tasks, sources, plan, officialNotes } = content;
  for (const [name, value] of Object.entries({ syllabus, questions, tasks, sources, officialNotes })) {
    check(Array.isArray(value), `${name}必须为数组`);
  }
  if (errors.length || !plan) return { ok: false, errors: [...errors, ...(!plan ? ['缺少plan'] : [])], warnings };
  const topicMap = new Map(syllabus.map((s) => [s.key, s]));
  const sourceIds = new Set(sources.map((s) => s.id));
  const modules = new Set(syllabus.map((s) => s.module));
  const seenKeys = new Set();
  for (const [kind, items] of [['topic', syllabus], ['question', questions], ['task', tasks]]) {
    for (const item of items) {
      check(nonempty(item.key), `${kind}: 缺少key`);
      check(!seenKeys.has(item.key), `重复key: ${item.key}`); seenKeys.add(item.key);
    }
  }
  const linkCheck = (item, label, mandatory = true) => {
    check(Array.isArray(item.topic_keys), `${label}: 缺少topic_keys`);
    if (!Array.isArray(item.topic_keys)) return;
    check(!mandatory || item.topic_keys.length > 0, `${label}: 未关联考点`);
    check(new Set(item.topic_keys).size === item.topic_keys.length, `${label}: 重复考点关联`);
    for (const key of item.topic_keys) check(topicMap.has(key), `${label}: 未知考点${key}`);
  };
  for (const s of syllabus) {
    for (const f of ['module', 'section', 'topic', 'detail', 'level', 'ref', 'evidence_status']) check(nonempty(s[f]), `${s.key}: 缺少${f}`);
    check(typeof s.assessable === 'boolean', `${s.key}: assessable应为布尔值`);
    check(['core', 'extension', 'background'].includes(s.priority), `${s.key}: 非法priority`);
    check(Array.isArray(s.source_ids) && s.source_ids.length > 0, `${s.key}: 缺少来源`);
    for (const id of s.source_ids ?? []) check(sourceIds.has(id), `${s.key}: 未知来源${id}`);
  }
  const expandedQ = questions.filter((q) => q.key?.startsWith('exp-'));
  const expandedT = tasks.filter((t) => t.key?.startsWith('exp-'));
  const stems = new Set();
  for (const q of questions) {
    const label = q.key, expanded = label?.startsWith('exp-');
    check(['single', 'multi', 'judge'].includes(q.type), `${label}: 非法题型`);
    check(modules.has(q.module), `${label}: 未知模块${q.module}`);
    check(nonempty(q.stem) && nonempty(q.source), `${label}: 缺少题干或来源`);
    check(Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3, `${label}: 难度须为1..3`);
    check(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 8, `${label}: 选项数量异常`);
    if (!Array.isArray(q.options)) continue;
    check(q.options.every(nonempty) && new Set(q.options.map(normalized)).size === q.options.length, `${label}: 空或重复选项`);
    check(nonempty(q.answer) && /^[A-H]+$/.test(q.answer), `${label}: 答案格式错误`);
    const letters = [...String(q.answer)];
    check(letters.every((c) => c.charCodeAt(0) - 65 < q.options.length), `${label}: 答案超出选项范围`);
    check(letters.length === new Set(letters).size && letters.join('') === [...letters].sort().join(''), `${label}: 答案须去重排序`);
    check(q.type === 'multi' ? letters.length >= 2 : letters.length === 1, `${label}: 答案个数不符题型`);
    if (q.type === 'judge') check(JSON.stringify(q.options) === JSON.stringify(['正确', '错误']), `${label}: 判断题选项须为正确/错误`);
    linkCheck(q, label, expanded || q.source === '官方样题');
    if (expanded) {
      check(nonempty(q.explanation) && q.explanation.length >= 16, `${label}: 解析不足`);
      check(q.source !== '官方样题' && q.review_status === 'authored', `${label}: 原创题不能伪称官方或已审定`);
      check(!stems.has(normalized(q.stem)), `${label}: 新题题干重复`); stems.add(normalized(q.stem));
      check(Array.isArray(q.source_ids) && q.source_ids.length > 0, `${label}: 缺少来源`);
      for (const id of q.source_ids ?? []) check(sourceIds.has(id), `${label}: 未知来源${id}`);
      for (const key of q.topic_keys ?? []) check(topicMap.get(key)?.assessable === true, `${label}: 不应以背景/待核验条目出新题`);
      check(q.module === topicMap.get(q.topic_keys?.[0])?.module, `${label}: 主考点与题目模块不符`);
    }
  }
  for (const t of tasks) {
    const label = t.key, expanded = label?.startsWith('exp-');
    check(['sql', 'python', 'chart', 'flow', 'essay'].includes(t.kind), `${label}: 非法实操类型`);
    for (const f of ['title', 'prompt', 'source']) check(nonempty(t[f]), `${label}: 缺少${f}`);
    check(modules.has(t.category), `${label}: 实操模块不在考纲`);
    check(Number.isInteger(t.points) && t.points > 0, `${label}: 非法分值`);
    linkCheck(t, label, expanded);
    if (!expanded) continue; // Legacy trainer semantics are not silently rewritten by the expansion validator.
    const m = t.meta;
    if (!m || typeof m !== 'object') { check(false, `${label}: 缺少meta`); continue; }
    check(nonempty(m.referenceAnswer), `${label}: 缺少参考解`);
    if (t.kind === 'sql') {
      let db;
      try {
        db = new DatabaseSync(':memory:'); db.exec(m.initSql);
        const stmt = db.prepare(m.expectedSql);
        stmt.setReturnArrays(true);
        const rows = stmt.all(), columns = stmt.columns().map((c) => c.name);
        check(JSON.stringify(columns) === JSON.stringify(m.expectedColumns), `${label}: SQL列名错误`);
        check(JSON.stringify(rows) === JSON.stringify(m.expectedRows), `${label}: SQL参考结果不匹配`);
        check(rows.length > 0, `${label}: SQL参考结果为空`);
        const bad = db.prepare(m.negativeSql); bad.setReturnArrays(true);
        check(JSON.stringify(bad.all()) !== JSON.stringify(rows) || JSON.stringify(bad.columns().map((c) => c.name)) !== JSON.stringify(columns), `${label}: SQL错误解未被区分`);
      } catch (e) { check(false, `${label}: SQL夹具错误: ${e.message}`); }
      finally { db?.close(); }
    }
    if (t.kind === 'python') {
      for (const f of ['preload', 'referenceCode', 'negativeCode', 'starter']) check(nonempty(m[f]), `${label}: 缺少${f}`);
      check(Array.isArray(m.checkpoints) && m.checkpoints.length > 0, `${label}: 缺少检查点`);
      check((m.checkpoints ?? []).every((cp) => nonempty(cp.label) && nonempty(cp.code) && Number.isInteger(cp.points) && cp.points > 0), `${label}: 检查点不完整`);
      check((m.checkpoints ?? []).reduce((n, cp) => n + cp.points, 0) === t.points, `${label}: 检查点分值不守恒`);
      check(new Set((m.checkpoints ?? []).map((cp) => cp.points)).size === 1, `${label}: 当前Python计分器只支持等权检查点`);
    }
    if (t.kind === 'essay') {
      check(Array.isArray(m.rubric) && m.rubric.length > 0, `${label}: 缺少评分标准`);
      check((m.rubric ?? []).every((r) => nonempty(r.label) && nonempty(r.desc) && r.points > 0), `${label}: 评分标准不完整`);
      check((m.rubric ?? []).reduce((n, r) => n + r.points, 0) === 100, `${label}: 主观题rubric是百分比权重，须合计100`);
    }
    if (t.kind === 'chart') {
      check(JSON.stringify(m.dataset?.columns) === JSON.stringify(['age', 'type', 'times']), `${label}: 当前图表练习器要求age/type/times列`);
      const g = m.target ?? {};
      check(['bar', 'line', 'heatmap', 'pie'].includes(g.chartType), `${label}: 非法图表类型`);
      check(['age', 'type'].includes(g.rowDim) && ['age', 'type'].includes(g.colDim) && g.rowDim !== g.colDim, `${label}: 维度配置异常`);
      check(g.metric === 'times' && ['sum', 'count', 'avg'].includes(g.agg), `${label}: 指标配置异常`);
      check(Array.isArray(g.ageRange) && g.ageRange.length === 2 && g.ageRange.every(Number.isFinite) && g.ageRange[0] <= g.ageRange[1], `${label}: 范围错误`);
      check(Array.isArray(g.types) && g.types.length > 0 && g.types.every((x) => ['娱乐时事', '政治时事', '民生时事'].includes(x)), `${label}: 类型筛选不支持`);
      check(nonempty(g.title) && Array.isArray(m.expectedCells) && m.expectedCells.length > 0, `${label}: 缺少标题或聚合夹具`);
    }
    if (t.kind === 'flow') {
      const nodes = m.nodes ?? [], edges = m.edges ?? [], answers = m.answers ?? [], choices = m.choices ?? [];
      const ids = new Set(nodes.map((n) => n.id));
      check(ids.size === nodes.length && nodes.length > 0, `${label}: 节点为空或ID重复`);
      check(nodes.every((n) => nonempty(n.id) && ['start', 'end', 'action', 'judge'].includes(n.kind)), `${label}: 非法节点`);
      check(edges.every((e) => Array.isArray(e) && ids.has(e[0]) && ids.has(e[1])), `${label}: 悬空边`);
      const blanks = nodes.filter((n) => n.blank !== undefined).map((n) => n.blank).sort((a, b) => a - b);
      check(JSON.stringify(blanks) === JSON.stringify(answers.map((_, i) => i)), `${label}: 空位索引缺失/重复/越界`);
      check(answers.length > 0 && new Set(choices).size === choices.length && answers.every((a) => choices.includes(a)), `${label}: 流程候选答案无效`);
      for (const n of nodes.filter((n) => n.kind === 'judge')) {
        const outs = edges.filter((e) => e[0] === n.id);
        check(outs.length === 2 && ['是', '否'].every((v) => outs.some((e) => e[2] === v)), `${label}: 判断节点${n.id}应有是/否两条边`);
      }
      const starts = nodes.filter((n) => n.kind === 'start').map((n) => n.id);
      const ends = nodes.filter((n) => n.kind === 'end').map((n) => n.id);
      const reach = (initial, reverse = false) => {
        const seen = new Set(initial), queue = [...initial];
        for (let i = 0; i < queue.length; i++) for (const e of edges) {
          const from = e[reverse ? 1 : 0], to = e[reverse ? 0 : 1];
          if (from === queue[i] && !seen.has(to)) { seen.add(to); queue.push(to); }
        }
        return seen;
      };
      check(starts.length === 1 && ends.length > 0, `${label}: 需要一个起点及至少一个终点`);
      check(reach(starts).size === ids.size && reach(ends, true).size === ids.size, `${label}: 存在不可达节点或无出口子图`);
    }
  }
  const coverage = Object.fromEntries(syllabus.map((s) => [s.key, expandedQ.filter((q) => q.topic_keys?.includes(s.key)).length]));
  check(syllabus.length === plan.catalogue_count, '考点总量未达到计划');
  check(expandedQ.length === plan.question_target && expandedT.length === plan.task_target, '新增题量未达到计划');
  for (const s of syllabus) check(coverage[s.key] === (s.assessable ? plan.questions_per_assessable_topic : 0), `${s.key}: 计划为${s.assessable ? 2 : 0}题，实际${coverage[s.key]}题`);
  const assessable = syllabus.filter((s) => s.assessable).map((s) => s.key).sort();
  check(JSON.stringify(assessable) === JSON.stringify([...plan.assessable_topics].sort()), '可考核条目与计划不一致');
  check(JSON.stringify(syllabus.filter((s) => !s.assessable).map((s) => s.key).sort()) === JSON.stringify([...plan.background_topics].sort()), '背景条目与计划不一致');
  const verifyCounts = (actual, wanted, label) => {
    check(Object.keys(actual).length === Object.keys(wanted).length && Object.entries(wanted).every(([key, n]) => actual[key] === n), `${label}分布与计划不一致`);
  };
  verifyCounts(countBy(expandedQ, 'type'), plan.question_types, '题型');
  verifyCounts(countBy(expandedQ, 'module'), plan.question_modules, '模块');
  verifyCounts(countBy(expandedT, 'kind'), plan.task_kinds, '实操');
  check(officialNotes.length === 45 && officialNotes.every((n, i) => n.number === i + 1), '样题校订说明须完整覆盖1..45');
  for (const note of officialNotes) linkCheck(note, `样题Q${note.number}`);
  const singleDistribution = countBy(expandedQ.filter((q) => q.type === 'single'), 'answer');
  const judgeDistribution = countBy(expandedQ.filter((q) => q.type === 'judge'), 'answer');
  for (const letter of 'ABCD') check((singleDistribution[letter] ?? 0) >= 30 && (singleDistribution[letter] ?? 0) <= 65, `单选答案位置${letter}分布过偏`);
  check((judgeDistribution.A ?? 0) >= 8 && (judgeDistribution.B ?? 0) >= 8, '判断题正误分布过偏');
  warnings.push('原始三个PDF尚未逐页核验；本报告不是官方考纲认证或专家审题结论。');
  if (content.baseline) warnings.push('历史手写题未全部逐题关联考点；覆盖率仅对新增242题计算。');
  return {
    ok: errors.length === 0, errors, warnings,
    counts: { topics: syllabus.length, assessable: assessable.length, background: syllabus.length - assessable.length, newQuestions: expandedQ.length, newTasks: expandedT.length, totalQuestions: questions.length, totalTasks: tasks.length },
    questionTypes: countBy(expandedQ, 'type'), taskKinds: countBy(expandedT, 'kind'),
    questionModules: countBy(expandedQ, 'module'), singleDistribution, judgeDistribution, coverage,
    baseline: content.baseline ?? null,
  };
}
