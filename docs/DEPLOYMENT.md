# Cloud Code 部署指南

## 环境要求

- Node.js 18+
- pnpm
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

---

## 本地开发部署

### 1. 安装依赖

```bash
git clone <repository-url>
cd cloud-code
pnpm install
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_BASE_URL 和 ANTHROPIC_AUTH_TOKEN
```

### 3. 启动服务

```bash
# 同时启动前后端
pnpm dev:all
```

### 4. 访问应用

- 前端: http://localhost:18766
- 后端 API: http://localhost:18765/api/health
- WebSocket: ws://localhost:18765/ws

---

## 生产环境部署

### 方式一: 直接部署

```bash
# 构建前端和后端
pnpm build

# 启动后端
cd backend && node dist/server.js
```

使用 systemd 管理:

```ini
[Unit]
Description=Cloud Code Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cloud-code
EnvironmentFile=/path/to/cloud-code/backend/.env
ExecStart=/usr/bin/node backend/dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 方式二: Docker 部署

```bash
# 构建镜像
docker build -t cloud-code .

# 运行容器
docker run -d \
  --name cloud-code \
  -p 18765:18765 \
  -e ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic \
  -e ANTHROPIC_AUTH_TOKEN=your-api-key \
  cloud-code
```

---

## 反向代理

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/cloud-code/frontend/dist;
    try_files $uri $uri/ /index.html;

    location /api {
        proxy_pass http://127.0.0.1:18765;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:18765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Caddy

```
your-domain.com {
    root * /path/to/cloud-code/frontend/dist
    try_files {path} /index.html
    file_server

    handle /api/* {
        reverse_proxy localhost:18765
    }

    handle /ws {
        reverse_proxy localhost:18765
    }
}
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端端口 | 18765 |
| `ANTHROPIC_BASE_URL` | API 基础 URL | - |
| `ANTHROPIC_AUTH_TOKEN` | API 认证密钥 | - |
| `API_KEY` | API 访问密钥（可选，设置后所有请求需要认证） | - |
| `ALLOWED_ORIGINS` | CORS 允许来源（逗号分隔，默认允许所有） | - |
| `LOG_LEVEL` | 日志级别 | info |
| `NODE_ENV` | 运行环境 | development |

---

## 数据存储

应用数据存储在 `~/.cloud-code/` 目录：
- `data.json` — 会话列表和配置
- `messages/` — 每个会话的消息历史

备份:

```bash
cp ~/.cloud-code/data.json ~/cloud-code-backup-$(date +%Y%m%d).json
cp -r ~/.cloud-code/messages ~/cloud-code-messages-backup-$(date +%Y%m%d)
```

---

## 安全建议

1. **使用 HTTPS**: 生产环境必须启用
2. **设置 API_KEY**: 防止未授权访问
3. **限制 ALLOWED_ORIGINS**: 只允许可信来源
4. **保护 .env 文件**: 不要提交到版本控制
