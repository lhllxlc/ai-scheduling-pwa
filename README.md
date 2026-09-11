# Dayweave · 日常有序

移动优先、中英双语生活日程 PWA。当前交付范围为阶段 0 与阶段 1：可运行的手动规划闭环和 Supabase 数据基础。AI 解析、自动排程和 Web Push 尚未启用。

## 本地运行

需要 Node.js 22（至少 20.9）和 npm。

```powershell
npm ci
$env:APP_DEMO_MODE='true'
$env:APP_ORIGIN='http://localhost:3000'
npm run dev
```

打开 http://localhost:3000，点击 **Enter local demo**。每个浏览器会话独立，数据临时保存在服务端内存，24 小时过期；退出或服务重启可能清空数据。演示仅在非 production 且显式启用时可用。没有密钥时生产构建仍可成功，但应用明确提示未配置，不伪造认证。

如使用 127.0.0.1 或其他端口，请相应设置 APP_ORIGIN，必须和浏览器地址的 origin 完全一致。

## 已有功能

- Today、Add Plan、Review、Week、Settings 五个移动优先页面与登录页。
- 手动填写 → 修改确认 → 保存；固定事件按用户选定时间显示，弹性任务明确保持待安排。
- 编辑、完成、跳过、删除任务；保存语言、起床/睡眠、三餐、休息、通勤、晚间限制、每日任务时长。
- 墨尔本时区与 DST 校验；不存在或重复的本地时刻拒绝静默转换。
- Supabase 邮箱密码注册/登录/退出，服务端 Cookie 认证；数据导出与账号删除。
- RLS、结构化 Schema 校验、来源验证、限流、任务创建幂等键、通知记录表。
- PWA manifest、离线隐私页面、iPhone 主屏幕安装指引；不缓存日程或 API 数据。
- AI 隐私预览明确显示本阶段不会发送任何数据给模型；不收集或长期保存原始自然语言计划。

## Supabase 配置

将 `.env.example` 复制为 `.env.local`，只在本机/部署平台填写：

| 变量                      | 用途                                                        |
| ------------------------- | ----------------------------------------------------------- |
| APP_ORIGIN                | 应用公开来源，如 https://your-app.example；用于严格同源校验 |
| SUPABASE_URL              | Supabase 项目 URL                                           |
| SUPABASE_ANON_KEY         | 服务端使用的 anonymous/publishable key                      |
| SUPABASE_SERVICE_ROLE_KEY | 仅服务端删除账号使用；普通 CRUD 不使用此权限                |
| APP_DEMO_MODE             | 仅开发环境可设 true；连接 Supabase 后优先使用真实认证       |

执行 `supabase/migrations/202609110001_initial.sql`，然后在 Supabase Auth 中配置 Site URL、允许的回跳地址和邮件确认设置。新注册账号可能需要先点击确认邮件，再回到登录页面登录。所有业务请求在服务端通过 `getUser()` 验证身份并使用该用户的数据库权限。没有 service role 时导出/CRUD 可用，删除账号返回明确配置错误。

数据库隔离测试仅对迁移后的**可丢弃测试数据库**运行；脚本事务回滚，不连接生产数据：

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
```

该 SQL 验证跨用户读写隔离、创建幂等性及通知任务所有权。未提供数据库连接时，不能声称已通过真实 RLS/Auth 集成测试。

## 验证

```powershell
npm ls --depth=0
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E 自动启动 127.0.0.1:3100 开发服务器并显式启用隔离演示模式，不需要真实密钥。覆盖手机/桌面手动确认流程、偏好持久化、任务状态、注销、双会话隔离、幂等、非法请求、manifest 和错误页面。手机 Chromium 仿真不等于 iPhone Safari 实机验证。

## 部署准备（本次未部署）

Vercel 使用 Next.js 框架预设，Node 22，安装 `npm ci`，构建 `npm run build`。先在测试 Supabase 应用迁移，在 Vercel 设置服务器环境变量和正确 APP_ORIGIN。预览域名也需要匹配独立环境配置；不要提交 `.env.local`。生产部署禁止演示身份。

认证前限流目前按进程/IP 生效，生产需可信代理与边缘限流；业务写 API 使用数据库共享限流。直接调用 Supabase REST 仍受 RLS 和数据库约束保护，但不经过应用 API 限流。此版本未实现密码重置、离线日程编辑、实时同步或大数据分页。

## 后续阶段

阶段 2：服务端 OpenAI 结构化解析、必要问题、置信度、确认版本、独立确定性排程、任务拆分、截止风险与重新排程。OPENAI_API_KEY / OPENAI_MODEL 暂未使用。

阶段 3：Web Push 订阅、持久化通知队列、版本化取消旧通知、重试与去重、iPhone 实机验证。VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT 暂未使用。

## 文件与架构

- `src/components`、`src/app` 页面、`public`：前端和 PWA。
- `src/app/api`、`src/lib/server`、`supabase`：后端、迁移和隔离测试。
- `src/lib/ai`、`src/lib/scheduler`：校验、禁用的解析接口、时区与固定冲突基础。
- `src/lib/shared`：共享类型和默认偏好。
- `tests/e2e`：真实 Chromium 浏览器/API 测试。
- `docs/architecture.md`、`docs/database.md`、`docs/api-contracts.md`、`docs/implementation-plan.md`：阶段边界与契约。

本项目按 1 主 Agent + 3 子 Agent 实施，先定义契约，再按目录所有权开发并交接整合。既有文件与修改均保留，没有重置代码或生产部署。
