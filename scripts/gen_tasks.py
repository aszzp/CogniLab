#!/usr/bin/env python3
"""生成实操任务定义 data/seed-tasks.json"""
import json, os, random

random.seed(42)

# ---------- SQL 任务数据 ----------
types = ['娱乐时事', '政治时事', '民生时事']
names = ['张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '孙悦', '周涛', '吴敏',
         '郑爽', '王磊', '冯雪', '陈晨', '楚天', '卫东', '蒋欣', '沈梦', '韩雨', '杨光']
rows = []
for i in range(24):
    rows.append((names[i % len(names)], random.choice(types),
                 f'2026-09-{(i % 28) + 1:02d}', random.randint(5, 120), random.randint(16, 60)))
# 保证过滤任务有命中
rows += [('张伟', '娱乐时事', '2026-09-05', 88, 19), ('李娜', '政治时事', '2026-09-06', 76, 20),
         ('陈静', '民生时事', '2026-09-07', 95, 21), ('周涛', '娱乐时事', '2026-09-08', 60, 22)]

init_sql = "CREATE TABLE use_record (xm TEXT, lx TEXT, scrq TEXT, cs INTEGER, age INTEGER);\n"
init_sql += "INSERT INTO use_record (xm, lx, scrq, cs, age) VALUES\n"
init_sql += ',\n'.join(str(r) for r in rows) + ';\n'
# 加一个干扰表
init_sql += """CREATE TABLE user_profile (xm TEXT, city TEXT, level INTEGER);
INSERT INTO user_profile (xm, city, level) VALUES ('张伟','北京',3),('王芳','上海',2),('李娜','广州',1);"""

expected_sql_1 = '''SELECT r.xm AS "username", r.lx AS "type", r.scrq AS "date", r.cs AS "times"
FROM use_record r
WHERE r.lx IN ('娱乐时事','政治时事','民生时事')'''

expected_sql_2 = '''SELECT r.xm AS "username", r.age, r.cs AS "times"
FROM use_record r
WHERE r.age BETWEEN 18 AND 22 AND r.cs >= 50'''

sql_task1 = {
    'kind': 'sql', 'title': 'SQL 创建时事资讯数据集', 'category': '业务分析',
    'points': 15, 'source': '官方样题 实操一',
    'prompt': ('某公司预开发一款时事资讯 APP，现依据数据源进行数据业务分析。数据表 use_record（别名为 r）'
               '字段：xm 姓名 / lx 资讯类型 / scrq 日期 / cs 访问次数 / age 年龄。\n'
               '请编写 SQL 创建数据集「用户使用记录」：\n'
               '① 查询字段与别名：xm→username、lx→type、scrq→date、cs→times；\n'
               '② 数据范围为：娱乐时事、政治时事、民生时事。'),
    'meta': {'initSql': init_sql, 'expectedSql': expected_sql_1},
}
sql_task2 = {
    'kind': 'sql', 'title': 'SQL 过滤「强关注的年轻用户」', 'category': '业务分析',
    'points': 10, 'source': '官方样题 实操一(3) 变式',
    'prompt': ('在数据表 use_record（别名 r）上编写 SQL，筛选「强关注的年轻用户」：\n'
               '① 返回字段：username（xm 的别名）、age、times（cs 的别名）；\n'
               '② 条件：年龄在 18 到 22 岁之间，且当天访问次数 ≥ 50。'),
    'meta': {'initSql': init_sql, 'expectedSql': expected_sql_2},
}

# ---------- Python 任务 ----------
salaries, csv_lines = [], ['预估薪资,是否会购买']
for i in range(48):
    s = random.randint(20000, 200000)
    y = 1 if s > 90000 + random.randint(-15000, 15000) else 0
    csv_lines.append(f'{s},{y}')
csv_lines[25] = ',1'           # 缺失值1
csv_lines[40] = '150000,1'     # 与前面可能重复
csv_lines.append('150000,1')   # 确保有重复行
random.shuffle(csv_lines[1:])
preload = '\n'.join(csv_lines)

