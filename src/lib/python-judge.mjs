// 函数模板判题内核：每次用例在独立 Python 进程里执行，按测试点比对返回值。
// 被判题 API 与 scripts/finals/check.mjs 共用，保证「校验通过」与「线上判题」走同一条路径。
// 面向可信本地练习，不是隔离沙箱：不要用它执行不可信来源的代码。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// 与全国总决赛模拟赛考前须知一致：单次运行 5 秒、内存 128MB。
export const JUDGE_LIMITS = Object.freeze({ timeMs: 5000, memoryMb: 128, cpuSec: 6 });

const RUNNER = String.raw`
import sys, json, io, ast, time, contextlib, resource

# CPU 时间由内核强制限制；内存上限在 macOS 上无法用 rlimit 设定，改为结束后测量
def limit(cpu_sec):
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec + 2))
    except (ValueError, OSError, AttributeError):
        pass

def maxrss_mb():
    n = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return n / 1048576 if sys.platform == 'darwin' else n / 1024

def main():
    job_path, out_path = sys.argv[1], sys.argv[2]
    base = maxrss_mb()
    job = json.loads(open(job_path, encoding='utf-8').read())
    limit(job['cpuSec'])
    result = {'status': 'RE', 'error': '', 'ret': None, 'stdout': '', 'ms': 0, 'memMb': 0}
    ns = {'__name__': '__main__'}
    try:
        sink = io.StringIO()
        with contextlib.redirect_stdout(sink):
            exec(compile(job['code'], 'submission.py', 'exec'), ns)
        fn = ns.get(job['fn'])
        if not callable(fn):
            raise LookupError('未找到函数 ' + job['fn'] + '()，请保留题目给出的函数名和参数')
        sink = io.StringIO()
        start = time.perf_counter()
        with contextlib.redirect_stdout(sink):
            ret = fn(*job['args'])
        result['ms'] = round((time.perf_counter() - start) * 1000, 1)
        result['stdout'] = sink.getvalue()[:4000]
        # 题目要求用 return 交结果；函数没有返回值时退一步，尝试读取 print 出来的字面量
        if ret is None and sink.getvalue().strip():
            ret = ast.literal_eval(sink.getvalue().strip())
        # JSON 往返：元组归一为列表，NaN 或不可序列化的返回值在这里报错
        result['ret'] = json.loads(json.dumps(ret, ensure_ascii=False, allow_nan=False))
        result['status'] = 'OK'
    except MemoryError:
        result.update(status='MLE', error='内存超限（MemoryError）')
    except RecursionError:
        result.update(status='RE', error='RecursionError：递归过深，请改用迭代或注意数据规模')
    except BaseException as e:
        result['error'] = type(e).__name__ + ': ' + str(e)[:300]
    result['memMb'] = round(max(0.0, maxrss_mb() - base), 1)
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(result, ensure_ascii=False))

main()
`;

const parseStdout = (text) => {
  const s = String(text ?? '').trim();
  if (!s) return undefined;
  try { return JSON.parse(s); } catch { return s; }
};

/** 数值按 1e-9 相对误差比较（吸收浮点噪声，但不放过「保留两位小数」这类格式差异）。 */
export function sameOutput(actual, expected) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) || Number.isNaN(expected)) return false;
    return actual === expected || Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected));
  }
  if (actual === null || expected === null) return actual === expected;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
    return actual.every((v, i) => sameOutput(v, expected[i]));
  }
  if (typeof actual === 'object' && typeof expected === 'object') {
    const a = Object.keys(actual), b = Object.keys(expected);
    return a.length === b.length && a.every((k) => Object.hasOwn(expected, k) && sameOutput(actual[k], expected[k]));
  }
  return actual === expected;
}

