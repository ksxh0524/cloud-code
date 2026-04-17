# Cloud Code 部署指南

## 环境要求

- Node.js 18+
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

---

## 本地开发部署

### 1. 安装依赖

```bash
git clone <repository-url>
cd cloud-code

# 前端依赖
pnpm install

# 后端依赖
cd backend && pnpm install
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_BASE_URL 和 ANTHROPIC_AUTH_TOKEN
```

### 3. 启动服务

**终端 1 - 后端:**

```bash
cd backend && pnpm dev
```

**终端 2 - 前端:**

```bash
pnpm dev
```

### 4. 访问应用

- 前端: http://localhost:18766
- 后端 API: http://localhost:18765/api/health
- WebSocket: ws://localhost:18765

---

## 生产环境部署

### 方式一: 直接部署

```bash
# 构建前端
pnpm build

# 构建后端
cd backend && pnpm build

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
WorkingDirectory=/path/to/cloud-code/backend
EnvironmentFile=/path/to/cloud-code/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 方式二: Docker 部署

```dockerfile
FROM node:20-slim

WORKDIR /app

# 后端
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production
COPY backend/tsconfig.json .
COPY backend/src ./src
RUN npm run build

# 前端
COPY frontend/dist ./public

EXPOSE 18765

CMD ["node", "dist/server.js"]
```

---

## 反向代理

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/cloud-code/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:18765;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
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

    handle {
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

---

## 数据存储

应用数据存储在 `~/.cloud-code/data.json`，包含会话列表和配置信息。

备份:

```bash
cp ~/.cloud-code/data.json ~/cloud-code-backup-$(date +%Y%m%d).json
```

---

## 安全建议

1. **使用 HTTPS**: 生产环境必须启用
2. **限制访问**: 使用防火墙限制来源
3. **保护 API Key**: 不要将 `.env` 文件提交到版本控制
