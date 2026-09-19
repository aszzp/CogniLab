// Syntax/transpilation only. This is deliberately NOT a full Next.js type check/build.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const files = [
  'src/lib/types.ts',
  'src/components/trainers/FlowTrainer.tsx',
  'src/components/trainers/PythonTrainer.tsx',
  'src/app/api/run/sql/route.ts',
];
for (const file of files) {
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, strict: true },
  });
  if (result.diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: x => x, getNewLine: () => '\n',
    }));
    process.exitCode = 1;
  } else console.log(`语法转译通过: ${file}`);
}
console.log('此检查不解析Next/React依赖，不等于完整类型检查、构建或浏览器测试。');
