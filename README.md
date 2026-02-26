# ALLINAI

项目孵化仪表盘 — 从想法到验证的全流程管理工具。

跟踪你的 side project 进度，用 AI 分析项目健康度，用承诺系统逼自己别摆烂。

## 功能

**项目管理**
- 六阶段工作流：想法 → 开发 → 上线 → 验证 → 数据收集 → 归档
- 看板拖拽、搜索过滤、优先级排序
- 验证清单、指标图表、笔记、阶段转换历史

**每日承诺**
- 每天设定承诺，逾期自动结转
- 连续打卡追踪、30 天热力图
- Shame badge 机制 — 拖延了就得认

**AI 分析**
- 多模型支持：Claude / OpenAI / 自定义端点
- 项目健康度评估、推荐下一步行动
- 每日聚焦推荐：AI 告诉你今天该做哪个项目

**自动化**
- 本地 Git 仓库自动发现与扫描
- 后台 Cron 定时扫描代码活跃度
- 系统通知提醒

**MCP 集成**
- 完整的 Model Context Protocol server
- 通过 AI 助手直接管理项目、添加笔记、查看摘要

**报告**
- 每日简报、周报、月报
- Markdown 导出

**国际化**
- 中文 / English 双语支持

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 + React 19 (Turbopack) |
| 数据库 | SQLite + Drizzle ORM |
| UI | shadcn/ui + Tailwind CSS 4 + Lucide Icons |
| 数据获取 | SWR |
| 图表 | Recharts |
| 看板 | @hello-pangea/dnd |
| AI | Anthropic SDK + OpenAI SDK |
| MCP | @modelcontextprotocol/sdk |
| 定时任务 | node-cron |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 启动 MCP server
npm run mcp
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

数据库文件自动创建在 `data/allinai.db`，无需额外配置。

## AI 配置

进入 Settings 页面配置 AI provider：

- **Claude**: 填入 Anthropic API Key
- **Claude Code**: 自动从 macOS Keychain 读取 OAuth token
- **OpenAI**: 填入 OpenAI API Key
- **自定义**: 填入 base URL 和 API Key

## 项目结构

```
src/
├── app/
│   ├── api/          # API 路由 (13 个端点)
│   ├── digest/       # 每日简报页
│   ├── pipeline/     # 看板页
│   ├── projects/     # 项目详情页
│   ├── report/       # 报告页
│   ├── settings/     # 设置页
│   └── page.tsx      # Dashboard 首页
├── components/
│   ├── ui/           # shadcn/ui 组件
│   ├── dashboard/    # 仪表盘组件
│   ├── pipeline/     # 看板组件
│   ├── project/      # 项目组件
│   └── ai/           # AI 相关组件
├── lib/
│   ├── db/           # 数据库 schema 与初始化
│   ├── ai/           # AI provider 抽象层
│   ├── cron/         # 后台任务
│   ├── hooks/        # 自定义 React hooks
│   └── i18n.ts       # 国际化
├── mcp/              # MCP server 与工具
└── types/            # TypeScript 类型定义
```

## License

MIT
