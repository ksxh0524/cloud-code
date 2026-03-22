# Cloud Code

在手机上方便地使用电脑上的 Claude Code CLI。

## 功能

- 📱 移动端优化的 Web 界面
- 💬 完整的 Claude Code / OpenCode 对话功能
- 🛠️ 工具调用可视化（可折叠展开）
- 📁 支持多会话和目录管理
- 🤖 飞书机器人集成

## 环境要求

- **Node.js**: 18+
- **Python**: 3.10+
- **Claude Code CLI** 或 **OpenCode CLI**

## 技术栈

- **后端**: Python (FastAPI) + SQLite
- **前端**: React 19 + Vite + TypeScript
- **通信**: WebSocket

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动后端
cd backend_py
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 18765 --reload

# 启动前端（另一个终端）
pnpm dev

# 访问
# 前端: http://localhost:18766
# 后端: http://localhost:18765
# API文档: http://localhost:18765/docs
```

## 使用

1. 打开 `http://localhost:18766`
2. 创建新会话，选择工作目录
3. 开始对话

## 项目结构

```
cloud-code/
├── backend_py/       # FastAPI 后端
│   ├── app/
│   │   ├── main.py       # 应用入口
│   │   ├── routers/      # API 路由
│   │   ├── services/     # 业务逻辑
│   │   └── models/       # 数据模型
│   └── requirements.txt
├── frontend/         # React 前端
│   └── src/
│       ├── components/   # UI 组件
│       ├── hooks/        # 自定义 Hooks
│       ├── pages/        # 页面
│       └── types.ts      # 类型定义
├── docs/             # 文档
├── test/             # E2E 测试
└── scripts/          # 工具脚本
```

## 文档

- [API 文档](docs/API.md) - REST API 和 WebSocket 协议
- [系统架构](docs/ARCHITECTURE.md) - 技术架构说明
- [部署指南](docs/DEPLOYMENT.md) - 生产环境部署
- [故障排查](docs/TROUBLESHOOTING.md) - 常见问题解决

## 配置飞书

在设置页面配置飞书机器人信息：
- App ID
- App Secret
- Verify Token
- Encrypt Key

## 常见问题

### CLI 未找到

确保已安装 Claude Code CLI:
```bash
claude --version
```

如果未安装，参考 [Claude Code 官方文档](https://docs.anthropic.com/claude-code)。

### WebSocket 连接失败

1. 确认后端正在运行
2. 检查防火墙设置
3. 查看 [故障排查指南](docs/TROUBLESHOOTING.md)

## 开发

```bash
# 运行测试
npx playwright test

# 构建生产版本
pnpm build
```

## License

MIT
