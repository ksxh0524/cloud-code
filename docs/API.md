# Cloud Code API 文档

## 概述

Cloud Code 提供两种 API 接口：
- **REST API**: 用于会话管理、配置等操作
- **WebSocket**: 用于实时终端通信

基础 URL: `http://localhost:18765`

---

## REST API

### 健康检查

#### `GET /api/health`

检查服务状态。

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2024-03-22T10:30:00.000Z"
}
```

---

### CLI 类型

#### `GET /api/cli-types`

获取支持的 CLI 类型列表。

**响应示例：**
```json
[
  {
    "type": "claude",
    "name": "Claude Code",
    "description": "Anthropic 官方 CLI 工具"
  },
  {
    "type": "opencode",
    "name": "OpenCode",
    "description": "开源 AI 编程助手"
  }
]
```

#### `GET /api/cli-check/{cli_type}`

检查指定 CLI 是否已安装。

**响应示例：**
```json
{
  "installed": true,
  "version": "1.0.0"
}
```

---

### 会话管理

#### `GET /api/conversations`

获取所有会话列表。

**响应示例：**
```json
[
  {
    "id": "uuid-string",
    "name": "我的项目",
    "workDir": "/Users/xxx/projects/my-app",
    "cliType": "claude",
    "feishuChatId": null,
    "createdAt": "2024-03-22T10:00:00",
    "updatedAt": "2024-03-22T10:30:00"
  }
]
```

#### `POST /api/conversations`

创建新会话。

**请求体：**
```json
{
  "name": "会话名称",
  "workDir": "/path/to/project",
  "cliType": "claude"
}
```

**响应示例：**
```json
{
  "id": "new-uuid",
  "name": "会话名称",
  "workDir": "/path/to/project",
  "cliType": "claude",
  "createdAt": "2024-03-22T11:00:00",
  "updatedAt": "2024-03-22T11:00:00"
}
```

#### `GET /api/conversations/{id}`

获取指定会话详情。

#### `PATCH /api/conversations/{id}`

更新会话信息。

**请求体：**
```json
{
  "name": "新名称"
}
```

#### `DELETE /api/conversations/{id}`

删除会话。

---

### 工作目录

#### `GET /api/workdirs`

获取配置的工作目录及其子目录列表。

**响应示例：**
```json
[
  {
    "path": "/Users/xxx/projects",
    "name": "projects",
    "isConfig": true
  },
  {
    "path": "/Users/xxx/projects/my-app",
    "name": "my-app",
    "isConfig": false
  }
]
```

#### `GET /api/directories?path={path}`

获取指定路径的子目录列表。

---

### 配置

#### `GET /api/config`

获取应用配置。

**响应示例：**
```json
{
  "feishu": {
    "appId": "xxx",
    "appSecret": "***",
    "verifyToken": "xxx",
    "encryptKey": "xxx"
  },
  "defaultWorkDir": "/Users/xxx/projects"
}
```

#### `PUT /api/config`

更新应用配置。

**请求体：**
```json
{
  "feishu": {
    "appId": "new-app-id",
    "appSecret": "new-secret"
  },
  "defaultWorkDir": "/new/default/path"
}
```

---

### 会话状态

#### `GET /api/sessions`

获取当前活跃的 CLI 会话。

**响应示例：**
```json
[
  {
    "conversationId": "uuid-string",
    "cliType": "claude",
    "workDir": "/path/to/project",
    "running": true
  }
]
```

#### `DELETE /api/sessions`

停止所有 CLI 会话。

---

## WebSocket API

### 连接

**端点**: `ws://localhost:18765/ws?conversationId={id}`

连接时必须提供 `conversationId` 参数。

### 客户端消息

#### 输入命令

```json
{
  "type": "input",
  "data": {
    "input": "用户输入的命令或文本"
  }
}
```

#### 调整终端大小

```json
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}
```

### 服务端消息

#### 终端输出

```json
{
  "type": "output",
  "conversationId": "uuid-string",
  "data": "终端输出内容（ANSI 转义序列）"
}
```

#### 会话状态

```json
{
  "type": "status",
  "conversationId": "uuid-string",
  "data": {
    "status": "started",
    "cliType": "claude"
  }
}
```

#### 错误消息

```json
{
  "type": "error",
  "conversationId": "uuid-string",
  "data": {
    "error": "错误描述"
  }
}
```

---

## 错误处理

所有 API 错误遵循以下格式：

```json
{
  "detail": "错误描述信息"
}
```

### 常见错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数无效 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 示例代码

### JavaScript (WebSocket)

```javascript
const ws = new WebSocket('ws://localhost:18765/ws?conversationId=xxx')

ws.onopen = () => {
  console.log('Connected')
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log('Received:', msg.type, msg.data)
}

// 发送输入
ws.send(JSON.stringify({
  type: 'input',
  data: { input: 'hello' }
}))
```

### Python (WebSocket)

```python
import asyncio
import websockets
import json

async def connect():
    uri = "ws://localhost:18765/ws?conversationId=xxx"
    async with websockets.connect(uri) as ws:
        # 发送消息
        await ws.send(json.dumps({
            "type": "input",
            "data": {"input": "hello"}
        }))

        # 接收消息
        msg = await ws.recv()
        print(json.loads(msg))

asyncio.run(connect())
```
