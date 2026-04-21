# ☁️ Cloud Code

**在手机上使用 Claude Code 的 Web 界面**

Cloud Code 是一个移动端优先的 Web 应用，让你通过浏览器随时随地与 Claude AI 交互。基于 [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)，AI 可以真正地读写文件、执行命令、搜索代码——不只是聊天，而是完整的编程代理体验。

## ✨ 特性

- 📱 **移动端优先** — 专为手机浏览器优化，44px 最小触摸目标，安全区域适配
- 🤖 **真正的 Agent 能力** — AI 可以读取/编辑文件、执行 Bash 命令、搜索代码（Read/Edit/Bash/Glob/Grep）
- 🔄 **流式实时响应** — WebSocket 双向通信，逐字输出，思维过程可视化
- 🛠️ **工具调用可视化** — 可折叠卡片展示工具名称、输入参数和输出结果
- 💬 **多会话管理** — 创建、切换、重命名、删除多个会话，每个会话关联独立工作目录
- 💾 **消息持久化** — 所有对话自动保存，刷新页面不丢失
- 🔐 **可选认证** — 通过 API_KEY 保护 REST 和 WebSocket 接口
- 🔌 **第三方 API 兼容** — 通过 `ANTHROPIC_BASE_URL` 可接入智谱等兼容 API
- 🚀 **零数据库依赖** — JSON 文件存储，零运维成本

## 🖼️ 截图

> 📱 移动端聊天界面 | 🛠️ 工具调用可视化 | 💬 多会话管理

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| **前端** | React 19 + Vite + TypeScript + Headless UI |
| **后端** | Node.js + Express + Claude Agent SDK |
| **通信** | WebSocket + REST API |
| **渲染** | React Markdown + GFM + 语法高亮 |
| **测试** | Playwright E2E |
| **包管理** | pnpm workspace (Monorepo) |

## 📋 环境要求

- Node.js 18+
- pnpm
- Claude Agent SDK 访问权限（或兼容 API）

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/ksxh0524/cloud-code.git
cd cloud-code

# 安装依赖
pnpm install

# 配置环境变量
cd backend
cp .env.example .env
# 编辑 .env 填入 API 配置

# 启动后端 (port 18765)
pnpm dev

# 启动前端 (port 18766) — 另一个终端
cd .. && pnpm dev

# 访问 http://localhost:18766
```

或者一键启动：

```bash
chmod +x manager.sh
./manager.sh start
```

## ⚙️ 环境变量

在 `backend/.env` 中配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_BASE_URL` | API 基础 URL（支持智谱等兼容 API） | — |
| `ANTHROPIC_AUTH_TOKEN` | API 认证密钥 | — |
| `PORT` | 后端端口 | `18765` |
| `LOG_LEVEL` | 日志级别 (`debug`/`info`/`warn`/`error`) | `info` |
| `NODE_ENV` | 运行环境 | `development` |
| `API_KEY` | 可选认证密钥（设置后所有请求需认证） | — |
| `ANTHROPIC_API_KEY` | Claude 原生 API Key（可选） | — |

### 智谱 API 配置示例

```env
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zhipu-api-key
```

## 📁 项目结构

```
cloud-code/
├── backend/                    # Express 后端
│   └── src/
│       ├── server.ts           # 应用入口 + WebSocket 服务器
│       ├── agent-service.ts    # Claude Agent SDK 集成（核心）
│       ├── routes.ts           # REST API 路由 (Zod 校验)
│       ├── store.ts            # JSON 文件数据持久化 (异步互斥锁)
│       ├── auth.ts             # API Key 认证中间件
│       ├── logger.ts           # Pino 日志
│       └── types.ts            # 类型定义
├── frontend/                   # React 前端
│   └── src/
│       ├── pages/
│       │   ├── ChatNew.tsx     # 主聊天页面
│       │   └── Settings.tsx    # 设置页面
│       ├── components/
│       │   ├── MessageItem.tsx # 消息项 (Markdown 渲染)
│       │   ├── MessageList.tsx # 消息列表
│       │   ├── ToolCall.tsx    # 工具调用可折叠展示
│       │   ├── CodeBlock.tsx   # 代码语法高亮
│       │   ├── InputBox.tsx    # 自动伸缩输入框
│       │   ├── ConversationList.tsx # 会话列表
│       │   ├── NewConversationModal.tsx # 新建会话弹窗
│       │   ├── CustomSelect.tsx # 自定义下拉选择器
│       │   └── Modal.tsx       # 通用弹窗
│       ├── hooks/
│       │   └── useAgentWebSocket.ts # WebSocket 自动重连 Hook
│       └── lib/
│           └── fetch.ts        # 带 API Key 的 fetch 封装
├── manager.sh                  # 服务管理脚本
├── test/                       # Playwright E2E 测试
└── docs/
    └── DEPLOYMENT.md           # 部署指南
```

## 🔌 WebSocket 协议

### 客户端 → 服务端

```json
{"type": "init", "data": {"workDir": "/path", "env": {...}}}
{"type": "prompt", "data": {"prompt": "text", "workDir": "/path", "conversationId": "id"}}
{"type": "interrupt"}
```

### 服务端 → 客户端

```json
{"type": "connected", "data": {"sessionId": "uuid"}}
{"type": "stream", "data": {"delta": {"text": "chunk"}}}
{"type": "message", "data": {"role": "assistant", "content": "...", "type": "text"}}
{"type": "thinking", "data": {"content": "..."}}
{"type": "tool_call", "data": {"toolName": "Bash", "toolInput": {...}}}
{"type": "tool_result", "data": {"toolName": "Bash", "toolOutput": "..."}}
{"type": "done", "data": null}
{"type": "error", "data": "error message"}
```

## 🛠️ 服务管理

`manager.sh` 提供完整的服务生命周期管理：

```bash
./manager.sh start     # 启动所有服务（自动检查依赖、健康检查等待）
./manager.sh stop      # 停止所有服务（优雅 SIGTERM → 超时后 SIGKILL）
./manager.sh restart   # 重启
./manager.sh status    # 查看服务状态、PID、运行时长
./manager.sh logs      # 实时查看所有日志
./manager.sh logs backend  # 查看后端日志
./manager.sh update    # git pull + pnpm install
./manager.sh clean     # 清理 7 天前的旧日志
```

## 📦 开发

```bash
# 同时启动前后端开发服务器
pnpm dev:all

# 构建生产版本
pnpm build

# 代码检查
pnpm lint && pnpm format

# 运行 E2E 测试
npx playwright test
```

## 🚢 部署

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，包含：

- 直接部署（systemd 服务管理）
- Docker 部署
- Nginx / Caddy 反向代理配置

## 🔒 安全

- **路径安全控制** — 后端限制只能访问 `~/` 和 `~/codes/` 下的目录
- **可选 API 认证** — REST API（Header/Bearer）和 WebSocket（URL 参数）均受保护
- **环境变量隔离** — 只向 Agent 传递安全的环境变量白名单

## 📄 License

[MIT](LICENSE)
