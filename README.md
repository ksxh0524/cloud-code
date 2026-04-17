# Cloud Code

在手机上方便地使用 Claude Code。

## 功能

- 移动端优化的 Web 界面
- 基于 Claude Agent SDK 的结构化对话
- 工具调用可视化（可折叠展开）
- 支持多会话和目录管理
- 飞书机器人集成

## 技术栈

- **后端**: Node.js + Express + Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **前端**: React 19 + Vite + TypeScript
- **通信**: WebSocket + REST API
- **测试**: Playwright E2E

## 环境要求

- Node.js 18+
- Claude Agent SDK 访问权限

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置后端环境变量
cd backend
cp .env.example .env
# 编辑 .env 填入 API 配置

# 启动后端 (port 18765)
cd backend && pnpm dev

# 启动前端 (port 18766) — 另一个终端
pnpm dev

# 访问 http://localhost:18766
```

### 环境变量

在 `backend/.env` 中配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | API 基础 URL | `https://open.bigmodel.cn/api/anthropic` |
| `ANTHROPIC_AUTH_TOKEN` | API 认证密钥 | `your-api-key` |
| `PORT` | 后端端口 | `18765` |

## 项目结构

```
cloud-code/
├── backend/           # Express 后端
│   └── src/
│       ├── server.ts       # 应用入口 + WebSocket
│       ├── agent-service.ts # Agent SDK 集成
│       ├── routes.ts       # REST API 路由
│       ├── store.ts        # JSON 文件数据存储
│       └── types.ts        # 类型定义
├── frontend/          # React 前端
│   └── src/
│       ├── pages/          # 页面 (ChatNew, Settings)
│       ├── components/     # UI 组件
│       ├── hooks/          # useAgentWebSocket 等
│       └── types.ts        # 类型定义
├── test/              # Playwright E2E 测试
└── docs/              # 文档
```

## 开发

```bash
# 构建前端
pnpm build

# 运行 E2E 测试
npx playwright test

# 代码检查
pnpm lint && pnpm format
```

## License

MIT
