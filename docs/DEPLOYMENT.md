# Cloud Code 部署指南

## 环境要求

### 服务器端
- **Python**: 3.10+
- **Node.js**: 18+ (用于构建前端)
- **SQLite**: 3.x

### 客户端
- 现代浏览器 (Chrome, Firefox, Safari, Edge)
- 移动端浏览器支持

---

## 本地开发部署

### 1. 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd cloud-code

# 安装前端依赖
pnpm install

# 创建 Python 虚拟环境
cd backend_py
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装 Python 依赖
pip install -r requirements.txt
```

### 2. 启动服务

**终端 1 - 后端:**
```bash
cd backend_py
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 18765 --reload
```

**终端 2 - 前端:**
```bash
pnpm dev
```

### 3. 访问应用

- 前端: http://localhost:18766
- 后端 API: http://localhost:18765
- API 文档: http://localhost:18765/docs

---

## 生产环境部署

### 方式一: 直接部署

#### 1. 构建前端

```bash
pnpm build
```

构建产物位于 `frontend/dist/` 目录。

#### 2. 配置后端

创建生产环境配置:

```bash
# backend_py/.env
CORS_ORIGINS=["https://your-domain.com"]
```

#### 3. 启动后端 (使用 Gunicorn)

```bash
cd backend_py
source venv/bin/activate
pip install gunicorn

gunicorn app.main:app \
  --workers 1 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:18765 \
  --access-logfile - \
  --error-logfile -
```

> **注意**: 由于使用了 PTY 进程管理，建议只使用 1 个 worker。

#### 4. 使用 systemd 管理服务

创建 `/etc/systemd/system/cloud-code.service`:

```ini
[Unit]
Description=Cloud Code Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cloud-code/backend_py
Environment="PATH=/path/to/cloud-code/backend_py/venv/bin"
ExecStart=/path/to/cloud-code/backend_py/venv/bin/gunicorn app.main:app \
  --workers 1 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:18765
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloud-code
sudo systemctl start cloud-code
```

---

### 方式二: Docker 部署

#### 1. 创建 Dockerfile

```dockerfile
# 后端 Dockerfile (backend_py/Dockerfile)
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# 复制代码
COPY . .

# 创建数据目录
RUN mkdir -p /data

EXPOSE 18765

CMD ["gunicorn", "app.main:app", \
     "--workers", "1", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:18765"]
```

#### 2. docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend_py
    ports:
      - "18765:18765"
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - CORS_ORIGINS=["https://your-domain.com"]
    restart: unless-stopped

  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    restart: unless-stopped
```

#### 3. 启动

```bash
pnpm build
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
    location / {
        root /path/to/cloud-code/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:18765;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:18765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Caddy

```
your-domain.com {
    # 前端
    root * /path/to/cloud-code/frontend/dist
    try_files {path} /index.html
    file_server

    # API
    handle /api/* {
        reverse_proxy localhost:18765
    }

    # WebSocket
    handle /ws {
        reverse_proxy localhost:18765
    }
}
```

---

## HTTPS 配置

### 使用 Let's Encrypt

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### Caddy (自动 HTTPS)

Caddy 会自动申请和续期 Let's Encrypt 证书。

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| CORS_ORIGINS | 允许的跨域来源 | ["http://localhost:18766"] |

---

## 数据备份

### SQLite 数据库

```bash
# 备份
sqlite3 backend_py/data.db ".backup backup.db"

# 恢复
cp backup.db backend_py/data.db
```

### 定时备份 (crontab)

```bash
# 每天凌晨 3 点备份
0 3 * * * sqlite3 /path/to/cloud-code/backend_py/data.db ".backup /path/to/backups/cloud-code-$(date +\%Y\%m\%d).db"
```

---

## 安全建议

1. **使用 HTTPS**: 生产环境必须使用 HTTPS
2. **限制访问**: 使用防火墙限制访问来源
3. **添加认证**: 考虑添加 Basic Auth 或 OAuth
4. **定期更新**: 保持依赖包更新
5. **日志监控**: 监控异常访问日志
