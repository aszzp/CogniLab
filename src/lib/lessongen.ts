/** 讲解文案生成：prompt 构建与非流式生成（供流式路由与预生成任务共用） */

export interface TopicRow {
  module: string;
  section: string;
  topic: string;
  detail: string;
  level: string;
  ref: string;
}

const LEVEL_DESC: Record<string, string> = {
  基础: '基本要求（各级别通用）',
  五级四级: '五级/初级工、四级/中级工职业功能（高级别涵盖低级别要求）',
  三级: '三级/高级工职业功能（本次赛项核心命题层级）',
  二级: '二级/技师职业功能（"三级及以上"命题范围）',
  一级: '一级/高级技师职业功能（"三级及以上"命题范围）',
  工种: '数字人训练师工种特色知识',
};

export function lessonMessages(t: TopicRow): { system: string; user: string } {
  const system =
    '你是"人工智能数字人训练师"赛项的金牌讲师，正在给备赛学员讲解考纲知识点。' +
    '请输出结构化的图文讲解：先用一句话定义，再分 2-4 个小节展开（用 ### 小标题），' +
    '包含：原理/概念、标准原文要求（严格依据给定的标准条款，说明该知识点在对应级别应具备的能力）、' +
    '考试怎么考（常见题型与出题角度）、与相近知识点的对比辨析、记忆要点。' +
    '适当使用 **加粗**、列表和表格。总长度 400~600 字，纯中文，不要输出考纲以外的闲聊。';
  const user = [
    `【所属模块】${t.module}`,
    `【所属章节】${t.section}`,
    `【知识点】${t.topic}`,
    `【级别】${t.level ? LEVEL_DESC[t.level] ?? t.level : '三级/高级工'}`,
    `【标准依据】《人工智能训练师国家职业技能标准（2021年版）》${t.ref ? `条款 ${t.ref}` : '三级/高级工及以上'}`,
    `【考纲描述】${t.detail || '（无，请按知识点名称合理展开）'}`,
    '命题依据：《人工智能训练师国家职业技能标准（2021年版）》三级/高级工及以上。',
  ].join('\n');
  return { system, user };
}
