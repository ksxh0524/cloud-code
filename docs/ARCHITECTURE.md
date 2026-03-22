# Cloud Code 系统架构

## 概述

Cloud Code 是一个 Web 应用，让用户可以通过手机浏览器使用电脑上的 Claude Code CLI。系统采用前后端分离架构，通过 WebSocket 实现实时终端通信。

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│                 │ ◄─────────────────► │                 │
│   Frontend      │     REST API       │   Backend       │
│   (React)       │ ◄─────────────────► │   (FastAPI)     │
│                 │                     │                 │
└─────────────────┘                     └────────┬────────┘
                                                 │
                                                 │ PTY
                                                 ▼
                                        ┌─────────────────┐
                                        │                 │
                                        │   Claude Code   │
                                        │   CLI Process   │
                                        │                 │
                                        └─────────────────┘
```

---

## 技术栈

### 前端
- **React 19**: UI 框架
- **Vite**: 构建工具
- **TypeScript**: 类型安全
- **xterm.js**: 终端模拟器
- **TailwindCSS**: 样式

### 后端
- **FastAPI**: Python Web 框架
- **SQLAlchemy**: ORM
- **SQLite**: 数据库
- **pexpect**: PTY 进程管理
- **WebSocket**: 实时通信

---

## 核心组件

### 1. 前端组件

```
frontend/src/
├── App.tsx              # 主应用入口
├── main.tsx             # React 渲染入口
├── types.ts             # TypeScript 类型定义
├── components/
│   ├── Terminal.tsx     # xterm.js 终端组件
│   ├── MessageList.tsx  # 消息列表
│   ├── InputBox.tsx     # 输入框
│   └── ...
├── hooks/
│   ├── useWebSocket.ts  # WebSocket 连接管理
│   └── useConversation.ts # 会话状态管理
├── pages/
│   ├── Chat.tsx         # 主聊天页面
│   └── Settings.tsx     # 设置页面
└── lib/
    └── api.ts           # REST API 封装
```

### 2. 后端组件

```
backend_py/app/
├── main.py              # FastAPI 应用入口
├── config.py            # 配置管理
├── database.py          # 数据库连接
├── models/              # SQLAlchemy 模型
│   ├── conversation.py
│   ├── message.py
│   └── config.py
├── routers/
│   └── web.py           # REST API 路由
└── services/
    ├── cli_service.py   # CLI 进程管理
    ├── conversation_service.py
    ├── config_service.py
    └── ws_manager.py    # WebSocket 连接管理
```

---

## 数据流

### 创建会话流程

```
1. 用户点击"新建会话"
2. 前端 POST /api/conversations
3. 后端创建数据库记录
4. 返回会话 ID
5. 前端建立 WebSocket 连接
6. 后端启动 CLI 进程
7. 发送 "started" 状态
```

### 终端交互流程

```
┌──────────┐     input      ┌──────────┐     write     ┌──────────┐
│  用户    │ ──────────────► │ Frontend │ ────────────► │ WebSocket │
│  输入    │                │          │               │  Server  │
└──────────┘                └──────────┘               └────┬─────┘
                                                            │
                                                            ▼
┌──────────┐    output     ┌──────────┐    read      ┌──────────┐
│  前端    │ ◄──────────── │ WebSocket │ ◄────────── │   PTY    │
│  渲染    │               │  Server  │             │ Process  │
└──────────┘               └──────────┘             └──────────┘
```

---

## 数据库模型

### Conversation (会话)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| name | String | 会话名称 |
| workDir | String | 工作目录 |
| cliType | String | CLI 类型 (claude/opencode) |
| feishuChatId | String | 飞书聊天 ID (可选) |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Config (配置)

| 字段 | 类型 | 说明 |
|------|------|------|
| key | String | 配置键 |
| value | JSON | 配置值 |

---

## CLI 会话管理

### Session 类

```python
@dataclass
class Session:
    conversation_id: str
    work_dir: str
    cli_type: str
    process: pexpect.spawn  # PTY 进程
    output_callback: Callable  # 输出回调
```

### 生命周期

1. **创建**: WebSocket 连接时创建 Session
2. **运行**: 通过 PTY 与 CLI 进程交互
3. **销毁**: WebSocket 断开时终止进程

### 进程管理

- 使用 `pexpect.spawn` 创建伪终端
- 非阻塞读取输出
- 进程组管理（确保子进程也被终止）

---

## WebSocket 消息类型

### 客户端 → 服务端

| 类型 | 说明 | 数据 |
|------|------|------|
| input | 用户输入 | `{input: string}` |
| resize | 终端大小变化 | `{cols: number, rows: number}` |

### 服务端 → 客户端

| 类型 | 说明 | 数据 |
|------|------|------|
| output | 终端输出 | string (ANSI) |
| status | 会话状态 | `{status: string, cliType: string}` |
| error | 错误信息 | `{error: string}` |

---

## 安全考虑

1. **本地访问**: 默认只监听 localhost
2. **工作目录限制**: 只能访问配置的工作目录
3. **进程隔离**: 每个会话独立的 PTY 进程
4. **无认证**: 适合本地/内网使用，公网部署需添加认证

---

## 扩展性

### 添加新的 CLI 类型

1. 在 `cli_service.py` 的 `CLI_COMMANDS` 中添加命令
2. 在 `get_supported_cli_types()` 中添加描述
3. 前端会自动显示新选项

### 添加飞书集成

1. 在设置页面配置飞书机器人信息
2. 后端通过飞书 API 发送/接收消息
3. 支持多个飞书群绑定不同会话