py_cps = [
    ('① 读取 data.csv 数据集（变量名 data）', "assert isinstance(data, pd.DataFrame) and data.shape[1] == 2", 2),
    ('② 缺失值处理：清洗后无缺失', "assert data.isna().sum().sum() == 0", 2),
    ('③ 重复值处理：清洗后无重复行', "assert len(data.drop_duplicates()) == len(data)", 2),
    ('④ 划分特征 X 与标签 y（y 为「是否会购买」）', "assert len(X) == len(y) and ('薪资' in str(X.name) or '薪资' in str(getattr(X,'columns','')))", 2),
    ('⑤ 按 8:2 随机划分训练集/测试集', "assert 0.7 <= len(X_train)/(len(X_train)+len(X_test)+0.0) <= 0.9 and len(y_train)+len(y_test) == len(X)", 2),
    ('⑥ 训练/测试特征转为二维数组', "assert X_train.ndim == 2 and X_train.shape[1] == 1 and X_test.ndim == 2 and X_test.shape[1] == 1", 2),
    ('⑦ 定义逻辑回归模型并完成训练', "assert hasattr(model, 'predict') and hasattr(model, 'coef_')", 2),
    ('⑧ 输出准确度 accuracy 与预测值 y_pred', "assert 0 <= accuracy <= 1 and len(y_pred) == len(X_test)", 2),
]
py_task = {
    'kind': 'python', 'title': 'Python 汽车购买预测（逻辑回归）', 'category': '智能训练',
    'points': 16, 'source': '官方样题 实操二',
    'prompt': ('某汽车公司收集了用户预估薪资与是否购买新款豪华汽车的数据（data.csv，'
               '字段：预估薪资、是否会购买）。请用 Python 完成数据处理与算法测试。\n'
               '要求变量名：data、X、y、X_train、X_test、y_train、y_test、model、accuracy、y_pred：\n'
               '① 读取 data.csv；② 查看 head(15) 与 describe()；\n'
               '③ 预处理：处理缺失值、重复值；④ 划分特征 X 与标签 y；\n'
               '⑤ 按 8:2 随机划分训练集与测试集（random_state=2020）；\n'
               '⑥ 将训练/测试特征转为二维数组；⑦ 定义逻辑回归模型并训练；\n'
               '⑧ 输出测试集准确度 accuracy 与预测值 y_pred。'),
    'meta': {'preload': preload, 'checkpoints': [
        {'label': l, 'code': c, 'points': p} for l, c, p in py_cps]},
}

# ---------- 图表任务 ----------
ds_rows = []
for age in range(18, 26):
    for t in types:
        ds_rows.append([age, t, random.randint(10, 99)])
chart_task = {
    'kind': 'chart', 'title': '监控图表：年轻用户热点时事分布', 'category': '系统设计',
    'points': 9, 'source': '官方样题 实操三(1)',
    'prompt': ('【资讯实时APP】需要对"关注度分析"功能进行监控。数据集字段：age 年龄 / type 资讯类型 / '
               'times 查看次数。\n请配置统计图表：\n'
               '① 图表类型：热力图；标题：年轻用户对热点时事查看次数分布图；\n'
               '② 行维度：age；列维度：type；指标：times（聚合 SUM）；\n'
               '③ 数据范围：年龄 22~25，且类型为娱乐/政治/民生时事。'),
    'meta': {
        'dataset': {'columns': ['age', 'type', 'times'], 'rows': ds_rows},
        'target': {
            'chartType': 'heatmap', 'rowDim': 'age', 'colDim': 'type',
            'metric': 'times', 'agg': 'sum',
            'ageRange': [22, 25], 'types': ['娱乐时事', '政治时事', '民生时事'],
            'title': '年轻用户对热点时事查看次数分布图',
        },
    },
}

