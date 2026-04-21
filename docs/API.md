# Cloud Code API 文档

> REST API 和 WebSocket 协议完整参考

---

## 目录

- [概述](#概述)
- [认证](#认证)
- [REST API](#rest-api)
- [WebSocket 协议](#websocket-协议)
- [数据模型](#数据模型)
- [错误处理](#错误处理)

---

## 概述

### 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Backend API | 18765 | REST + WebSocket |
| Frontend Dev | 18766 | Vite 开发服务器 |

### 基础 URL

```
REST API:   http://localhost:18765/api
WebSocket:  ws://localhost:18765/ws
Health:     http://localhost:18765/api/health
```

---

## 认证

### API Key 认证（可选）

当设置了 `API_KEY` 环境变量时，所有请求需要认证。

#### REST API 认证

方式一：Header

```http
X-API-Key: your-api-key
```

方式二：Bearer Token

```http
Authorization: Bearer your-api-key
```

#### WebSocket 认证

在 `init` 消息中传递：

```json
{
  "type": "init",
  "data": {
    "workDir": "/path",
    "apiKey": "your-api-key"
  }
}
```

---

## REST API

### 健康检查

```http
GET /api/health
```

**响应：**

```json
{
  "status": "ok",
  "version": "0.0.1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 会话管理

#### 获取会话列表

```http
GET /api/conversations
```

**响应：**

```json
{
  "conversations": [
    {
      "id": "uuid-string",
      "name": "会话名称",
      "workDir": "/path/to/project",
      "cliType": "claude",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### 创建会话

```http
POST /api/conversations
Content-Type: application/json
```

**请求体：**

```json
{
  "name": "新会话",
  "workDir": "/path/to/project"
}
```

**响应：**

```json
{
  "id": "uuid-string",
  "name": "新会话",
  "workDir": "/path/to/project",
  "cliType": "claude",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 获取单个会话

```http
GET /api/conversations/:id
```

#### 更新会话

```http
PATCH /api/conversations/:id
Content-Type: application/json
```

**请求体：**

```json
{
  "name": "新名称"
}
```

#### 删除会话

```http
DELETE /api/conversations/:id
```

**响应：**

```json
{
  "success": true
}
```

#### 获取会话消息

```http
GET /api/conversations/:id/messages
```

**响应：**

```json
{
  "messages": [
    {
      "id": "msg-id",
      "role": "user",
      "content": "消息内容",
      "type": "text",
      "timestamp": 1234567890
    }
  ]
}
```

---

### 工作目录

#### 获取默认工作目录列表

```http
GET /api/workdirs
```

**响应：**

```json
{
  "directories": [
    { "path": "/Users/name", "name": "home" },
    { "path": "/Users/name/codes", "name": "codes" }
  ]
}
```

#### 获取子目录

```http
GET /api/directories?path=/Users/name/codes
```

**响应：**

```json
{
  "path": "/Users/name/codes",
  "directories": [
    { "name": "project1", "path": "/Users/name/codes/project1" },
    { "name": "project2", "path": "/Users/name/codes/project2" }
  ]
}
```

---

### 应用配置

#### 获取配置

```http
GET /api/config
```

**响应：**

```json
{
  "defaultWorkDir": "/Users/name/codes"
}
```

#### 更新配置

```http
PUT /api/config
Content-Type: application/json
```

**请求体：**

```json
{
  "defaultWorkDir": "/new/path"
}
```

---

## WebSocket 协议

### 连接

```javascript
const ws = new WebSocket('ws://localhost:18765/ws')
```

### 消息格式

所有消息使用 JSON 格式，结构如下：

```typescript
interface WebSocketMessage {
  type: string
  data: unknown
}
```

### 客户端 → 服务端

#### 1. 初始化 (init)

必须在连接后 10 秒内发送，否则连接将被关闭。

```json
{
  "type": "init",
  "data": {
    "workDir": "/path/to/project",
    "apiKey": "optional-api-key"
  }
}
```

#### 2. 发送消息 (prompt)

```json
{
  "type": "prompt",
  "data": {
    "prompt": "你的问题或指令",
    "workDir": "/path/to/project",
    "conversationId": "optional-conversation-id"
  }
}
```

#### 3. 中断生成 (interrupt)

```json
{
  "type": "interrupt"
}
```

#### 4. 关闭 (close)

```json
{
  "type": "close"
}
```

---

### 服务端 → 客户端

#### 1. 连接成功 (connected)

```json
{
  "type": "connected",
  "data": {
    "sessionId": "uuid-string"
  }
}
```

#### 2. 初始化完成 (initialized)

```json
{
  "type": "initialized",
  "data": {
    "sessionId": "uuid-string"
  }
}
```

#### 3. 完整消息 (message)

```json
{
  "type": "message",
  "data": {
    "role": "assistant",
    "content": "完整消息内容",
    "type": "text"
  }
}
```

#### 4. 流式增量 (stream)

```json
{
  "type": "stream",
  "data": {
    "delta": {
      "text": "文本片段"
    }
  }
}
```

#### 5. 思考过程 (thinking)

```json
{
  "type": "thinking",
  "data": {
    "content": "AI 的思考过程"
  }
}
```

#### 6. 工具调用 (tool_call)

```json
{
  "type": "tool_call",
  "data": {
    "toolName": "Bash",
    "toolInput": {
      "command": "ls -la",
      "description": "列出文件"
    }
  }
}
```

#### 7. 工具结果 (tool_result)

```json
{
  "type": "tool_result",
  "data": {
    "toolName": "Bash",
    "toolOutput": "file1.txt\nfile2.txt",
    "success": true
  }
}
```

#### 8. 完成 (done)

```json
{
  "type": "done",
  "data": null
}
```

#### 9. 错误 (error)

```json
{
  "type": "error",
  "data": "错误描述信息"
}
```

---

### 完整对话流程示例

```javascript
const ws = new WebSocket('ws://localhost:18765/ws')

ws.onopen = () => {
  // 1. 初始化
  ws.send(JSON.stringify({
    type: 'init',
    data: { workDir: '/Users/name/project' }
  }))
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)

  switch (msg.type) {
    case 'connected':
      console.log('WebSocket 连接成功')
      break

    case 'initialized':
      console.log('会话初始化完成')
      // 2. 发送消息
      ws.send(JSON.stringify({
        type: 'prompt',
        data: { prompt: 'Hello!', workDir: '/Users/name/project' }
      }))
      break

    case 'stream':
      // 3. 接收流式响应
      process.stdout.write(msg.data.delta.text)
      break

    case 'tool_call':
      console.log('工具调用:', msg.data.toolName)
      break

    case 'tool_result':
      console.log('工具结果:', msg.data.toolOutput)
      break

    case 'done':
      console.log('响应完成')
      break

    case 'error':
      console.error('错误:', msg.data)
      break
  }
}
```

---

## 数据模型

### Conversation（会话）

```typescript
interface Conversation {
  id: string           // UUID
  name: string         // 会话名称
  workDir: string      // 工作目录路径
  cliType: 'claude'    // CLI 类型
  createdAt: string    // ISO 8601 时间
  updatedAt: string    // ISO 8601 时间
}
```

### Message（消息）

```typescript
interface Message {
  id: string           // 唯一标识
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string      // 消息内容
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  metadata?: {         // 工具调用元数据
    toolName?: string
    toolInput?: object
    toolOutput?: string
  }
  timestamp: number    // Unix 时间戳（毫秒）
}
```

### Tool（工具）

支持的 Claude Agent SDK 工具：

| 工具 | 用途 | 示例输入 |
|------|------|---------|
| `Read` | 读取文件 | `{ "file_path": "/path/to/file" }` |
| `Edit` | 编辑文件 | `{ "file_path": "/path/to/file", "old_string": "...", "new_string": "..." }` |
| `Bash` | 执行命令 | `{ "command": "ls -la", "description": "列出文件" }` |
| `Glob` | 文件搜索 | `{ "pattern": "**/*.ts" }` |
| `Grep` | 内容搜索 | `{ "pattern": "function", "path": "/path" }` |

---

## 错误处理

### HTTP 状态码

| 状态码 | 含义 | 场景 |
|--------|------|------|
| 200 | 成功 | 正常响应 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未认证 | API Key 缺失或无效 |
| 403 | 禁止访问 | 路径不在允许范围内 |
| 404 | 未找到 | 会话或资源不存在 |
| 429 | 请求过多 | 超出速率限制 |
| 500 | 服务器错误 | 内部错误 |

### 错误响应格式

```json
{
  "error": "错误类型",
  "message": "详细错误信息",
  "details": {}
}
```

### WebSocket 错误

- 连接后立即关闭：未发送 init 消息或超时
- 收到 error 消息：处理请求时出错
- 连接异常关闭：网络问题或服务器重启

---

## 速率限制

默认限制：100 请求/分钟

超过限制时返回：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

---

## 附录

### curl 示例

```bash
# 健康检查
curl http://localhost:18765/api/health

# 创建会话
curl -X POST http://localhost:18765/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"name":"Test","workDir":"/Users/name"}'

# 获取会话列表
curl http://localhost:18765/api/conversations \
  -H "Authorization: Bearer your-key"
```

### WebSocket 测试

```bash
# 使用 wscat
npm install -g wscat

wscat -c ws://localhost:18765/ws

# 发送 init
> {"type":"init","data":{"workDir":"/Users/name"}}

# 发送消息
> {"type":"prompt","data":{"prompt":"Hello","workDir":"/Users/name"}}
```
