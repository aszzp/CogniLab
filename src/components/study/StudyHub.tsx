'use client';

import { useMemo, useState } from 'react';
import { Network, ListChecks, Plus, Trash2, Loader2, Sparkles, BookOpen, CircleDot, CheckCircle2, CircleCheckBig, ChevronDown } from 'lucide-react';
import GraphView from './GraphView';
import LessonDrawer from './LessonDrawer';
import type { SyllabusItem } from '@/app/study/page';

const MODULE_ORDER = ['职业道德与基础知识', '数据处理与标注', '业务分析', '智能训练', '智能系统设计', '培训与指导', '数字人专项'];
const LEVEL_CLS: Record<string, string> = {
  基础: 'bg-amber-400/15 text-amber-300',
  五级四级: 'bg-sky-400/15 text-sky-300',
  三级: 'bg-violet-400/15 text-violet-300',
  二级: 'bg-cyan-400/15 text-cyan-300',
  一级: 'bg-rose-400/15 text-rose-300',
  工种: 'bg-fuchsia-400/15 text-fuchsia-300',
};
const MASTER_ICON = [CircleDot, CheckCircle2, CircleCheckBig];
const MASTER_CLS = ['text-zinc-600', 'text-cyan-300', 'text-emerald-400'];
const MASTER_LABEL = ['未学', '已学', '掌握'];

