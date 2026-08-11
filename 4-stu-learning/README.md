# 研学智能体学生端

基于通用学生端壳运行的课程驱动前端。当前接入 `6-lessons/lesson_gewu_001`，能够从课程 Markdown 和素材包生成课程导入等待态、N 角色任务、AI 对话工具卡、小组态势、课程收集物和时间银行体验。

## 当前能力

- 移动端小程序式通用壳：我的任务 / 小组双 Tab、进度和时间银行浮层；
- AI 对话主流程：真实模型生成角色引导、追问、任务反馈与来源标签；
- 课程内容渲染：阶段、N 个角色、角色任务、地点、模块和通过条件；
- 工具卡：位置导航、拍照、文字记录、任务分析与结果回传；
- 小组协作：成员进度、课程收集物状态、集合入口和赠时；
- 教师求助：携带当前角色、任务和位置上下文的前端交互；
- 素材接入：角色卡、徽章、收集物、地图、课程封面和任务图示；
- 教师控制：课程导入期保持只读等待，教师开始后开放角色领取与后续操作；
- 受控工具调用：模型只可请求当前状态允许的导航、任务工具和教师求助，状态推进由服务端完成；
- 服务端课程检索：知识按角色、阶段和任务完成状态检索，受保护内容在解锁前脱敏；
- 防剧透编译：答案、关键数据、验证规则和课程限制不进入浏览器课程包；
- 文件会话：开发阶段将会话、任务进度与时间银行状态持久化到本地 `.runtime/`。

教师工作台、场次/小组聚合、学生求助、教师指令、送达回执和审计已接入 Node.js 服务；学生端通过轮询接收教师消息、加时、暂停、复核和紧急集合。学习 AI 会话继续使用 SSE，教师课中态势使用 WebSocket 并保留轮询补偿。

教师端由同一服务托管，启动后访问 `http://127.0.0.1:3000/teacher/`。

## 开发

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填写模型与地图变量。模型密钥只由 Node.js 服务读取，不使用 `VITE_` 前缀。

`npm run dev` 和 `npm run build` 会先执行：

```bash
npm run sync:lessons
```

该命令完成两件事：

1. 读取 `../6-lessons` 下的课程 Markdown，生成经过字段裁剪和防剧透脱敏的 `src/generated/lesson-public.js`；
2. 将课程公开素材同步到 `public/lessons`；
3. 运行时由 Node.js 服务直接编译完整课程包，知识、限制、引导和答案只留在服务端。

课程内容应继续维护在 `6-lessons`。`src/generated` 与 `public/lessons` 是编译产物，不作为内容源编辑。

## 构建

```bash
npm run build
npm start
```

构建结果位于 `dist/`，`npm start` 会同时提供 API 与静态前端。

## 验证

```bash
npm test
npm run build
```

测试覆盖课程编译、知识解锁、防剧透、工具白名单和状态推进。

## 目录

```text
4-stu-learning/
├── scripts/
│   └── sync-lessons.mjs          # 课程源同步与编译前置步骤
├── server/
│   ├── agent/                     # 提示词、工具注册表与状态机
│   ├── course/                    # 私有课程编译、检索与防剧透
│   ├── services/                  # 模型适配器与会话存储
│   ├── app.js                     # Fastify API、SSE、上传与静态服务
│   └── index.js
├── public/
│   ├── assets/                    # 平台通用图标与共享媒体
│   └── lessons/                   # 从 6-lessons 同步的课程素材
├── src/
│   ├── engine/
│   │   └── lesson-parser.js       # Markdown 课程结构解析器
│   ├── generated/
│   │   └── lesson-public.js       # 自动生成的公开渲染配置
│   ├── pages/
│   │   └── student-learning.html  # 通用壳页面骨架
│   ├── services/
│   │   ├── course-service.js      # 课程加载入口
│   │   ├── ai-service.js          # AI 会话、SSE、上传与时间银行 API
│   │   └── amap-service.js        # 高德地图导航与定位
│   ├── app-controller.js          # 学习状态与交互调度
│   ├── main.js
│   ├── styles.css                  # 通用结构与组件样式
│   └── themes/
│       └── zhuhun.css              # 铸魂主题视觉变量
└── vite.config.js
```

详细约定见 [docs/frontend-architecture.md](docs/frontend-architecture.md)。
