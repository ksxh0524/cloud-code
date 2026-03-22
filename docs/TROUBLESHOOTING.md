# Cloud Code 故障排查指南

## 常见问题

### CLI 相关

#### 问题: CLI 未安装

**症状:**
- 创建会话后无响应
- 控制台显示 "CLI not found" 错误

**解决方案:**

1. 检查 CLI 是否已安装:
```bash
# Claude Code
claude --version

# OpenCode
opencode --version
```

2. 如果未安装，按照官方文档安装:
   - Claude Code: https://docs.anthropic.com/claude-code
   - OpenCode: https://github.com/opencode-ai/opencode

3. 确保 CLI 在 PATH 中:
```bash
which claude
# 应该输出: /usr/local/bin/claude 或类似路径
```

---

#### 问题: CLI 进程残留

**症状:**
- 会话无法正常启动
- 端口被占用
- 系统资源占用高

**解决方案:**

1. 查看残留进程:
```bash
ps aux | grep claude
ps aux | grep opencode
```

2. 终止残留进程:
```bash
# 方法 1: 通过 API
curl -X DELETE http://localhost:18765/api/sessions

# 方法 2: 手动终止
pkill -f claude
pkill -f opencode
```

---

### WebSocket 相关

#### 问题: WebSocket 连接失败

**症状:**
- 终端显示 "Connecting..." 但无响应
- 控制台显示 WebSocket 错误

**排查步骤:**

1. 检查后端是否运行:
```bash
curl http://localhost:18765/api/health
```

2. 检查会话是否存在:
```bash
curl http://localhost:18765/api/conversations/{conversationId}
```

3. 检查浏览器控制台的 WebSocket 错误信息

4. 如果使用反向代理，检查 WebSocket 代理配置:
```nginx
# Nginx 需要这些配置
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

#### 问题: WebSocket 频繁断开

**症状:**
- 连接建立后很快断开
- 需要频繁刷新页面

**可能原因:**

1. **网络不稳定**: 检查网络连接
2. **代理超时**: 增加代理超时时间
   ```nginx
   proxy_read_timeout 86400;
   ```
3. **后端重启**: 检查后端日志是否有错误

---

### 终端显示相关

#### 问题: 终端显示乱码

**症状:**
- 终端输出包含奇怪的字符
- ANSI 转义序列未正确解析

**解决方案:**

1. 检查终端字体是否支持 Unicode
2. 清除浏览器缓存
3. 检查后端是否正确设置终端类型:
   ```python
   # cli_service.py 中应设置:
   process.env = {..., 'TERM': 'xterm-256color'}
   ```

---

#### 问题: 终端大小不正确

**症状:**
- 文本换行位置不对
- 部分内容被截断

**解决方案:**

1. 手动调整终端大小（拖动窗口）
2. 刷新页面重新建立连接
3. 检查 resize 事件是否正确发送

---

### 数据库相关

#### 问题: 数据库锁定

**症状:**
- 保存设置失败
- 创建会话失败
- 错误信息: "database is locked"

**解决方案:**

1. 确保没有多个后端进程运行
2. 检查数据库文件权限:
   ```bash
   ls -la backend_py/data.db
   ```
3. 如果损坏，可以重建数据库:
   ```bash
   rm backend_py/data.db
   # 重启后端会自动创建新数据库
   ```

---

### 飞书集成相关

#### 问题: 飞书消息发送失败

**症状:**
- 消息未同步到飞书
- 控制台显示飞书 API 错误

**排查步骤:**

1. 检查飞书配置是否正确:
   - App ID
   - App Secret
   - Verify Token
   - Encrypt Key

2. 检查飞书机器人权限:
   - 需要获取用户信息权限
   - 需要发送消息权限

3. 检查飞书 API 是否可访问:
   ```bash
   curl https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"app_id":"YOUR_APP_ID","app_secret":"YOUR_APP_SECRET"}'
   ```

---

## 日志查看

### 后端日志

```bash
# 如果使用 systemd
sudo journalctl -u cloud-code -f

# 如果直接运行
# 查看控制台输出
```

### 前端日志

打开浏览器开发者工具 (F12)，查看 Console 标签。

---

## 性能问题

### 内存占用高

1. 检查活跃会话数量:
   ```bash
   curl http://localhost:18765/api/sessions
   ```

2. 清理不需要的会话

### CPU 占用高

1. 检查是否有异常的 CLI 进程
2. 考虑限制并发会话数量

---

## 获取帮助

如果以上方法无法解决问题：

1. 收集以下信息:
   - 操作系统版本
   - Python 版本 (`python --version`)
   - Node.js 版本 (`node --version`)
   - 错误日志

2. 在 GitHub Issues 中提交问题
