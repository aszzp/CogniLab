#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { loadContent, readExpansion } from './lib/content.mjs';
import { validateContent } from './lib/validate-content.mjs';

try {
  const args = process.argv.slice(2);
  for (const a of args) if (a.startsWith('--') && !['--expansion-only', '--report'].includes(a)) throw new Error(`未知参数${a}`);
  const content = args.includes('--expansion-only') ? readExpansion() : loadContent();
  const result = validateContent(content);
  const i = args.indexOf('--report');
  if (i >= 0) {
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--report 后需给出文件路径');
    writeFileSync(args[i + 1], JSON.stringify(result, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(`内容校验失败: ${error.message}`); process.exitCode = 1;
}
