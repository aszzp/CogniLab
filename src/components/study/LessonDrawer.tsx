'use client';

import { useEffect, useRef, useState } from 'react';
import { X, BookOpen, Play, RotateCw, Sparkles, Loader2, CircleDot, CheckCircle2, CircleCheckBig } from 'lucide-react';
import Markdown from '../Markdown';
import type { SyllabusItem } from '@/app/study/page';

interface GenQ {
  type: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

const MASTER_ICON = [CircleDot, CheckCircle2, CircleCheckBig];
const MASTER_CLS = ['text-zinc-500', 'text-cyan-300', 'text-emerald-400'];
const MASTER_LABEL = ['未学', '已学', '掌握'];

export default function LessonDrawer({
  topic,
  onMastered,
  onClose,
}: {
  topic: SyllabusItem;
  onMastered: (v: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'lesson' | 'anim' | 'quiz'>('lesson');
  const [content, setContent] = useState('');
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [animHtml, setAnimHtml] = useState('');
  const [animState, setAnimState] = useState<'none' | 'loading' | 'ready'>('none');
  const [playKey, setPlayKey] = useState(0);
  const [quiz, setQuiz] = useState<GenQ[] | null>(null);
  const [quizState, setQuizState] = useState<'none' | 'loading' | 'saved'>('none');
  const started = useRef(false);

  // 打开时：取缓存或流式生成讲解；取动画缓存
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const cache = await (await fetch(`/api/study/lesson?topicId=${topic.id}`)).json();
        if (cache.animHtml) {
          setAnimHtml(cache.animHtml);
          setAnimState('ready');
        }
        if (cache.content) {
          setContent(cache.content);
          return;
        }
      } catch { /* ignore */ }
      setLoadingLesson(true);
      try {
        const res = await fetch('/api/study/lesson', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId: topic.id }),
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setContent((t) => t + dec.decode(value, { stream: true }));
        }
      } catch {
        setContent('⚠️ 讲解生成失败，请重试');
      } finally {
        setLoadingLesson(false);
      }
    })();
  }, [topic.id]);

  async function genAnim() {
    setAnimState('loading');
    try {
      const res = await fetch('/api/study/anim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id }),
      });
      const data = await res.json();
      if (data.html) {
        setAnimHtml(data.html);
        setAnimState('ready');
        setPlayKey((k) => k + 1);
      } else {
        setAnimState('none');
        alert(data.error || '动画生成失败');
      }
    } catch {
      setAnimState('none');
      alert('动画生成失败');
    }
  }

  async function genQuiz() {
    setQuizState('loading');
    setQuiz(null);
    try {
      const res = await fetch('/api/study/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: [topic.id], count: 3 }),
      });
      const data = await res.json();
      if (data.questions) setQuiz(data.questions);
      else alert(data.error || '生成失败');
    } finally {
      setQuizState('none');
    }
  }

  async function saveQuiz() {
    if (!quiz) return;
    setQuizState('loading');
    await fetch('/api/study/quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save: true, questions: quiz }),
    });
    setQuizState('saved');
  }

  const MIcon = MASTER_ICON[topic.mastered];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[86dvh] overflow-y-auto rounded-t-3xl border-t border-white/12 bg-[#0b0b13]/98 md:mx-auto md:w-[560px] md:rounded-3xl md:border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 z-10 border-b border-white/8 bg-[#0b0b13]/95 px-4 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-300">{topic.module}</span>
                {topic.level && (
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    topic.level === '三级' ? 'bg-violet-400/20 text-violet-200' :
                    topic.level === '二级' ? 'bg-cyan-400/15 text-cyan-300' :
                    topic.level === '一级' ? 'bg-rose-400/15 text-rose-300' :
                    topic.level === '五级四级' ? 'bg-sky-400/15 text-sky-300' :
                    topic.level === '工种' ? 'bg-fuchsia-400/15 text-fuchsia-300' :
                    'bg-amber-400/15 text-amber-300'
                  }`}>{topic.level}</span>
                )}
                {topic.ref && <span className="text-zinc-600">标准 {topic.ref}</span>}
              </div>
              <h2 className="text-[16.5px] font-bold">{topic.topic}</h2>
            </div>
            <button onClick={() => onMastered((topic.mastered + 1) % 3)}
              title={`掌握状态：${MASTER_LABEL[topic.mastered]}（点击切换）`}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 px-2.5 py-1.5">
              <MIcon size={16} className={MASTER_CLS[topic.mastered]} />
              <span className="text-[9px] text-zinc-500">{MASTER_LABEL[topic.mastered]}</span>
            </button>
            <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:text-white"><X size={18} /></button>
          </div>
          {/* Tab */}
          <div className="mt-3 flex rounded-xl bg-white/[0.04] p-1">
            {([['lesson', '图文讲解', BookOpen], ['anim', '动画演示', Play], ['quiz', '模拟题', Sparkles]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-medium transition-colors ${
                  tab === v ? 'bg-gradient-to-r from-violet-500/35 to-cyan-500/30 text-white' : 'text-zinc-500'
                }`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'lesson' && (
            <div>
              {topic.detail && (
                <p className="mb-3 rounded-xl bg-white/[0.03] p-3 text-[12px] leading-relaxed text-zinc-400">
                  考纲：{topic.detail}
                </p>
              )}
              {content ? <Markdown>{content}</Markdown> : (
                <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-zinc-500">
                  <Loader2 size={15} className="animate-spin text-violet-300" /> 坤哥讲师备课中…
                </div>
              )}
              {loadingLesson && content && <span className="pulse-soft text-violet-300">▍</span>}
            </div>
          )}

          {tab === 'anim' && (
            <div>
              {animState === 'ready' ? (
                <div className="space-y-2">
                  <div className="h-72 overflow-hidden rounded-2xl border border-white/10">
                    <iframe
                      key={playKey}
                      srcDoc={animHtml}
                      sandbox="allow-scripts"
                      title="知识点动画演示"
                      className="h-full w-full border-0"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPlayKey((k) => k + 1)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 py-2.5 text-[12.5px] text-zinc-300">
                      <RotateCw size={13} /> 重播
                    </button>
                    <button onClick={genAnim}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 py-2.5 text-[12.5px] text-zinc-300">
                      <Sparkles size={13} /> 重新生成
                    </button>
                  </div>
                </div>
              ) : animState === 'loading' ? (
                <div className="flex flex-col items-center gap-2 py-16 text-[13px] text-zinc-500">
                  <Loader2 size={20} className="animate-spin text-violet-300" />
                  坤哥正在编排动画（约 10~30 秒）…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-14">
                  <p className="text-[13px] text-zinc-400">让 AI 把「{topic.topic}」做成一段可视化动画</p>
                  <button onClick={genAnim} className="grad-btn flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white">
                    <Play size={14} /> 生成动画演示
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'quiz' && (
            <div>
              {!quiz && quizState !== 'loading' && (
                <div className="flex flex-col items-center gap-3 py-14">
                  <p className="text-[13px] text-zinc-400">针对本知识点生成 3 道模拟题</p>
                  <button onClick={genQuiz} className="grad-btn flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white">
                    <Sparkles size={14} /> 生成模拟题
                  </button>
                </div>
              )}
              {quizState === 'loading' && (
                <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-zinc-500">
                  <Loader2 size={16} className="animate-spin text-violet-300" /> 命题中…
                </div>
              )}
              {quiz && (
                <div className="space-y-2.5">
                  {quiz.map((q, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] p-3 text-[12.5px]">
                      <p className="text-zinc-200">
                        <span className="mr-1 rounded bg-white/10 px-1 text-[10px] text-zinc-400">{q.type === 'judge' ? '判断' : '单选'}</span>
                        {q.stem}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                        {q.options.slice(0, 4).map((o, j) => `${'ABCD'[j]}. ${o.slice(0, 24)}`).join('  ·  ')}
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-300/80">答案 {q.answer} · {q.explanation}</p>
                    </div>
                  ))}
                  {quizState === 'saved' ? (
                    <p className="text-center text-[12.5px] text-emerald-300">✓ 已入库 {quiz.length} 题，去「刷题」模块使用</p>
                  ) : (
                    <button onClick={saveQuiz} disabled={quizState === 'loading'}
                      className="w-full rounded-xl bg-emerald-500 py-2.5 text-[13px] font-semibold text-white active:scale-[0.98]">
                      {quizState === 'loading' ? '入库中…' : `确认入库（${quiz.length} 题）`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
