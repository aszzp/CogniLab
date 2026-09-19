import { resolveModel, type Purpose } from './config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatOptions {
  purpose?: Purpose;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDef[];
  signal?: AbortSignal;
}

function thinkingBody(style: 'dashscope' | 'zhipu', on: boolean): Record<string, unknown> {
  if (style === 'zhipu') return { thinking: { type: on ? 'enabled' : 'disabled' } };
  return { enable_thinking: on };
}

async function call(messages: ChatMessage[], opts: ChatOptions, stream: boolean): Promise<Response> {
  const cfg = resolveModel(opts.purpose ?? 'explain');
  if (!cfg.apiKey) throw new Error('模型 API Key 未配置（我的 → 模型配置）');
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    stream,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.4,
    ...thinkingBody(cfg.thinkingStyle, cfg.thinking === 'on'),
  };
  if (opts.tools?.length) body.tools = opts.tools;

  let res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  // 部分模型不支持思考开关或 tools 参数：去掉可选参数重试一次
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    const lite = { ...body };
    delete lite.enable_thinking;
    delete lite.thinking;
    if (opts.tools) delete lite.tools;
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lite),
      signal: opts.signal,
    });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`模型请求失败 ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

/** 非流式：返回 {content, toolCalls, raw} */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<{ content: string; toolCalls: ChatMessage['tool_calls']; raw: ChatMessage }> {
  const res = await call(messages, opts, false);
  const data = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ChatMessage['tool_calls'] } }[];
  };
  const m = data.choices?.[0]?.message ?? { content: '' };
  return { content: m.content ?? '', toolCalls: m.tool_calls, raw: m as ChatMessage };
}

/** 流式：把 SSE 转为纯文本 ReadableStream（仅用于无工具调用的场景） */
export async function chatStream(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ReadableStream<Uint8Array>> {
  const res = await call(messages, { ...opts, tools: undefined }, true);
  const upstream = res.body!;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = '';
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch { /* 忽略半包 */ }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

/** 从模型输出中稳健提取 JSON */
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, '');
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as T;
  } catch {
    return null;
  }
}

export function extractJsonArray<T>(text: string): T[] | null {
  const cleaned = text.replace(/```json|```/g, '');
  const s = cleaned.indexOf('[');
  const e = cleaned.lastIndexOf(']');
  if (s === -1 || e <= s) return null;
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as T[];
  } catch {
    return null;
  }
}