function runOne(dir, python, job, limits) {
  return new Promise((resolve) => {
    const jobPath = path.join(dir, `job-${job.index}.json`);
    const outPath = path.join(dir, `out-${job.index}.json`);
    writeFileSync(jobPath, JSON.stringify({ code: job.code, fn: job.fn, args: job.args, cpuSec: limits.cpuSec }), 'utf-8');
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve(r); } };
    let child;
    try {
      // turbopackIgnore：解释器路径是运行期的值，不需要打包器追踪
      child = spawn(/* turbopackIgnore: true */ python, ['-I', '-B', 'runner.py', jobPath, outPath], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LANG: 'en_US.UTF-8' },
      });
    } catch (e) {
      return done({ status: 'SE', error: `无法启动 Python：${e.message}`, ms: 0, memMb: 0 });
    }
    let timedOut = false, stderr = '';
    // spawn 自身不通知超时，墙钟上限由这里的计时器强制结束
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, limits.timeMs);
    const finish = (r) => { clearTimeout(timer); done(r); };
    child.on('error', (e) => finish({ status: 'SE', error: `无法启动 Python：${e.message}`, ms: 0, memMb: 0 }));
    child.stderr?.on('data', (d) => { if (stderr.length < 4000) stderr += d; });
    child.on('close', () => {
      if (timedOut) return finish({ status: 'TLE', error: `运行超时（超过 ${limits.timeMs / 1000} 秒）`, ms: limits.timeMs, memMb: 0 });
      if (existsSync(outPath)) {
        try {
          const r = JSON.parse(readFileSync(outPath, 'utf-8'));
          // 函数既没有 return 也没有 print：按答案错误处理，并留一句提示供练习模式展示
          if (r.status === 'OK' && r.ret === null && !String(r.stdout ?? '').trim()) {
            r.error = '函数没有返回值：请用 return 交出结果';
          }
          return finish({ ...r, ms: r.ms ?? 0, memMb: r.memMb ?? 0 });
        } catch { /* 结果文件损坏按运行错误处理 */ }
      }
      finish({ status: 'RE', error: (stderr.trim() || '进程异常退出，未产生结果').slice(-400), ms: 0, memMb: 0 });
    });
  });
}

function toVerdict(raw, expected, limits) {
  if (raw.status !== 'OK') return raw.status;
  if (raw.memMb > limits.memoryMb) return 'MLE';
  const actual = raw.ret !== null && raw.ret !== undefined ? raw.ret : parseStdout(raw.stdout);
  return sameOutput(actual, expected) ? 'AC' : 'WA';
}

export const VERDICT_LABEL = Object.freeze({
  AC: '通过', WA: '答案错误', TLE: '运行超时', MLE: '内存超限', RE: '运行出错', SE: '判题服务异常',
});

/**
 * 逐测试点判题。cases: [{ args: unknown[], expected: unknown }]
 * 返回每个测试点的结论；summary 取第一个未通过点的类型，与官方平台「不展示逐点得失」的口径兼容。
 */
export async function judgeProblem({ code, fn, cases, limits = JUDGE_LIMITS, python, concurrency = 4 }) {
  const interpreter = python ?? process.env.COGNILAB_PYTHON ?? 'python3';
  const dir = mkdtempSync(path.join(tmpdir(), 'cognilab-judge-'));
  try {
    writeFileSync(path.join(dir, 'runner.py'), RUNNER, 'utf-8');
    const jobs = cases.map((c, index) => ({ index, code: String(code ?? ''), fn, args: c.args }));
    const raws = new Array(jobs.length);
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const i = next++;
        raws[i] = await runOne(dir, interpreter, jobs[i], limits);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
    const results = raws.map((raw, i) => {
      const verdict = toVerdict(raw, cases[i].expected, limits);
      return {
        status: verdict,
        ms: Math.round(raw.ms ?? 0),
        memMb: raw.memMb ?? 0,
        actual: raw.status === 'OK' && raw.ret !== null && raw.ret !== undefined ? raw.ret : undefined,
        stdout: raw.stdout || undefined,
        error: verdict === 'AC' ? undefined : raw.error || undefined,
      };
    });
    const firstBad = results.find((r) => r.status !== 'AC');
    return {
      passed: results.filter((r) => r.status === 'AC').length,
      total: results.length,
      status: firstBad ? firstBad.status : 'AC',
      maxMs: results.reduce((m, r) => Math.max(m, r.ms), 0),
      maxMemMb: results.reduce((m, r) => Math.max(m, r.memMb), 0),
      results,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let cachedVersion;
/** 编辑器页签展示用，如 "3.13.12"；取不到时返回 null。 */
export async function pythonVersion(python) {
  if (cachedVersion !== undefined) return cachedVersion;
  const interpreter = python ?? process.env.COGNILAB_PYTHON ?? 'python3';
  cachedVersion = await new Promise((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ interpreter, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => resolve(null));
    child.on('close', () => resolve(out.trim().split(/\s+/)[1] ?? null));
  });
  return cachedVersion;
}
