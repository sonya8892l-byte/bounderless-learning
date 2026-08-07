# Vercel Preview 全链路验收报告

> 日期：2026-07-31
>
> 环境：受 Vercel Authentication 保护的 Preview
>
> 结论：AI、Supabase PostgreSQL、Supabase Storage、SSE 与幂等持久化均已跑通。Production 未部署。

## 验收对象

- Preview：<https://bounderless-learning-ny51dr4nj-sonyas-projects-7720416e.vercel.app>
- Vercel deployment：`dpl_DvDJXtGc5qiLUtKNx7c7viboaePX`
- Supabase Project Ref：`cpwglcnuvefdyhevpenw`
- migration：`20260731120000_m2_expand_persistence.sql`

## 自动门禁

| 检查 | 结果 |
|---|---|
| 完整测试 | 102/102 通过 |
| 学生端与教师端构建 | 通过，5 门课程同步 |
| Vercel Function 数量 | 1 |
| Function 原始文件体积 | 4.42 MB |
| Function 入口动态加载 | 通过 |
| 本地 `.env`、测试、前端静态资源与课程媒体进入 Function | 0 |
| 浏览器 API 基地址 | 固定为同源 `/api`；产物门禁会拒绝 Vercel 脱敏占位符 |

## 云端 E2E

| 能力 | 结果 | 证据 |
|---|---|---|
| 学生端静态页面 | 通过 | `/student/` 返回 200 |
| connected 学生端 | 通过 | `mode=connected` 页面返回 200，创建 Session 返回 201 |
| API health | 通过 | `/api/health` 返回 200、`cache-control: no-store` |
| 依赖 readiness | 通过 | 返回 200、`ok=true` |
| PostgreSQL | 通过 | `configured=true`、`healthy=true`、`schemaReady=true`，本次 1139 ms |
| Session 创建 | 通过 | 返回 201，测试 session 为 `ses_aeee0c3dae184dcd994cf119765a05d3` |
| Session 恢复 | 通过 | 返回 200，状态与更新时间完整 |
| 跨 deployment 持久化 | 通过 | 新 deployment 可恢复原 session 及 AI 状态 |
| 入场 SSE | 通过 | 收到 `stage.started`、`assistant.completed`、`tool.requested`、`state.updated` |
| 真实模型 SSE | 通过 | 收到连续 `assistant.delta`，完成事件 `streamed=true`、`degraded=false` |
| 请求幂等 | 通过 | 相同 `requestId` 回放相同消息 ID，无重复 delta |
| Storage 配置 | 通过 | `configured=true`、`healthy=true` |
| Storage 实际写入 | 通过 | `/api/uploads` 返回 201、`storage=s3` |
| Storage 实际读取 | 通过 | 下载结果与上传源文件逐字节一致 |

### connected 模式 404 修复复验

首次预构建部署曾把 Vercel CLI 拉取的 Sensitive 占位值 `[SENSITIVE]` 编译为
`VITE_API_BASE_URL`，浏览器因此请求错误路径并收到 404。现已完成：

- 浏览器运行时检测脱敏占位值并回退到 `/api`；
- Vercel 构建显式固定公开 API 基地址为 `/api`；
- 产物门禁检查学生端 API 启动代码，防止同类问题再次部署；
- 新 Preview 中 connected 页面返回 200，`POST /api/sessions` 返回 201；
- 新 Session 的真实模型请求收到 42 个 `assistant.delta`，最终
  `streamed=true`、`degraded=false`。

本次复验消息 ID：

```text
msg_feca8321-53ff-4a84-8c13-68a677b5df43
```

成功模型回放消息 ID：

```text
msg_6e7529ac-0432-462f-b953-e4f70b8cb53b
```

Storage E2E 对象：

```text
evidence/ev_17d7b4f624a84a72823552fa3ec911ec.png
```

该对象为 780 字节课程徽章测试文件，可在 Supabase Storage 中手动删除。

## 安全与边界

- Preview 继续启用 Deployment Protection，匿名访问会进入 Vercel Authentication。
- 模型 Key、数据库 URL、S3 Secret 与 readiness token 均未写入 Git、文档或 Function 产物。
- 本轮临时下载文件和 readiness token 明文已在验收后删除。
- 上游模型失败日志仅记录错误 `name`、`code` 与 HTTP `status`。
- `OPENAI_API_KEY` 当前同时作用于 Production 与 Preview；正式发布前应确认这是预期范围。

## Production 发布门禁

Preview 技术链路跑通不代表可以直接公开发布。以下工作仍属于生产阻断项：

1. 接入 Supabase Auth，建立教师与学生身份。
2. 为场次、会话、上传和教师命令增加服务端授权。
3. 建立 API 限流、滥用防护与成本预算。
4. 完成 Storage 用户级访问策略或短期直传凭证。
5. 将教师课堂运行态从兼容 `runtime_state('course-runs')` 切换到规范化表。
6. 执行权限、负载、回滚和正式域名验收。
