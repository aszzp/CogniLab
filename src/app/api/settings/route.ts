import { NextResponse } from 'next/server';
import { getAIConfig, saveAIConfig, DEFAULT_CONFIG, type AIConfig } from '@/lib/config';

export async function GET() {
  const cfg = getAIConfig();
  // key 打掩码返回
  const masked = JSON.parse(JSON.stringify(cfg)) as AIConfig;
  for (const p of Object.values(masked.providers)) {
    if (p.apiKey && p.apiKey.length > 8) {
      p.apiKey = p.apiKey.slice(0, 6) + '••••••••' + p.apiKey.slice(-4);
    }
  }
  return NextResponse.json(masked);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as AIConfig;
  if (!body?.providers || !body?.assign) {
    return NextResponse.json({ error: '配置格式错误' }, { status: 400 });
  }
  // 掩码 key 表示未修改，回填当前真实值
  const current = getAIConfig();
  for (const [pid, p] of Object.entries(body.providers)) {
    if (p.apiKey.includes('••') && current.providers[pid]) {
      p.apiKey = current.providers[pid].apiKey;
    }
    if (!p.apiKey) p.apiKey = current.providers[pid]?.apiKey ?? DEFAULT_CONFIG.providers[pid]?.apiKey ?? '';
  }
  saveAIConfig(body);
  return NextResponse.json({ ok: true });
}