export default function StudyHub({ items: initial }: { items: SyllabusItem[] }) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [lesson, setLesson] = useState<SyllabusItem | null>(null);
  const [expanded, setExpanded] = useState<string[]>([MODULE_ORDER[1]]);
  const [editMode, setEditMode] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [genState, setGenState] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  const grouped = useMemo(() => {
    const g = new Map<string, SyllabusItem[]>();
    for (const it of items) {
      if (!g.has(it.module)) g.set(it.module, []);
      g.get(it.module)!.push(it);
    }
    return g;
  }, [items]);

  async function refresh() {
    const res = await fetch('/api/syllabus');
    setItems(await res.json());
  }

  function cycleMastered(it: SyllabusItem) {
    const next = (it.mastered + 1) % 3;
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, mastered: next } : x)));
    fetch('/api/syllabus', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id, mastered: next }),
    }).catch(() => {});
  }

  async function removeItem(it: SyllabusItem) {
    if (!confirm(`删除知识点「${it.topic}」？`)) return;
    setItems((arr) => arr.filter((x) => x.id !== it.id));
    await fetch(`/api/syllabus?id=${it.id}`, { method: 'DELETE' });
  }

  async function batchQuiz() {
    const ids = [...selected];
    if (!ids.length) return;
    setGenState('坤哥命题中…');
    const n = Math.min(ids.length * 2, 12);
    const res = await fetch('/api/study/quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicIds: ids, count: n }),
    });
    const data = await res.json();
    if (data.questions?.length) {
      setGenState(`预览确认中（${data.questions.length} 题）`);
      const save = confirm(`生成了 ${data.questions.length} 道题（首个：${data.questions[0].stem.slice(0, 40)}…）。\n\n确定入库？取消则放弃。`);
      if (save) {
        await fetch('/api/study/quiz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ save: true, questions: data.questions }),
        });
        setGenState(`✓ 已入库 ${data.questions.length} 题，去刷题模块使用`);
      } else setGenState(null);
    } else setGenState('生成失败：' + (data.error ?? '请重试'));
    setSelected(new Set());
    setSelecting(false);
  }

  async function batchLessons() {
    const ids = [...selected];
    if (!ids.length) return;
    setGenState('批量生成讲解（后台缓存）…');
    let done = 0;
    for (const id of ids) {
      await fetch('/api/study/lesson', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: id }),
      }).catch(() => {});
      done++;
      setGenState(`批量生成讲解 ${done}/${ids.length}…`);
    }
    setGenState(`✓ ${ids.length} 个知识点讲解已生成，点击任意知识点即可秒开`);
    setSelected(new Set());
    setSelecting(false);
  }

  const totalMastered = items.filter((x) => x.mastered === 2).length;

  return (
    <div className="fade-up space-y-4" key={reload}>
      {/* 顶栏 */}
      <div className="flex items-center gap-2 pt-1">
        <GraduationCapIcon />
        <h1 className="text-lg font-bold">考纲学习</h1>
        <span className="ml-auto text-[11px] text-zinc-500">
          {items.length} 知识点 · 已掌握 {totalMastered}
        </span>
      </div>

      {/* 视图切换 */}
      <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {([['graph', '知识图谱', Network], ['list', '考纲清单', ListChecks]] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition-colors ${
              view === v ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/25 text-white' : 'text-zinc-500'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {genState && (
        <div className="card flex items-center gap-2 border-violet-400/25 bg-violet-500/[0.07] p-3 text-[12.5px] text-violet-200">
          <Loader2 size={13} className={genState.includes('…') ? 'animate-spin' : 'hidden'} />
          {genState}
        </div>
      )}

      {view === 'graph' ? (
        <GraphView
          items={items}
          onSelectTopic={(t) => setLesson(t)}
        />
      ) : (
        <div className="space-y-3">
          {/* 编辑/多选控制 */}
          <div className="flex gap-2">
            <button onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}
              className={`flex-1 rounded-xl border py-2 text-[12.5px] transition-colors ${selecting ? 'border-violet-400/50 bg-violet-500/15 text-violet-200' : 'border-white/12 text-zinc-400'}`}>
              {selecting ? `已选 ${selected.size} 项 · 点击完成` : '批量选择知识点'}
            </button>
            <button onClick={() => setEditMode(!editMode)}
              className={`flex-1 rounded-xl border py-2 text-[12.5px] transition-colors ${editMode ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : 'border-white/12 text-zinc-400'}`}>
              {editMode ? '完成编辑' : '编辑清单'}
            </button>
            <button onClick={() => setAdding(true)}
              className="grad-btn flex items-center gap-1 rounded-xl px-3.5 text-[12.5px] font-medium text-white">
              <Plus size={13} /> 添加
            </button>
          </div>

          {/* 模块折叠列表 */}
          {MODULE_ORDER.filter((m) => grouped.has(m)).map((mod) => {
            const list = grouped.get(mod)!;
            const mastered = list.filter((x) => x.mastered === 2).length;
            const open = expanded.includes(mod);
            const sections = [...new Set(list.map((x) => x.section))];
            return (
              <div key={mod} className="card overflow-hidden">
                <button onClick={() => setExpanded((e) => (open ? e.filter((x) => x !== mod) : [...e, mod]))}
                  className="flex w-full items-center gap-2 px-4 py-3.5">
                  <ChevronDown size={15} className={`text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`} />
                  <span className="text-[14.5px] font-semibold">{mod}</span>
                  <span className="ml-auto text-[11px] text-zinc-500">掌握 {mastered}/{list.length}</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      style={{ width: `${list.length ? (mastered / list.length) * 100 : 0}%` }} />
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-white/6 px-3 pb-3 pt-3">
                    {sections.map((sec) => {
                      const secItems = list.filter((x) => x.section === sec);
                      return (
                        <div key={sec} className="rounded-xl bg-white/[0.02] p-2.5">
                          <div className="mb-1.5 flex items-center gap-2 px-1">
                            <p className="text-[12.5px] font-semibold text-zinc-300">{sec}</p>
                            <span className="text-[10px] text-zinc-600">{secItems.length} 点</span>
                            <button
                              onClick={() => {
                                const ids = secItems.map((x) => x.id);
                                const all = ids.every((id) => selected.has(id));
                                setSelected((s) => {
                                  const n = new Set(s);
                                  ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
                                  return n;
                                });
                                setSelecting(true);
                              }}
                              className="ml-auto rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-zinc-500">
                              全选
                            </button>
                          </div>
                          <div className="space-y-1">
                            {secItems.map((it) => {
                              const MIcon = MASTER_ICON[it.mastered];
                              return (
                                <div key={it.id} className="flex items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-white/[0.03]">
                                  {selecting ? (
                                    <button onClick={() => setSelected((s) => {
                                      const n = new Set(s);
                                      n.has(it.id) ? n.delete(it.id) : n.add(it.id);
                                      return n;
                                    })}
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected.has(it.id) ? 'border-violet-400 bg-violet-500 text-white' : 'border-white/25'}`}>
                                      {selected.has(it.id) && <CheckCircle2 size={12} />}
                                    </button>
                                  ) : (
                                    <button title={`${MASTER_LABEL[it.mastered]}（点击切换）`} onClick={() => cycleMastered(it)}>
                                      <MIcon size={17} className={MASTER_CLS[it.mastered]} />
                                    </button>
                                  )}
                                  <button onClick={() => !selecting && setLesson(it)} className="min-w-0 flex-1 text-left">
                                    <p className={`truncate text-[13px] ${selecting ? 'text-zinc-400' : 'text-zinc-200'}`}>{it.topic}</p>
                                    <p className="truncate text-[10.5px] text-zinc-600">
                                      {it.level && <span className={`mr-1 rounded px-1 py-px text-[9px] ${LEVEL_CLS[it.level] ?? 'bg-white/8 text-zinc-400'}`}>{it.level}</span>}
                                      {it.detail}
                                    </p>
                                  </button>
                                  {!selecting && (
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button onClick={() => setLesson(it)} title="AI 讲解"
                                        className="rounded-lg border border-violet-400/25 bg-violet-500/10 p-1.5 text-violet-300">
                                        <BookOpen size={13} />
                                      </button>
                                      {editMode && (
                                        <button onClick={() => removeItem(it)} title="删除"
                                          className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-1.5 text-rose-300">
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* 批量操作栏 */}
          {selecting && selected.size > 0 && (
            <div className="fixed inset-x-3 bottom-24 z-40 flex gap-2 rounded-2xl border border-white/12 bg-[#12101c]/97 p-2.5 shadow-2xl backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:w-96">
              <button onClick={batchLessons} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2.5 text-[12.5px] font-medium text-cyan-200">
                <BookOpen size={13} /> 批量讲解
              </button>
              <button onClick={batchQuiz} className="grad-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold text-white">
                <Sparkles size={13} /> 出模拟题
              </button>
            </div>
          )}
        </div>
      )}

      {/* 添加知识点 */}
      {adding && <AddTopicDialog modules={MODULE_ORDER.filter((m) => grouped.has(m))} onClose={() => setAdding(false)} onDone={() => { refresh(); setReload((r) => r + 1); }} />}

      {/* 讲解抽屉 */}
      {lesson && (
        <LessonDrawer
          topic={lesson}
          onMastered={(v) => { setItems((arr) => arr.map((x) => (x.id === lesson.id ? { ...x, mastered: v } : x))); }}
          onClose={() => setLesson(null)}
        />
      )}
    </div>
  );
}

function GraduationCapIcon() {
  return <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/25 text-violet-300"><Sparkles size={15} /></span>;
}

function AddTopicDialog({ modules, onClose, onDone }: { modules: string[]; onClose: () => void; onDone: () => void }) {
  const [module, setModule] = useState(modules[0] ?? '数字人');
  const [section, setSection] = useState('');
  const [topic, setTopic] = useState('');
  const [detail, setDetail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!section.trim() || !topic.trim()) {
      setErr('章节和知识点名称必填');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/syllabus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, section: section.trim(), topic: topic.trim(), detail: detail.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) { setErr(data.error); return; }
    onDone();
    onClose();
  }

  const inp = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-3 rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-bold">添加知识点</p>
        <select value={module} onChange={(e) => setModule(e.target.value)} className={inp}>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="章节（如：关键技术）" className={inp} />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="知识点名称（如：口型同步）" className={inp} />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="考纲描述（可选，AI 讲解会参考）" rows={3} className={`${inp} resize-none`} />
        {err && <p className="text-[12px] text-rose-300">{err}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/12 py-2.5 text-sm text-zinc-300">取消</button>
          <button onClick={submit} disabled={busy} className="grad-btn flex-1 rounded-xl py-2.5 text-sm font-semibold text-white">
            {busy ? '保存中…' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}
