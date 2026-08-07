# Supabase + Vercel Preview 人工配置清单

> 日期：2026-07-31
>
> 用途：为当前项目建立隔离的 AI 全栈 Preview 环境。
>
> 安全原则：所有密码、Token、模型 Key、数据库 URL 和 S3 Secret 都由你直接填写到对应控制台或本机登录界面，不要粘贴到聊天、文档或 Git。

## 当前核验状态（2026-07-31）

- [x] Supabase 项目已关联，远端 migration `20260731120000` 与本地一致。
- [x] 用户已确认 `study-evidence` 私有桶创建完成；Vercel 中六个 S3 变量均为 Preview-only。
- [x] Vercel Project 已关联，受保护 Preview 的匿名请求会进入 Vercel Authentication。
- [x] 已生成并写入 Preview-only Sensitive `READINESS_TOKEN`。
- [x] Vercel 单 Function 产物门禁通过：4.42 MB、入口可加载、无 `.env` 或课程媒体。
- [x] `DATABASE_URL` 已补齐；数据库 readiness、session 写入/恢复和跨 deployment 持久化均通过。
- [x] Preview 静态页面、health、SSE 与请求幂等回放通过。
- [x] `OPENAI_API_KEY` 已更换；真实模型 SSE 完成事件为 `degraded=false`。
- [x] `S3_ACCESS_KEY_ID` 与 `S3_SECRET_ACCESS_KEY` 已补齐；readiness 与实际上传/下载往返均通过。

## 已完成的账号侧配置

### 1. 创建 Supabase staging 项目

- [x] 已建立用于 Preview/staging 的 Supabase 项目。
- [x] 项目 region 已记录为 `ap-northeast-2`。
- [ ] 保存好数据库密码；后续如果密码包含特殊字符，放进连接 URL 前需要进行 URL 编码。
- [x] 已使用 **Transaction pooler** 的 `6543` 连接串配置 Vercel Preview `DATABASE_URL`。
- [ ] 不要把 Production 数据库与这个 staging 项目混用。

当前项目已经包含 migration：

`supabase/migrations/20260731120000_m2_expand_persistence.sql`

在本项目根目录执行以下命令。登录和密码输入请由你本人完成：

```bash
npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref <你的_PROJECT_REF>
npx --yes supabase@latest db push --dry-run
npx --yes supabase@latest db push
```

执行后：

- [x] 远端 migration 与 readiness 已确认 `learner_sessions`、`learner_requests`、`course_runs` 和 `runtime_state` 等 schema 就绪。
- [x] migration 已写入 `runtime_state` 的 `id = 'course-runs'` 兼容记录。
- [ ] 如果 `--dry-run` 或 `db push` 报错，只把脱敏后的错误信息发给我。
- [ ] 不要执行 `supabase db reset --linked`；它会清空远程项目数据。

