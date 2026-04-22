# Cloud Code 部署指南

> 涵盖本地开发、生产部署、Docker 和反向代理配置

---

## 目录

- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产部署](#生产部署)
  - [systemd 服务](#systemd-服务)
  - [PM2 部署](#pm2-部署)
  - [Docker 部署](#docker-部署)
  - [Docker Compose](#docker-compose)
- [反向代理配置](#反向代理配置)
  - [Nginx](#nginx)
  - [Caddy](#caddy)
- [环境变量详解](#环境变量详解)
- [数据管理](#数据管理)
- [SSL/TLS 配置](#ssltls-配置)
- [故障排查](#故障排查)

---

## 环境要求

- **Node.js**: 20 LTS
- **包管理器**: pnpm
- **操作系统**: Linux/macOS/Windows
- **现代浏览器**: Chrome, Firefox, Safari, Edge

---

## 本地开发

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
# 编辑 .env，填入必需的 API 配置
```

### 3. 启动服务

```bash
# 方式一：使用管理脚本（推荐）
chmod +x manager.sh
./manager.sh start

# 方式二：pnpm 命令（同时启动前后端）
pnpm dev:all

# 方式三：分别启动（不同终端）
pnpm dev:backend   # 终端 1
cd .. && pnpm dev  # 终端 2
```

### 4. 验证服务

- 前端: http://localhost:18766
- 后端 API: http://localhost:18765/api/health
- WebSocket: ws://localhost:18765/ws

---

## 生产部署

### systemd 服务

适用于大多数 Linux 发行版。

1. **构建生产版本**

```bash
pnpm build
```

2. **创建 systemd 服务文件**

```bash
sudo nano /etc/systemd/system/cloud-code.service
```

内容：

```ini
[Unit]
Description=Cloud Code Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cloud-code
EnvironmentFile=/path/to/cloud-code/backend/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node backend/dist/server.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

3. **启用并启动服务**

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloud-code
sudo systemctl start cloud-code

# 查看状态
sudo systemctl status cloud-code

# 查看日志
sudo journalctl -u cloud-code -f
```

---

### PM2 部署

适用于需要进程管理和负载均衡的场景。

1. **全局安装 PM2**

```bash
npm install -g pm2
```

2. **创建 ecosystem.config.js**

```javascript
module.exports = {
  apps: [
    {
      name: 'cloud-code-backend',
      script: './backend/dist/server.js',
      cwd: '/path/to/cloud-code',
      env: {
        NODE_ENV: 'production',
        PORT: 18765
      },
      env_file: './backend/.env',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true
    }
  ]
}
```

3. **启动**

```bash
cd /path/to/cloud-code
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

### Docker 部署

1. **构建镜像**

```bash
docker build -t cloud-code .
```

2. **运行容器**

```bash
docker run -d \
  --name cloud-code \
  --restart unless-stopped \
  -p 18765:18765 \
  -e ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic \
  -e ANTHROPIC_AUTH_TOKEN=your-api-key \
  -e API_KEY=your-access-key \
  -v ~/.cloud-code:/app/.cloud-code \
  cloud-code
```

3. **Dockerfile 示例**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN pnpm build

# 暴露端口
EXPOSE 18765

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:18765/api/health || exit 1

# 启动
CMD ["node", "backend/dist/server.js"]
```

---

### Docker Compose

`docker-compose.yml`：

```yaml
version: '3.8'

services:
  cloud-code:
    build: .
    container_name: cloud-code
    restart: unless-stopped
    ports:
      - "18765:18765"
    environment:
      - NODE_ENV=production
      - PORT=18765
      - ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - API_KEY=${API_KEY:-}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - ./data:/app/.cloud-code
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18765/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 可选：使用 Nginx 作为前端静态文件服务器
  nginx:
    image: nginx:alpine
    container_name: cloud-code-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - cloud-code
```

启动：

```bash
docker-compose up -d
```

---

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /path/to/cloud-code/frontend/dist;
    index index.html;

    # 前端路由支持（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:18765;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:18765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # WebSocket 长连接
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### Caddy

```
your-domain.com {
    # 前端静态文件
    root * /path/to/cloud-code/frontend/dist
    try_files {path} /index.html
    file_server

    # API 代理
    handle_path /api/* {
        reverse_proxy localhost:18765
    }

    # WebSocket 代理
    handle_path /ws {
        reverse_proxy localhost:18765
    }

    # 自动 HTTPS
    tls your-email@example.com
}
```

---

## 环境变量详解

### 必需变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | Claude API 基础 URL | `https://open.bigmodel.cn/api/anthropic` |
| `ANTHROPIC_AUTH_TOKEN` | API 认证密钥 | `your-api-key` |

### 可选变量

| 变量 | 说明 | 默认值 | 备注 |
|------|------|--------|------|
| `PORT` | 后端端口 | `18765` | |
| `LOG_LEVEL` | 日志级别 | `info` | `debug`/`info`/`warn`/`error` |
| `NODE_ENV` | 运行环境 | `development` | 生产环境设为 `production` |
| `API_KEY` | 访问控制密钥 | - | 设置后需认证 |
| `ALLOWED_ORIGINS` | CORS 来源 | `*` | 逗号分隔，生产环境建议限制 |
| `ANTHROPIC_API_KEY` | Claude 原生 API Key | - | 如果使用原生 API |

### 智谱 API 配置示例

```env
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zhipu-api-key
```

---

## 数据管理

### 数据存储位置

```
~/.cloud-code/
├── data.json          # 会话列表和配置
└── messages/          # 各会话消息历史
    ├── {conv-id}.json
    └── ...
```

### 备份

```bash
# 手动备份
cp ~/.cloud-code/data.json ~/cloud-code-backup-$(date +%Y%m%d).json
cp -r ~/.cloud-code/messages ~/cloud-code-messages-backup-$(date +%Y%m%d)

# 自动备份脚本（添加到 crontab）
0 2 * * * cp ~/.cloud-code/data.json ~/backups/cloud-code-$(date +\%Y\%m\%d).json
```

### 迁移

```bash
# 从机器 A 迁移到机器 B
# 在 A 上：
tar -czf cloud-code-data.tar.gz ~/.cloud-code

# 在 B 上：
tar -xzf cloud-code-data.tar.gz -C ~/
```

---

## SSL/TLS 配置

### Nginx + Let's Encrypt

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期（默认已配置）
sudo certbot renew --dry-run
```

### Caddy（自动 HTTPS）

Caddy 内置自动 HTTPS，无需额外配置。

---

## 故障排查

### 服务无法启动

```bash
# 检查日志
./manager.sh logs backend

# 检查端口占用
lsof -i :18765
lsof -i :18766

# 检查环境变量
cat backend/.env
```

### WebSocket 连接失败

- 检查防火墙是否放行端口
- 检查反向代理的 WebSocket 配置
- 检查 `ALLOWED_ORIGINS` 是否包含前端域名

### API 认证失败

- 检查 `API_KEY` 是否正确设置
- 检查请求头 `x-api-key` 或 `Authorization: Bearer`

更多排查信息见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 安全建议

1. **使用 HTTPS**: 生产环境必须启用
2. **设置 API_KEY**: 防止未授权访问
3. **限制 ALLOWED_ORIGINS**: 只允许可信来源
4. **保护 .env 文件**: 权限设为 600，不要提交到版本控制
5. **定期备份**: 设置自动备份任务
6. **更新依赖**: 定期运行 `pnpm update` 和 `npm audit`
