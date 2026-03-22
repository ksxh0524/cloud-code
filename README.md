# Cloud Code

在手机上方便地使用电脑上的 Claude Code CLI。

## 功能

- 📱 移动端优化的 Web 界面
- 💬 完整的 Claude Code 对话功能
- 🛠️ 工具调用可视化（可折叠展开）
- 📁 支持多会话和目录管理
- 🤖 飞书机器人集成

## 技术栈

- **后端**: Node.js + Hono + SQLite
- **前端**: React + Vite
- **通信**: WebSocket

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 使用

1. 打开 `http://localhost:5173`
2. 创建新会话，选择工作目录
3. 开始对话

## 配置飞书

在设置页面配置飞书机器人信息：
- App ID
- App Secret
- Verify Token
- Encrypt Key

## 项目结构

```
cloud-code/
├── backend/          # Hono 后端
├── frontend/         # React 前端
└── shared/           # 共享类型
```
