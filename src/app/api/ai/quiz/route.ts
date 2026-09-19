import { NextResponse } from 'next/server';
import { qRun } from '@/lib/db';
import { chat, extractJson } from '@/lib/ai';

interface GenQ {
  type: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
}

const SCOPE: Record<string, string> = {
  职业道德与基础知识: '职业守则（诚实公正严谨求是/遵章守法恪尽职守/勤勉好学追求卓越）、劳动法/劳动合同法/网络安全法/知识产权法、数据安全与隐私、职业编码4-04-05-05与工种、五级等级体系与高级涵盖低级、鉴定方式（百分制60分合格、理论90min技能120min）、申报条件、培训学时、三级理论权重（职道5+基础10+业务分析20+智能训练30+系统设计30+培训5）',
  数据处理与标注: '原始业务数据采集（设备工具/数据库内采集）、数据整理归类汇总、预处理后数据质量检测、采集处理规范梳理、数据清洗（dropna/drop_duplicates、高质量目的）、文本清洗标注（分词、句法判别）、视觉清洗标注（点阵存储、损坏图像去除）、语音清洗标注、标注后分类统计、标注类型（实体/关系/属性/情感/词性/类别，订单提取属实体标注）、中文分词质量标准、数据聚类归类定义、标注数据审核纠错、智能系统基础操作与维护记录',
  业务分析: '三级：设计业务数据采集/处理/审核三流程（结合AI技术要求和业务特征）、识别单一模块问题、设计优化方案；特征工程、协同过滤、最优化决策、远程智能诊疗（电子病历）、流程优化（步骤活动决策点、智能系统改造法）、SQL（SELECT/AS/WHERE IN/BETWEEN）、BI维度与指标；二级：业务框架构建、智能应用机会点挖掘、新场景解决方法；一级：业务分析框架、前瞻性规划、流程重构创新',
  智能训练: '三级：设计清洗标注流程、制定清洗标注规范、维护训练集测试集、工具训练算法、测试工具测试AI产品、测试结果分析与报告、错误案例分析与纠正；pandas（read_csv/head/describe/dropna）、sklearn（train_test_split/reshape/LogisticRegression/score/predict）、分类评价指标（准确率/精确率/召回率）、Keras（evaluate返回损失与准确率、compile的loss）；二级：高质量训练集（核心竞争力）、黄金测试集（上线质量保障）、测试方案设计、训练参数调优；一级：能力矩阵、训练集测试集标准、复杂系统完整测试',
  智能系统设计: '三级：数据全面分析与报告、优化需求、智能解决方案、BI图表配置（热力图/维度指标聚合/过滤）、人机交互最优方式、视觉交互辨析（手势/表情/姿态识别，不含情感识别）、流程图判定节点、数据准备是AI开发特有环节、硬件产品设计（工业/结构/硬件）、AI在线开发平台（EasyDL/华为云/阿里云）；二级：多智能产品解决方案、全链路智能应用、功能需求转化、项目管理；一级：复杂跨领域方案、方法论沉淀平台化',
  培训与指导: '三级：编写初级培训讲义、对五级四级开展培训、指导解决数据采集处理与数据标注问题；二级：编写培训计划、对三级及以下培训、业务指导方案、效果评估；一级：培训体系规划、管理方法培训、业务指导策略体系；三级理论权重占5%',
  数字人专项: '数字人聚焦外观/音色/行为设计与多模态交互、2024年7月增设工种、Prompt人设框架、垂直领域知识库与幻觉率、金牌导购式预判、口型同步（视觉捕捉与面部动作映射）、TTS/ASR/NLP辨析、VAD情感维度（愉悦度/激活度/支配度）、一张照片生成数字人（讯飞）、多模态联动、体感交互、AI短视频制作流程（脚本→角色→剪辑）、本地化适配（方言/本地新闻/民俗）、直播交互（应答/引导/情绪适配）、金融幻觉治理',
};

export async function POST(req: Request) {
  const { module, save, questions } = await req.json();

  if (save) {
    const list = questions as GenQ[];
    if (!Array.isArray(list) || !list.length) {
      return NextResponse.json({ error: '无题目可入库' }, { status: 400 });
    }
    let n = 0;
    for (const q of list) {
      if (!q.stem || !Array.isArray(q.options) || !q.answer) continue;
      qRun(
        'INSERT INTO questions (type, module, stem, options, answer, explanation, difficulty, source) VALUES (?,?,?,?,?,?,?,?)',
        q.type === 'judge' ? 'judge' : 'single', module, String(q.stem).slice(0, 500),
        JSON.stringify(q.options.slice(0, 6)), String(q.answer).slice(0, 6),
        String(q.explanation ?? '').slice(0, 500), 2, 'AI 生成',
      );
      n++;
    }
    return NextResponse.json({ saved: n });
  }

  const system =
    '你是"人工智能数字人训练师"赛项的命题专家，严格对标《人工智能训练师国家职业技能标准（2021年版）》三级/高级工难度。' +
    '只输出一个 JSON 数组，不要任何其他文字。每题格式：' +
    '{"type":"single或judge","stem":"题干","options":["A选项","B选项","C选项","D选项"],"answer":"正确选项字母，judge题为A或B","explanation":"一句话解析"}' +
    'judge 题的 options 固定为 ["正确","错误"]。题目必须考察真实知识点，干扰项要有迷惑性，不要出与题干重复或答案明显的题。';

  const user = `请围绕模块【${module}】出 5 道新题（3道single+2道judge）。知识点范围：${SCOPE[module] ?? ''}`;

  try {
    const { content: raw } = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { purpose: 'quiz', maxTokens: 2400 },
    );
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('[');
    const e = cleaned.lastIndexOf(']');
    if (s === -1 || e <= s) return NextResponse.json({ error: '生成解析失败，请重试' }, { status: 502 });
    const list = JSON.parse(cleaned.slice(s, e + 1)) as GenQ[];
    const valid = list.filter((q) => q.stem && Array.isArray(q.options) && q.answer);
    if (!valid.length) return NextResponse.json({ error: '生成题目无效，请重试' }, { status: 502 });
    return NextResponse.json({ questions: valid });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
