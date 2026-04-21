# Cloud Code 故障排查指南

> 常见问题、错误码对照和性能调优

---

## 目录

- [快速诊断](#快速诊断)
- [常见问题](#常见问题)
- [错误码对照](#错误码对照)
- [日志分析](#日志分析)
- [性能问题](#性能问题)
- [网络问题](#网络问题)
- [数据恢复](#数据恢复)

---

## 快速诊断

### 一键诊断脚本

```bash
#!/bin/bash
# diagnose.sh - 快速诊断脚本

echo "=== Cloud Code 诊断报告 ==="
echo ""

echo "[1] 检查 Node.js 版本..."
node --version || echo "❌ Node.js 未安装"

echo ""
echo "[2] 检查 pnpm 版本..."
pnpm --version || echo "❌ pnpm 未安装"

echo ""
echo "[3] 检查端口占用..."
lsof -i :18765 && echo "⚠️ 端口 18765 被占用" || echo "✅ 端口 18765 可用"
lsof -i :18766 && echo "⚠️ 端口 18766 被占用" || echo "✅ 端口 18766 可用"

echo ""
echo "[4] 检查环境变量..."
if [ -f "backend/.env" ]; then
  echo "✅ backend/.env 存在"
  grep "ANTHROPIC_BASE_URL" backend/.env > /dev/null && echo "✅ ANTHROPIC_BASE_URL 已配置" || echo "❌ ANTHROPIC_BASE_URL 未配置"
  grep "ANTHROPIC_AUTH_TOKEN" backend/.env > /dev/null && echo "✅ ANTHROPIC_AUTH_TOKEN 已配置" || echo "❌ ANTHROPIC_AUTH_TOKEN 未配置"
else
  echo "❌ backend/.env 不存在"
fi

echo ""
echo "[5] 检查依赖安装..."
[ -d "node_modules" ] && echo "✅ 根目录依赖已安装" || echo "❌ 根目录依赖未安装"
[ -d "backend/node_modules" ] && echo "✅ Backend 依赖已安装" || echo "❌ Backend 依赖未安装"
[ -d "frontend/node_modules" ] && echo "✅ Frontend 依赖已安装" || echo "❌ Frontend 依赖未安装"

echo ""
echo "[6] 检查服务状态..."
./manager.sh status

echo ""
echo "[7] 测试 API 连通性..."
curl -s http://localhost:18765/api/health && echo "✅ API 正常" || echo "❌ API 无法访问"

echo ""
echo "=== 诊断完成 ==="
```

---

## 常见问题

### 1. 服务启动失败

#### 现象

```
./manager.sh start
✗ Backend 启动失败
```

#### 排查步骤

1. **检查日志**

```bash
./manager.sh logs backend
tail -f logs/backend.log
```

2. **检查环境变量**

```bash
cat backend/.env
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_AUTH_TOKEN
```

3. **检查端口占用**

```bash
lsof -i :18765
# 或
netstat -tlnp | grep 18765
```

4. **手动启动查看详细错误**

```bash
cd backend
pnpm dev
```

#### 常见原因

| 原因 | 解决 |
|------|------|
| `.env` 不存在 | `cp backend/.env.example backend/.env` 并配置 |
| API 配置错误 | 检查 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN` |
| 端口被占用 | 更换端口或杀掉占用进程 `kill -9 <PID>` |
| 依赖未安装 | 运行 `pnpm install` |
| Node.js 版本过低 | 升级到 18+ |

---

### 2. WebSocket 连接失败

#### 现象

```
WebSocket connection failed
Connection refused
```

#### 排查步骤

1. **检查后端是否运行**

```bash
curl http://localhost:18765/api/health
```

2. **检查 WebSocket 端点**

```bash
# 使用 wscat 测试
npm install -g wscat
wscat -c ws://localhost:18765/ws
```

3. **检查浏览器控制台**

打开浏览器开发者工具 → Network → WS，查看连接详情。

#### 常见原因

| 原因 | 解决 |
|------|------|
| 后端未启动 | `./manager.sh start` |
| CORS 限制 | 检查 `ALLOWED_ORIGINS` |
| 防火墙/代理 | 检查网络配置 |
| SSL/TLS 问题 | 使用 `ws://` 而非 `wss://`（本地） |

---

### 3. API 认证失败

#### 现象

```
401 Unauthorized
API Key authentication failed
```

#### 排查步骤

1. **检查是否设置了 `API_KEY`**

```bash
grep API_KEY backend/.env
```

2. **检查请求头**

```bash
# REST API
curl -H "X-API-Key: your-key" http://localhost:18765/api/conversations

# WebSocket - 在 init 消息中发送
echo '{"type":"init","data":{"workDir":"/path","apiKey":"your-key"}}' | wscat -c ws://localhost:18765/ws
```

3. **检查 API Key 是否正确**

确保前后端使用的 Key 一致。

---

### 4. 前端无法访问

#### 现象

```
Cannot GET /
404 Not Found
```

#### 排查步骤

1. **检查前端是否运行**

```bash
curl http://localhost:18766
```

2. **检查 Vite 配置**

```bash
cat frontend/vite.config.ts | grep -A 10 "server"
```

3. **检查端口占用**

```bash
lsof -i :18766
```

---

### 5. Claude Agent 无响应

#### 现象

```
发送消息后无响应
一直显示"思考中..."
```

#### 排查步骤

1. **检查 API 配置**

```bash
# 测试 API 连通性
curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
  $ANTHROPIC_BASE_URL/v1/messages
```

2. **检查日志**

```bash
./manager.sh logs backend
```

3. **检查网络代理**

```bash
# 检查代理设置
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 临时禁用代理测试
unset HTTP_PROXY HTTPS_PROXY
```

#### 常见原因

| 原因 | 解决 |
|------|------|
| API Key 无效 | 重新获取 API Key |
| 网络不通 | 检查网络，使用代理 |
| 额度耗尽 | 检查 API 账户余额 |
| 模型不可用 | 检查 `ANTHROPIC_BASE_URL` 配置 |

---

## 错误码对照

### HTTP 状态码

| 状态码 | 含义 | 常见原因 |
|--------|------|---------|
| 200 | 成功 | - |
| 400 | 请求错误 | 参数缺失或格式错误 |
| 401 | 未认证 | API Key 缺失或无效 |
| 403 | 禁止访问 | 路径不在允许范围内 |
| 404 | 未找到 | 会话 ID 不存在 |
| 429 | 请求过多 | 超出速率限制 |
| 500 | 服务器错误 | 内部异常 |
| 502 | 网关错误 | 反向代理配置问题 |
| 503 | 服务不可用 | 后端未启动 |

### WebSocket 错误码

| 状态码 | 含义 | 解决 |
|--------|------|------|
| 1000 | 正常关闭 | - |
| 1001 | 离开页面 | 刷新后自动重连 |
| 1006 | 异常关闭 | 检查网络/后端 |
| 1008 | 策略违规 | 检查认证 |
| 1011 | 服务器错误 | 查看后端日志 |

### 错误消息对照

| 错误消息 | 原因 | 解决 |
|---------|------|------|
| `Missing ANTHROPIC_BASE_URL` | 环境变量未设置 | 配置 `.env` |
| `Missing ANTHROPIC_AUTH_TOKEN` | 环境变量未设置 | 配置 `.env` |
| `Path not allowed` | 路径不在白名单 | 使用 ~/ 或 ~/codes/ |
| `Conversation not found` | 会话 ID 不存在 | 检查 ID 或创建新会话 |
| `Failed to initialize agent` | Agent 初始化失败 | 检查 API 配置 |
| `Rate limit exceeded` | 请求过于频繁 | 等待后重试 |

---

## 日志分析

### 日志位置

```
logs/
├── backend.log    # 后端日志
└── frontend.log   # 前端日志（如果使用 manager.sh）
```

### 日志级别

```bash
# backend/.env
LOG_LEVEL=debug    # 调试模式
LOG_LEVEL=info     # 正常
LOG_LEVEL=warn     # 仅警告
LOG_LEVEL=error    # 仅错误
```

### 常见日志模式

#### 正常启动

```
[14:32:01] INFO: Server started on port 18765
[14:32:01] INFO: WebSocket server initialized
[14:32:02] INFO: Agent service ready
```

#### WebSocket 连接

```
[14:32:05] INFO: Client connected (session: xxx)
[14:32:05] INFO: Session initialized: xxx
[14:32:10] INFO: Streaming message...
[14:32:15] INFO: Message complete
[14:32:20] INFO: Client disconnected
```

#### 错误日志

```
[14:32:01] ERROR: Failed to initialize agent
[14:32:01] ERROR: Error: Missing ANTHROPIC_AUTH_TOKEN
```

### 日志过滤

```bash
# 查看错误
grep ERROR logs/backend.log

# 查看特定会话
grep "session: xxx" logs/backend.log

# 实时查看
tail -f logs/backend.log | grep ERROR
```

---

## 性能问题

### 1. 响应缓慢

#### 诊断

```bash
# 检查系统资源
top / htop
df -h
free -m

# 检查后端负载
curl http://localhost:18765/api/health
```

#### 优化建议

| 问题 | 解决 |
|------|------|
| 内存不足 | 增加内存或限制并发 |
| 磁盘空间满 | 清理日志 `./manager.sh clean` |
| 消息过多 | 清理旧会话 |
| 网络延迟 | 使用 CDN 或优化 API |

---

### 2. WebSocket 延迟高

#### 原因

- 消息体积过大
- 网络不稳定
- 服务器负载高

#### 解决

```bash
# 检查消息大小
cat ~/.cloud-code/messages/*.json | wc -c

# 清理大消息
cd ~/.cloud-code/messages
ls -lhS | head -10
```

---

### 3. 前端卡顿

#### 诊断

1. 打开浏览器开发者工具 → Performance
2. 录制性能分析
3. 查看 Long Tasks

#### 常见原因

| 原因 | 解决 |
|------|------|
| 消息过多 | 实现分页或虚拟列表 |
| Markdown 渲染慢 | 限制消息长度 |
| 图片未优化 | 压缩图片 |
| 内存泄漏 | 检查组件卸载 |

---

## 网络问题

### 代理配置

```bash
# 配置代理
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080

# 排除本地地址
export NO_PROXY=localhost,127.0.0.1

# 在 backend/.env 中添加
NODE_ENV=development
# 如果需要，在代码中手动配置 axios/fetch 代理
```

### 防火墙配置

```bash
# Linux - 开放端口
sudo ufw allow 18765/tcp
sudo ufw allow 18766/tcp

# macOS
# 系统偏好设置 → 安全性与隐私 → 防火墙
```

---

## 数据恢复

### 备份恢复

```bash
# 手动备份
cp ~/.cloud-code/data.json ~/cloud-code-backup-$(date +%Y%m%d).json
cp -r ~/.cloud-code/messages ~/cloud-code-messages-backup-$(date +%Y%m%d)

# 恢复
cp ~/cloud-code-backup-20240101.json ~/.cloud-code/data.json
cp -r ~/cloud-code-messages-backup-20240101/* ~/.cloud-code/messages/
```

### 数据损坏修复

```bash
# 如果 data.json 损坏
# 1. 备份
mv ~/.cloud-code/data.json ~/.cloud-code/data.json.bak

# 2. 创建空文件
echo '{"conversations":[],"config":{}}' > ~/.cloud-code/data.json

# 3. 从 messages 目录重建会话列表
# 需要手动或通过脚本重建
```

---

## 获取帮助

如果以上方法无法解决问题：

1. **查看日志**：`./manager.sh logs`
2. **运行诊断**：运行上方的诊断脚本
3. **提交 Issue**：https://github.com/ksxh0524/cloud-code/issues
4. **提供信息**：
   - 操作系统版本
   - Node.js 版本
   - 错误日志（脱敏后）
   - 复现步骤

---

## 相关文档

- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
- [API.md](API.md) - API 文档
- [TESTING.md](TESTING.md) - 测试指南
