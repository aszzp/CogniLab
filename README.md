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
| 坤哥助手 | 全局悬浮 AI 管家：工具调用（练习统计/错题/考纲/题库检索/出题入库）、页面上下文感知、选中文字「问坤哥」引用提问、对话历史本地保存 |
| AI 出题 | 「我的」页按模块生成新题，预览后一键入库 |
| 模型配置 | 「我的」页：双供应商（阿里云 Coding Plan / 智谱 ZCode）、按用途分配模型（解析/批改/出题/动画/坤哥）、深度思考开关、Key 掩码存储于本地 DB |

## 目录结构

```
src/lib        db(node:sqlite) / srs / ai(DashScope流式) / stats / quiz
src/app        页面 + API 路由（attempts、exam、ai/explain|grade|quiz、run/sql|python）
src/components 刷题会话 / 考试答题器 / 五类实操训练器
scripts        parse_sample.py(官方样题解析) / gen_tasks.py(实操任务生成) / seed.mjs
data           seed-*.json（题源）、cognilab.db（运行数据）
```

## 备考资料（赛事文件夹）

`~/Sync/工作/网安/04_行业比赛/20260919 人工智能赛事/`：官方样题 PDF、国家职业技能标准 PDF、《考试大纲与考点清单.md》