参考：[Supabase migration 工作流](https://supabase.com/docs/guides/local-development/database-migrations)、[Supabase `db push`](https://supabase.com/docs/reference/cli/supabase-migration-fetch)。

### 2. 让本地项目关联 Vercel

在本项目根目录执行：

```bash
npx --yes vercel@58.4.4 login
npx --yes vercel@58.4.4 link
```

- 当前本机 Vercel CLI 报告缓存 Token 无效；如果 `login` 仍提示同样错误，先执行 `npx --yes vercel@58.4.4 logout`，再重新登录。
- [x] 本地目录已关联现有 Vercel 项目。
- [ ] 不要把 Vercel Token 发给我。
- [ ] 完成后只需告诉我“Vercel 已 link”，我就可以继续验证真实 Function 构建产物。

## Supabase Storage

在 Supabase Dashboard 的 Storage 中：

- [x] 已创建普通 Files bucket：`study-evidence`。
- [x] `study-evidence` 已保持 **Private**。
- [ ] 暂时将单文件上限控制在 4 MB。
- [x] 已生成服务端 S3 access key，并仅写入 Vercel Preview。
- [x] 已记录 S3 endpoint 和真实 project region。

S3 access key 可绕过 Storage RLS，必须仅放在 Vercel 服务端环境变量中。当前 endpoint 形式为：

```text
https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
```

参考：[Supabase 私有 bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[Supabase S3 认证](https://supabase.com/docs/guides/storage/s3/authentication)。

## Vercel Preview 环境变量

在 Vercel 项目 **Settings → Environment Variables** 中，仅勾选 **Preview**，填写以下变量。修改环境变量后需要重新部署，旧 deployment 不会自动获得新值。

### 运行模式

```text
APP_ENV=preview
AI_ENABLED=true
REALTIME_MODE=polling
EVIDENCE_UPLOAD_MODE=proxy
ENABLE_DEMO=false
READINESS_TOKEN=<至少 24 位随机值>
AI_TURN_TIMEOUT_MS=70000
AI_REQUEST_LEASE_MS=80000
MAX_UPLOAD_BYTES=4000000
```

### AI 服务

```text
OPENAI_BASE_URL=<你的 OpenAI-compatible 服务地址，通常以 /v1 结尾>
OPENAI_API_KEY=<服务端 Key>
OPENAI_MODEL=<模型名>
OPENAI_WIRE_API=chat_completions
AI_TOOL_MODE=auto
AI_VISION_MODE=auto
AI_REASONING_EFFORT=minimal
AI_MAX_OUTPUT_TOKENS=192
AI_TIMEOUT_MS=18000
```

如果模型供应商明确支持 Responses API，可把 `OPENAI_WIRE_API` 改为 `responses`。

### PostgreSQL

```text
DATABASE_URL=<Supabase Transaction pooler 6543 连接串>
DB_POOL_MAX=2
DB_CONNECTION_TIMEOUT_MS=5000
DB_QUERY_TIMEOUT_MS=8000
DB_IDLE_TIMEOUT_MS=10000
DB_MAX_LIFETIME_SECONDS=300
```

Vercel Function 应使用 transaction pooler；migration、备份和管理操作使用 direct connection。参考：[Supabase 数据库连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)。

### Storage

```text
S3_BUCKET=study-evidence
S3_REGION=<Supabase S3 页面显示的项目 region>
S3_ENDPOINT=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<服务端 access key>
S3_SECRET_ACCESS_KEY=<服务端 secret>
S3_PREFIX=evidence
```

### 地图

```text
VITE_AMAP_KEY=<Preview 可用的高德 Key>
VITE_AMAP_SECURITY_CODE=<高德安全码>
VITE_AMAP_STYLE=amap://styles/normal
VITE_API_BASE_URL=/api
```

`VITE_API_BASE_URL` 是公开的同源路径，无需标记为 Sensitive。当前构建也会显式固定为
`/api`，并在 Vercel CLI 返回脱敏占位符时自动安全回退。

## Vercel 安全设置

- [x] **Deployment Protection** 已启用；匿名访问会进入 Vercel Authentication。
- [ ] 在 **Settings → Functions** 确认 Fluid Compute 已生效；项目的 `vercel.json` 已声明 `"fluid": true`。
- [ ] Preview 验收期间不要执行 Production 部署。
- [ ] 当前正式身份鉴权、授权与 API 限流仍在后续阶段；在这些能力完成前，Preview 必须保持受保护状态。

参考：[Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)、[Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)、[Vercel 环境变量](https://vercel.com/docs/environment-variables)。

## 完成后如何通知我

你无需发送任何 secret。请回复：

```text
Supabase staging 已创建并完成 db push；
study-evidence 私有桶已创建；
Vercel 已 link，Preview 环境变量已填写。
```

如果遇到错误，请先隐藏连接串中的用户名、密码、host、project ref、Token 和 access key，再把错误文本发给我。
