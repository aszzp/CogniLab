import { qGet, qRun } from './db';

export type Purpose = 'explain' | 'grade' | 'quiz' | 'anim' | 'kun';
export type ThinkingMode = 'on' | 'off';

export interface ProviderConf {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  thinkingStyle: 'dashscope' | 'zhipu';
}

export interface AIConfig {
  providers: Record<string, ProviderConf>;
  assign: Record<Purpose, string>; // "provider:model"
  thinking: ThinkingMode;
}

export const DEFAULT_CONFIG: AIConfig = {
  providers: {
    dashscope: {
      name: '阿里云 Coding Plan',
      baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://coding.dashscope.aliyuncs.com/v1',
      apiKey: process.env.DASHSCOPE_API_KEY || '',
      models: ['qwen3.7-plus', 'qwen3.6-plus', 'qwen3.5-plus', 'qwen3-max-2026-01-23', 'qwen3-coder-plus', 'qwen3-coder-next'],
      thinkingStyle: 'dashscope',
    },
    zhipu: {
      name: '智谱 ZCode',
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      apiKey: '04d61e9202fa4d3ea1c814388b610998.IYArMuZwspLM7Ayy',
      models: ['glm-5.3', 'glm-5.3-flash'],
      thinkingStyle: 'zhipu',
    },
  },
  assign: {
    explain: 'dashscope:qwen3.7-plus',
    grade: 'dashscope:qwen3.7-plus',
    quiz: 'dashscope:qwen3.7-plus',
    anim: 'dashscope:qwen3.7-plus',
    kun: 'dashscope:qwen3.7-plus',
  },
  thinking: 'on',
};

const KEY = 'ai_config';

export function getAIConfig(): AIConfig {
  const row = qGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', KEY);
  if (!row) return DEFAULT_CONFIG;
  try {
    const saved = JSON.parse(row.value) as Partial<AIConfig>;
    return {
      providers: saved.providers ?? DEFAULT_CONFIG.providers,
      assign: { ...DEFAULT_CONFIG.assign, ...(saved.assign ?? {}) },
      thinking: saved.thinking ?? 'on',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAIConfig(cfg: AIConfig): void {
  qRun(
    `INSERT INTO settings (key, value, updated_at) VALUES (?,?, datetime('now','localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    KEY, JSON.stringify(cfg),
  );
}

/** 解析某用途实际使用的模型配置 */
export function resolveModel(purpose: Purpose) {
  const cfg = getAIConfig();
  const [pid, model] = (cfg.assign[purpose] || 'dashscope:qwen3.7-plus').split(':');
  const provider = cfg.providers[pid] ?? Object.values(cfg.providers)[0];
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: model || provider.models[0],
    providerId: pid,
    thinkingStyle: provider.thinkingStyle,
    thinking: cfg.thinking,
    modelName: `${provider.name} · ${model || provider.models[0]}`,
  };
}
