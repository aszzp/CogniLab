export type QuestionType = 'single' | 'multi' | 'judge';

export interface Question {
  id: number;
  type: QuestionType;
  module: string;
  stem: string;
  options: string[];
  answer: string; // single/judge: "A"; multi: "ABD"
  explanation: string;
  difficulty: number;
  source: string;
}

export type TaskKind = 'sql' | 'python' | 'essay' | 'chart' | 'flow';

export interface Checkpoint {
  label: string;
  code: string; // python assert 代码
  points: number;
}

export interface Task {
  id: number;
  kind: TaskKind;
  title: string;
  category: string;
  prompt: string;
  points: number;
  source: string;
  meta: {
    // sql
    initSql?: string;
    expectedSql?: string;
    // python
    preload?: string; // csv 内容
    checkpoints?: Checkpoint[];
    // essay
    rubric?: { label: string; points: number; desc: string }[];
    // chart
    dataset?: { columns: string[]; rows: (string | number)[][] };
    target?: Record<string, unknown>;
    // flow
    nodes?: { id: string; kind: 'start' | 'end' | 'action' | 'judge'; label: string; blank?: number }[];
    edges?: [string, string][];
    choices?: string[];
    answers?: string[]; // answers[blankIndex] = choice text
  };
}

export interface ModuleStat {
  module: string;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number;
}
