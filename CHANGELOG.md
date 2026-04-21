# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html).

## [Unreleased]

### Planned

- 多模型支持（OpenAI、Gemini 等）
- 会话导入/导出功能
- 代码片段收藏
- 主题切换（深色/浅色）
- 移动端 PWA 支持

---

## [0.0.1] - 2024-01-XX

### Added

#### 核心功能

- **移动端优先的 Web 界面** - 适配手机浏览器，44px 最小触摸目标
- **Claude Agent SDK 集成** - 支持 Read/Edit/Bash/Glob/Grep 工具调用
- **WebSocket 实时通信** - 流式响应，思维过程可视化
- **多会话管理** - 创建、切换、重命名、删除会话
- **消息持久化** - 自动保存到 `~/.cloud-code/`

#### 前端

- React 19 + Vite 6 构建
- TypeScript 5.7 严格模式
- 内联 CSS 样式（无外部 CSS 框架）
- react-markdown + remark-gfm 渲染
- react-syntax-highlighter 代码高亮
- @headlessui/react 无障碍组件

#### 后端

- Express 4 + WebSocket (ws)
- Zod 数据验证
- Pino 结构化日志
- 速率限制（100 req/min）
- CORS 跨域支持

#### 部署与运维

- systemd 服务配置
- PM2 进程管理支持
- Docker/Docker Compose 部署
- Nginx/Caddy 反向代理配置
- manager.sh 一键管理脚本

#### 安全

- 可选 API Key 认证
- 路径访问白名单（~/ 和 ~/codes/）
- 环境变量隔离

#### 测试

- Playwright E2E 测试
- 移动端 UI 测试
- WebSocket 连接测试

#### 文档

- README 快速开始指南
- CLAUDE.md 开发者指南
- DEPLOYMENT.md 部署指南

---

## 版本号说明

本项目使用语义化版本控制（SemVer）：

- **MAJOR**（主版本）: 不兼容的 API 更改（0.x.x 表示初始开发阶段）
- **MINOR**（次版本）: 向后兼容的功能新增
- **PATCH**（修订版本）: 向后兼容的问题修复

在 0.0.x 阶段：

- API 可能随时变化
- 不保证向后兼容
- 适合早期体验和反馈

---

## 贡献

欢迎提交 Issue 和 PR！

提交格式建议：

```
[TYPE] 简短描述

detail: 详细说明
```

TYPE 可以是：feat, fix, docs, style, refactor, test, chore
