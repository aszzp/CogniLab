import { NextResponse } from 'next/server';
import { qAll } from '@/lib/db';
import { chat, extractJsonArray, type ChatMessage, type ToolDef } from '@/lib/ai';
import { moduleStats, totalAttempts, overallAccuracy, streakDays, dueCount } from '@/lib/stats';
import { dueReview } from '@/lib/quiz';
import { insertQuestions, type GenQ } from '@/lib/quizgen';

interface Trace {
  name: string;
  args: string;
  summary: string;
}

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_practice_stats',
      description: '获取用户练习统计：各模块题量/正确率/掌握进度、累计答题、总正确率、连续练习天数、到期错题数',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wrong_questions',
      description: '获取用户最近做错的题目列表（题干、模块、正确答案）',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: '返回条数，默认10' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_syllabus',
      description: '获取考纲知识点清单（模块/章节/知识点/级别/掌握状态），模块可选：职业道德与基础知识/数据处理与标注/业务分析/智能训练/智能系统设计/培训与指导/数字人专项',
      parameters: {
        type: 'object',
        properties: { module: { type: 'string', description: '模块名' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_questions',
      description: '按关键词搜索题库中的题目',
      parameters: {
        type: 'object',
        properties: { keyword: { type: 'string' }, limit: { type: 'number' } },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_questions',
      description: '为指定模块或知识点描述生成新的练习题。save=true 直接入库，false 仅预览',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: '模块名或知识点描述' },
          count: { type: 'number', description: '题目数量，默认5' },
          save: { type: 'boolean', description: '是否直接入库，默认false' },
        },
        required: ['topic'],
      },
    },
  },
];

function runTool(name: string, args: Record<string, unknown>): { result: string; summary: string } {
  switch (name) {
    case 'get_practice_stats': {
      const stats = moduleStats();
      const data = {
        累计答题: totalAttempts(),
        总体正确率: `${overallAccuracy()}%`,
        连续练习: `${streakDays()} 天`,
        到期错题: dueCount(),
        模块: stats.map((s) => ({ 模块: s.module, 题量: s.total, 已练: s.attempted, 正确率: `${s.accuracy}%` })),
      };
      return { result: JSON.stringify(data), summary: '查询练习统计' };
    }
    case 'get_wrong_questions': {
      const limit = Math.min(Number(args.limit) || 10, 30);
      const rows = qAll<{ stem: string; module: string; answer: string }>(
        `SELECT q.stem, q.module, q.answer FROM attempts a JOIN questions q ON q.id = a.question_id
         WHERE a.is_correct = 0 AND a.id IN (SELECT MAX(id) FROM attempts GROUP BY question_id)
         ORDER BY a.id DESC LIMIT ?`, limit,
      );
      const due = dueReview(50).length;
      return {
        result: JSON.stringify(rows.map((r) => ({ 题干: r.stem.slice(0, 80), 模块: r.module, 正确答案: r.answer }))),
        summary: `查询错题 ${rows.length} 条（复习队列共 ${due} 题到期）`,
      };
    }
    case 'get_syllabus': {
      const mod = args.module as string | undefined;
      const rows = qAll<{ module: string; section: string; topic: string; mastered: number; level: string }>(
        mod
          ? 'SELECT module, section, topic, mastered, level FROM syllabus WHERE module = ? ORDER BY sort'
          : 'SELECT module, section, topic, mastered, level FROM syllabus ORDER BY module, sort',
        ...(mod ? [mod] : []),
      );
      return {
        result: JSON.stringify(rows.map((r) => ({ 模块: r.module, 章节: r.section, 知识点: r.topic, 级别: r.level || '三级', 掌握: ['未学', '已学', '掌握'][r.mastered] }))),
        summary: `查询考纲${mod ? `（${mod}）` : ''} ${rows.length} 个知识点`,
      };
    }
    case 'search_questions': {
      const kw = String(args.keyword ?? '').slice(0, 50);
      const rows = qAll<{ stem: string; module: string; answer: string; source: string }>(
        `SELECT stem, module, answer, source FROM questions WHERE stem LIKE ? ORDER BY RANDOM() LIMIT ?`,
        `%${kw}%`, Math.min(Number(args.limit) || 8, 20),
      );
      return {
        result: JSON.stringify(rows.map((r) => ({ 题干: r.stem.slice(0, 90), 模块: r.module, 答案: r.answer, 来源: r.source }))),
        summary: `搜索"${kw}"命中 ${rows.length} 题`,
      };
    }
    case 'generate_questions': {
      return { result: 'ASYNC', summary: '生成练习题（异步执行）' };
    }
    default:
      return { result: JSON.stringify({ error: 'unknown tool' }), summary: `未知工具 ${name}` };
  }
}

