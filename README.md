# CogniLab · 数字人训练师备赛训练系统

AI 原生的「人工智能数字人训练师」赛项（2026 全国行业职业技能竞赛）备赛系统。移动端优先，适配碎片化时间刷题。

## 快速启动

```bash
npm install
npm run seed     # 灌入题库：官方样题 45 题 + 大纲手写 40 题 + 7 个实操任务
npm run build
npm run start    # http://localhost:3000
# 开发模式：npm run dev
```

- AI 引擎：阿里云 DashScope（`.env.local` 中配置 `DASHSCOPE_API_KEY` / `AI_MODEL=qwen3.7-plus`）
- 数据：本地 SQLite（`data/cognilab.db`，作答记录/错题复习队列/考试成绩，重跑 seed 只重建题库）
- 手机使用：局域网内访问 `http://<电脑IP>:3000`（可用 `npm run dev -- -H 0.0.0.0`），或「添加到主屏幕」作为 PWA 使用
- 编程题判题：需要本机有 `python3`（默认 `python3`，可用环境变量 `COGNILAB_PYTHON` 指定解释器），卷面数据已随仓库提供，不需要 seed

## 决赛模拟

按全国总决赛形式出的 5 套模拟卷（`/finals`）：每套单选 50 题 × 0.6 分 + 编程 7 题 × 10 分，180 分钟。全真模式切屏 3 次自动交卷、到时自动交卷；练习模式不限时、可看运行错误。交卷后有逐模块得分、逐测试点结论、解析和参考代码，编程题还能在 `/finals/code` 单题专项练习。

```bash
python3 scripts/finals/build.py          # 由源文件生成卷面 data/finals/sets/
python3 scripts/finals/build.py --check  # 检查生成物与源文件一致（参考解、独立实现、差分测试、错解区分度）
node scripts/finals/check.mjs            # 体检：一致性、卷面结构、线上判题内核实跑
python3 scripts/finals/doc-tables.py     # 把五套卷的题目回填进命题分析文档里的表格
```

改题或改判题逻辑之后，还有两件可选的事：`node scripts/finals/e2e.mjs <服务地址> <仓库根目录>` 把开考、草稿、判题、切屏、超时、交卷整个流程走一遍（它会写作答记录并改数据库，只对着一份临时副本跑）；`python3 scripts/finals/blind-sheet.py make <输出目录>` 把理论题拆成不含答案的答卷，交给别人盲答后再用 `compare` 比对，核对答案有没有歧义。

命题依据、蓝图与五套卷的考点分布见 `docs/05-决赛命题分析与模拟卷设计.md`。

## 实操道场

`/gym`：把决赛 51–57 题拆成 7 张「决策卡」，另配 10 个函数惯用法，共 67 道练习。每张卡按「看懂 → 走图 → 练习 → 冲刺」组织：关键路径卡有可调耗时的实验台（ES/EF、LS/LF、slack、甘特图和关键路径切换），其余卡片保留分幕可视化；练习支持单选、填空、代码填空与 AI 教练点评；代码冲刺从零写函数、计时、每轮随机抽 3 个用例、连续 AC 5 轮。进度按连续答对次数记掌握度（0–5），并按 10 分钟 → 1 天 → 3 天 → 7 天 → 14 天安排复习；「今日速练」按到期和薄弱程度混合出 10 题。

```bash
node scripts/gym/check.mjs               # 内容体检：结构、空位、参考解实跑
node scripts/gym/check.mjs --skip-judge  # 只做结构校验
```

内容源在 `src/lib/gym/items/*.ts`，新增卡片后跑一次体检；代码题由 `judgeProblem` 在独立进程里按 5 秒 / 128MB 判分。

## 功能

| 模块 | 说明 |
|---|---|
| 首页仪表盘 | 考试倒计时（10-15，可在 `src/lib/stats.ts` 调整）、连续天数、五模块掌握度、近 7 日活跃 |
| 考纲学习 | 68 个考纲知识点（五模块→章节→知识点）：知识图谱导航、清单编辑、掌握状态；AI 图文讲解（流式+缓存）、AI 脚本动画（沙箱 iframe 渲染）、按知识点/批量生成模拟题 |
| 碎片速刷 | 一键 10 题智能组卷：到期错题 + 薄弱模块混合，约 5 分钟 |
| 模块刷题 | 职业道德 / 数字人 / 业务分析 / 智能训练 / 系统设计，即时判分 + AI 解析 |
| 错题本 | SM-2 简化版间隔重复：答错 10 分钟后重现，答对间隔 1→3→…天递增 |
| 模拟考试 | 全真 45 题 90 分钟（按官方样卷结构组题）/ 快速 20 题 / 冲刺 10 题，计时、答题卡、自动判分、模块分布、逐题回顾 |
| 实操训练 | ①SQL（结果集自动判分）②Python（pandas+sklearn 八检查点判分）③BI 图表配置（ECharts 实时预览+判分）④流程图判定填空 ⑤数字人方案设计（AI 按 rubric 批改） |
| 决赛模拟 | 5 套模拟卷（单选 50 + 函数模板编程 7）；编程题在独立 Python 进程里逐测试点判分（5 秒 / 128MB），自测只跑样例、提交按全真或练习口径反馈 |
| 实操道场 | 7 张决策卡 + 10 个函数惯用法、67 道练习：关键路径实验台（可调耗时/正推倒推表/甘特图）、分幕可视化、代码冲刺（从零写/计时/随机用例/连续 AC）、单选/填空/代码判题、AI 教练点评、掌握度与间隔复习、今日速练 |
| 坤哥助手 | 全局悬浮 AI 管家：工具调用（练习统计/错题/考纲/题库检索/出题入库）、页面上下文感知、选中文字「问坤哥」引用提问、DeepSeek / ZCode 一键切换、对话历史本地保存 |
| AI 出题 | 「我的」页按模块生成新题，预览后一键入库 |
| 模型配置 | 「我的」页：三供应商（阿里云 Coding Plan / 智谱 ZCode / G4 中继 DeepSeek）、按用途分配模型（解析/批改/出题/动画/坤哥）、深度思考开关、Key 掩码存储于本地 DB |

## 目录结构

```
src/lib        db(node:sqlite) / srs / ai(DashScope流式) / stats / quiz / python-judge.mjs(决赛编程题判题内核) / finals-content、finals-store(决赛卷面与作答) / gym(道场内容、掌握度存储、判分)
src/app        页面 + API 路由（attempts、exam、ai/explain|grade|quiz、run/sql|python、finals/start|attempt|judge|practice、gym/attempt|run|ai）
src/components 刷题会话 / 考试答题器 / 五类实操训练器 / finals(决赛答题页、编程题工作台、成绩页) / gym(道场清单、主题页、可视化、练习)
scripts        parse_sample.py(官方样题解析) / gen_tasks.py(实操任务生成) / seed.mjs / finals(build.py 组卷、check.mjs 体检、problems/ 编程题源文件) / gym/check.mjs
data           seed-*.json（题源）、cognilab.db（运行数据）、finals(命题蓝图、理论题源文件、生成的卷面)
```

## 备考资料（赛事文件夹）

`~/Sync/工作/网安/04_行业比赛/20260919 人工智能赛事/`：官方样题 PDF、国家职业技能标准 PDF、《考试大纲与考点清单.md》
`~/Sync/工作/网安/04_行业比赛/20261125 人工智能数字人训练师大赛总决赛/`：全国总决赛平台操作手册 PDF、初赛试题 PDF