# ---------- 流程图任务 ----------
flow_task = {
    'kind': 'flow', 'title': '人机交互：掌上钱包信息采集流程', 'category': '系统设计',
    'points': 12, 'source': '官方样题 实操三(2)',
    'prompt': ('某公司研发用户掌上钱包 APP，支持账号密码、手机号验证、指纹、人脸识别四种登录方式。'
               '请为"用户信息采集过程"补全流程图中的 ①~⑤ 判定条件，使其成为最优流程。'),
    'meta': {
        'nodes': [
            {'id': 'start', 'kind': 'start', 'label': '开始'},
            {'id': 'j1', 'kind': 'judge', 'label': '', 'blank': 0},
            {'id': 'a1', 'kind': 'action', 'label': '输入用户账号密码'},
            {'id': 'j2', 'kind': 'judge', 'label': '', 'blank': 1},
            {'id': 'a2', 'kind': 'action', 'label': '人脸采集'},
            {'id': 'j3', 'kind': 'judge', 'label': '', 'blank': 2},
            {'id': 'a3', 'kind': 'action', 'label': '指纹采集'},
            {'id': 'j4', 'kind': 'judge', 'label': '', 'blank': 3},
            {'id': 'a4', 'kind': 'action', 'label': '手机号短信验证'},
            {'id': 'j5', 'kind': 'judge', 'label': '', 'blank': 4},
            {'id': 'save', 'kind': 'action', 'label': '保存登录设置'},
            {'id': 'end', 'kind': 'end', 'label': '完成，进入 APP'},
            {'id': 'skip', 'kind': 'end', 'label': '暂不设置，直接体验'},
        ],
        'edges': [['start', 'j1'], ['j1', 'skip', '否'], ['j1', 'j2', '是'], ['j2', 'a1', '是'],
                  ['j2', 'j3', '否'], ['a1', 'j3'], ['j3', 'a2', '是'], ['j3', 'j4', '否'],
                  ['a2', 'j4'], ['j4', 'a3', '是'], ['j4', 'j5', '否'], ['a3', 'j5'],
                  ['j5', 'a4', '是'], ['j5', 'save', '否'], ['a4', 'save'], ['save', 'end']],
        'choices': ['是否选择"用户账号密码"', '是否选择"人脸采集"', '是否选择"指纹采集"',
                    '是否选择"设置登录信息"', '是否选择"手机号码验证"'],
        'answers': ['是否选择"设置登录信息"', '是否选择"用户账号密码"', '是否选择"人脸采集"',
                    '是否选择"指纹采集"', '是否选择"手机号码验证"'],
    },
}

# ---------- 主观题任务 ----------
essay_task1 = {
    'kind': 'essay', 'title': '数字人主播「小美」训练方案', 'category': '数字人',
    'points': 3, 'source': '官方样题 实操四',
    'prompt': ('某美妆品牌计划推出一款面向年轻女性用户的数字人主播"小美"，用于护肤品直播带货。'
               '请设计该数字人主播的训练方案，包括：\n'
               '（1）人格设定：至少 3 个人设关键词（如温柔、专业、亲和力）及对应语言风格要求；\n'
               '（2）交互设计要点：直播场景需具备的关键交互能力及训练重点；\n'
               '（3）多模态联动：讲解产品质地时，语音、表情、动作如何联动配合。'),
    'meta': {'rubric': [
        {'label': '人格设定', 'points': 40, 'desc': '≥3 个人设关键词，且每个关键词有对应的语言风格说明（语气、用词、情感连接等）'},
        {'label': '交互设计要点', 'points': 30, 'desc': '列举实时应答、主动引导、情绪适配等交互能力，并说明训练重点（如自然语言理解准确性、回应时机）'},
        {'label': '多模态联动', 'points': 30, 'desc': '具体描述语音（细腻描述）、表情（专注/惊喜）、动作（涂抹/展示包装）的联动配合'},
    ]},
}
essay_task2 = {
    'kind': 'essay', 'title': '金融数字人客服幻觉率治理方案', 'category': '数字人',
    'points': 10, 'source': '补充训练',
    'prompt': ('某银行拟上线数字人客服"小金"，回答理财、信贷、账户类问题。监管要求严肃金融场景'
               '回答幻觉率必须极低。请设计一套训练与治理方案，涵盖：数据准备、知识库建设、'
               '提示词与人设约束、测试评估与上线监控。'),
    'meta': {'rubric': [
        {'label': '数据准备', 'points': 25, 'desc': '筛选高质量结构化业务数据、语料清洗与标注、敏感信息脱敏'},
        {'label': '知识库建设', 'points': 25, 'desc': '构建金融垂直领域知识库（产品文档、业务规则、FAQ），RAG 检索增强，明确"知识库外不臆答"策略'},
        {'label': '提示词与人设约束', 'points': 25, 'desc': 'Prompt 框架定义人设、回答边界、拒答与转人工策略、合规话术'},
        {'label': '测试评估与监控', 'points': 25, 'desc': '构建黄金测试集、幻觉率/准确率指标、上线后badcase回流迭代'},
    ]},
}

tasks = [sql_task1, sql_task2, py_task, chart_task, flow_task, essay_task1, essay_task2]
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'seed-tasks.json')
json.dump(tasks, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'共 {len(tasks)} 个实操任务')
