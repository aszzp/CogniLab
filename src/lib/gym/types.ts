/** 「实操道场」内容与训练数据的共享类型。 */

export type GymKind = 'pattern' | 'idiom';
export type GymLevel = 1 | 2 | 3;
export type GymTrapTag = 'tie' | 'boundary' | 'order' | 'empty' | 'precision' | 'shape';

export const TRAP_LABEL: Record<GymTrapTag, string> = {
  tie: '并列裁决',
  boundary: '等号边界',
  order: '顺序/稳定',
  empty: '空值与零除',
  precision: '数值/类型/精度',
  shape: '输出结构',
};

export interface GymTrap {
  title: string;
  wrong: string;
  right: string;
}

export interface GymSection {
  title: string;
  body: string[];
  code?: string;
  note?: string;
}

export interface GymFormula {
  label: string;
  code: string;
}

/** 惯用法卡片的「一步一变换」演示数据。 */
export interface GymDemo {
  inputLabel: string;
  input: string;
  steps: { label: string; value: string }[];
  output: string;
}

export interface GymDrillBase {
  id: string;
  prompt: string;
  explain: string;
  trap?: GymTrapTag;
}

export interface GymMcq extends GymDrillBase {
  type: 'mcq';
  code?: string;
  options: string[];
  answer: number;
}

export interface GymBlank {
  /** 允许的写法，比较时会去掉空白并统一引号；第一条用于展示。 */
  answers: string[];
  hint?: string;
  width?: number;
}

export interface GymFill extends GymDrillBase {
  type: 'fill';
  /** 用 ___ 表示空位，数量必须与 blanks 一致。 */
  code: string;
  blanks: GymBlank[];
}

export interface GymCode extends GymDrillBase {
  type: 'code';
  /** 题面要求的函数名，提交的代码必须定义它。 */
  fn: string;
  /** 用 ___ 表示空位；补全后的代码直接交给判题内核执行。 */
  starter: string;
  blanks: GymBlank[];
  cases: { args: unknown[]; expected: unknown }[];
}

export type GymDrill = GymMcq | GymFill | GymCode;

export interface GymItem {
  key: string;
  kind: GymKind;
  order: number;
  title: string;
  subtitle: string;
  theme?: string;
  minutes: number;
  level: GymLevel;
  tags: string[];
  summary: string;
  sections: GymSection[];
  formula?: GymFormula;
  skeleton?: string;
  traps?: GymTrap[];
  /** 可视化组件键；在 VisualPlayer 里映射到具体实现。 */
  visual: string;
  /** 惯用法卡片的数据变换演示。 */
  demo?: GymDemo;
  drills: GymDrill[];
}

/** 客户端展示用的进度快照。 */
export interface GymProgress {
  itemKey: string;
  mastery: number; // 0–5
  streak: number;
  seen: number;
  correct: number;
  lastResult: 'correct' | 'wrong' | null;
  nextReviewAt: string | null;
  updatedAt: string | null;
}

export interface GymAttemptInput {
  itemKey: string;
  drillId: string;
  type: GymDrill['type'];
  correct: boolean;
  latencyMs: number;
  trap?: GymTrapTag;
}
