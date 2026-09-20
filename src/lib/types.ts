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
  code: string; // Trusted authored checking code, not a security sandbox.
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
    initSql?: string;
    expectedSql?: string;
    expectedColumns?: string[];
    expectedRows?: (string | number | null)[][];
    negativeSql?: string;
    rowOrderMatters?: boolean;
    columnOrderMatters?: boolean;
    preload?: string;
    starter?: string;
    referenceCode?: string;
    negativeCode?: string;
    checkpoints?: Checkpoint[];
    referenceAnswer?: string;
    rubric?: { label: string; points: number; desc: string }[];
    dataset?: { columns: string[]; rows: (string | number)[][] };
    target?: Record<string, unknown>;
    expectedCells?: { age: number; type: string; value: number }[];
    nodes?: { id: string; kind: 'start' | 'end' | 'action' | 'judge'; label: string; blank?: number }[];
    edges?: [string, string, string?][];
    choices?: string[];
    answers?: string[];
    content?: {
      key: string;
      topic_keys: string[];
      source_ids: string[];
      review_status: string;
    };
  };
}

export interface ModuleStat {
  module: string;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number;
}
