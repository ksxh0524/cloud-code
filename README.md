# ☁️ Cloud Code

在手机上使用 Claude Code 的 Web 界面

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> Cloud Code 是一个移动端优先的 Web 应用，让你通过浏览器随时随地与 Claude AI 交互。AI 可以真正地读写文件、执行命令、搜索代码——不只是聊天，而是完整的编程代理体验。

---

## ✨ 特性

- 📱 **移动端优先** — 44px 最小触摸目标，安全区域适配
- 🤖 **Agent 能力** — Read/Edit/Bash/Glob/Grep 工具调用
- 🔄 **流式实时响应** — WebSocket 双向通信，思维过程可视化
- 🛠️ **工具调用可视化** — 可折叠卡片展示工具详情
- 💬 **多会话管理** — 独立工作目录，消息持久化
- 🔐 **可选认证** — API_KEY 保护接口
- 🔌 **第三方 API 兼容** — 智谱等兼容 API
- 🚀 **零数据库依赖** — JSON 文件存储

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm

### 安装

```bash
git clone https://github.com/ksxh0524/cloud-code.git
cd cloud-code
pnpm install
```

### 配置

```bash
cd backend
cp .env.example .env
# 编辑 .env 填入 API 配置
```

### 启动

```bash
# 方式一：一键启动（推荐）
chmod +x manager.sh
./manager.sh start

# 方式二：分别启动
cd backend && pnpm dev    # 后端: 18765
cd frontend && pnpm dev   # 前端: 18766
```

访问 http://localhost:18766

---

## 📁 项目结构

```
cloud-code/
├── backend/          # Express + WebSocket 后端
├── frontend/         # React 19 + Vite 前端
├── test/             # Playwright E2E 测试
├── docs/             # 详细文档
└── manager.sh        # 服务管理脚本
```

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署指南（systemd/Docker/Nginx） |
| [docs/API.md](docs/API.md) | REST API 和 WebSocket 协议 |
| [docs/TESTING.md](docs/TESTING.md) | 测试指南 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 常见问题排查 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 |

---

## 🔧 常用命令

```bash
# 开发
pnpm dev:all              # 同时启动前后端
pnpm dev                  # 仅前端
pnpm dev:backend          # 仅后端

# 构建
pnpm build                # 生产构建

# 测试
npx playwright test       # 运行 E2E 测试

# 代码规范
pnpm lint                 # ESLint 检查
pnpm lint:fix             # 自动修复
pnpm format               # Prettier 格式化

# 服务管理（./manager.sh）
./manager.sh start        # 启动服务
./manager.sh stop         # 停止服务
./manager.sh restart      # 重启服务
./manager.sh status       # 查看状态
./manager.sh logs         # 查看日志
./manager.sh update       # 更新代码+依赖
```

---

## ⚙️ 环境变量

核心配置（`backend/.env`）：

| 变量 | 说明 | 必需 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | API 基础 URL | ✓ |
| `ANTHROPIC_AUTH_TOKEN` | API 认证密钥 | ✓ |
| `PORT` | 后端端口 | 否（默认18765） |
| `API_KEY` | 访问控制密钥（可选） | 否 |

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 🛡️ 安全

- **路径安全控制** — 限制访问 `~/` 和 `~/codes/` 目录
- **API 认证** — REST/WebSocket 均支持 API Key
- **环境变量隔离** — 安全变量白名单机制

---

## 📄 许可证

[MIT](LICENSE)

---

## 🙏 致谢

基于 [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) 构建