async function generateQuestions(topic: string, count: number, save: boolean): Promise<{ result: string; summary: string }> {
  const n = Math.min(Math.max(count || 5, 1), 10);
  const sys =
    '你是"人工智能数字人训练师"赛项命题专家，对标三级/高级工难度。只输出 JSON 数组：' +
    '[{"type":"single或judge","stem":"题干","options":[...4项]，judge题options为["正确","错误"],"answer":"字母","explanation":"一句话解析","module":"知识点所属模块"}]';
  try {
    const { content } = await chat(
      [
        { role: 'system', content: sys },
        { role: 'user', content: `围绕「${topic}」出 ${n} 道题（single 与 judge 搭配），并标注每题所属模块（职业道德/数字人/业务分析/智能训练/系统设计）。` },
      ],
      { purpose: 'quiz', maxTokens: 3000 },
    );
    const list = extractJsonArray<GenQ>(content)?.filter((q) => q.stem && q.options && q.answer) ?? [];
    if (!list.length) return { result: JSON.stringify({ error: '生成失败' }), summary: '生成失败' };
    if (save) {
      const saved = insertQuestions(list, '数字人');
      return { result: JSON.stringify({ saved, questions: list }), summary: `已生成并入库 ${saved} 题` };
    }
    return { result: JSON.stringify({ questions: list }), summary: `已生成 ${list.length} 题（预览，未入库）` };
  } catch (e) {
    return { result: JSON.stringify({ error: String(e) }), summary: '生成失败' };
  }
}

export async function POST(req: Request) {
  const { messages, page } = await req.json();
  const history = (messages ?? []).slice(-16) as ChatMessage[];

  const system =
    '你是"坤哥"，CogniLab 数字人训练师备赛系统的 AI 学习管家。用户正在备战 2026 年 10 月中旬的省级选拔赛' +
    '（理论30%+实操70%，依据《人工智能训练师国家职业技能标准（2021年版）》三级命题，题型：单选45题+实操5模块）。\n' +
    '风格：亲切、接地气、称呼用户"兄弟"或"同学"，适度幽默，但信息密度高、直击考点；回复用短段落和列表，默认不超过300字，用户追问再展开。\n' +
    '能力：你可调用工具查询用户的练习统计、错题、考纲、题库，也能生成练习题。用户可能带着页面引用来提问，优先围绕引用内容作答。' +
    '给学习建议时具体到模块和知识点，善用你查到的数据（如正确率、到期错题数）。不要编造未查到的数据。';

  const pageNote = page?.text
    ? `\n【当前页面】${page.route ?? ''} · ${page.title ?? ''}\n页面内容摘要：${String(page.text).slice(0, 1200)}`
    : '';

  const convo: ChatMessage[] = [
    { role: 'system', content: system + pageNote },
    ...history.map((m) => ({ role: m.role, content: m.content ?? '' })),
  ];

  const trace: Trace[] = [];
  try {
    for (let round = 0; round < 5; round++) {
      const { content, toolCalls } = await chat(convo, { purpose: 'kun', maxTokens: 1600, temperature: 0.6, tools: TOOLS });
      if (!toolCalls?.length) {
        return NextResponse.json({ content, trace });
      }
      convo.push({ role: 'assistant', content: content ?? '', tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
        let out = runTool(tc.function.name, args);
        if (out.result === 'ASYNC') {
          out = await generateQuestions(String(args.topic ?? ''), Number(args.count) || 5, args.save === true);
        }
        trace.push({ name: tc.function.name, args: tc.function.arguments, summary: out.summary });
        convo.push({ role: 'tool', content: out.result.slice(0, 4000), tool_call_id: tc.id });
      }
    }
    // 工具轮次耗尽，强制收尾
    const { content } = await chat(convo, { purpose: 'kun', maxTokens: 1600 });
    return NextResponse.json({ content, trace });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
