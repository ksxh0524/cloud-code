# Contributing to Cloud Code

感谢你对 Cloud Code 的兴趣！本文档将帮助你快速搭建开发环境并参与贡献。

---

## 目录

- [开发环境](#开发环境)
- [项目结构](#项目结构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试要求](#测试要求)
- [PR 流程](#pr-流程)

---

## 开发环境

### 前置要求

- **Node.js**: 18+ (推荐 20 LTS)
- **pnpm**: 8+
- **Git**

### 安装步骤

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/cloud-code.git
cd cloud-code

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cd backend
cp .env.example .env
# 编辑 .env 填入你的 API 配置

# 4. 启动开发服务器
# 方式一：使用管理脚本
chmod +x manager.sh
./manager.sh start

# 方式二：pnpm
cd .. && pnpm dev:all
```

访问 http://localhost:18766 开始开发。

---

## 项目结构

```
cloud-code/
├── backend/              # Express + WebSocket 后端
│   └── src/
│       ├── server.ts         # 应用入口
│       ├── agent-service.ts  # Claude SDK 集成
│       ├── routes.ts         # REST API
│       ├── store.ts          # 数据持久化
│       ├── auth.ts           # 认证中间件
│       ├── types.ts          # 类型定义
│       └── logger.ts         # 日志
├── frontend/             # React + Vite 前端
│   └── src/
│       ├── pages/            # 页面组件
│       ├── components/       # UI 组件
│       ├── hooks/            # 自定义 Hooks
│       └── lib/              # 工具函数
├── test/                 # Playwright E2E 测试
└── docs/                 # 文档
```

---

## 开发流程

### 创建功能分支

```bash
# 从 main 分支创建
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# 或修复分支
git checkout -b fix/bug-description
```

### 命名规范

- `feat/*`: 新功能
- `fix/*`: 修复问题
- `docs/*`: 文档更新
- `refactor/*`: 代码重构
- `test/*`: 测试相关
- `chore/*`: 构建/工具

### 开发检查清单

- [ ] 代码遵循项目规范
- [ ] 添加/更新测试
- [ ] 更新相关文档
- [ ] 本地测试通过
- [ ] 无控制台警告

---

## 代码规范

### 后端 (Node.js/TypeScript)

```typescript
// 1. 使用 ESM 模块
import { something } from './module'

// 2. 使用 async/await，避免回调
async function fetchData(): Promise<Data> {
  const result = await db.query()
  return result
}

// 3. 类型定义使用 PascalCase
interface UserConfig {
  name: string
  age: number
}

// 4. 函数使用 camelCase，返回类型明确
async function getUserById(id: string): Promise<User | null> {
  // ...
}

// 5. 错误处理
import { logger } from './logger.js'

try {
  await riskyOperation()
} catch (error) {
  logger.error({ error }, 'Operation failed')
  throw new Error('User-friendly message')
}

// 6. 环境变量使用大写
const PORT = process.env.PORT || '18765'
```

### 前端 (React/TypeScript)

```typescript
// 1. 组件使用 PascalCase
function MessageList({ messages }: MessageListProps) {
  return <div>...</div>
}

// 2. Props 接口命名
interface MessageListProps {
  messages: Message[]
  onSelect?: (id: string) => void
}

// 3. Hooks 使用 use 前缀
function useMessages(conversationId: string) {
  // ...
}

// 4. 内联 CSS 风格
function Component() {
  return (
    <>
      <div className="container">
        {/* content */}
      </div>
      <style>{`
        .container {
          padding: 16px;
        }
      `}</style>
    </>
  )
}

// 5. 事件处理函数命名
function handleClick() { }
function handleSubmit() { }

// 6. 使用可选链和空值合并
const name = user?.name ?? 'Anonymous'
```

### ESLint 配置

项目使用以下 ESLint 规则：

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ]
}
```

运行检查：

```bash
pnpm lint        # 检查
pnpm lint:fix    # 自动修复
pnpm format      # 格式化
```

---

## 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (type)

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复问题 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 代码重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖 |

### 示例

```bash
# 功能提交
feat(chat): 添加消息搜索功能

支持按关键词搜索历史消息，高亮显示匹配内容。
Closes #123

# 修复提交
fix(websocket): 修复重连时消息丢失问题

在连接断开后未保存的 pending 消息现在会正确重发。
Fixes #456

# 文档提交
docs(readme): 更新部署说明

添加 Docker Compose 部署方式的详细步骤。

# 小修复
fix: 修复移动端输入框遮挡问题
```

---

## 测试要求

### 后端测试

```bash
cd backend
pnpm test           # 运行单元测试
pnpm test:watch     # 监听模式
pnpm test:coverage  # 覆盖率报告
```

### E2E 测试

```bash
# 确保服务已启动
./manager.sh start

# 运行所有测试
npx playwright test

# 运行特定测试
npx playwright test test/mobile-ui.spec.ts

# UI 模式（调试）
npx playwright test --ui

# 生成报告
npx playwright show-report
```

### 测试规范

- 新功能必须包含测试
- 修复问题需添加回归测试
- 保持测试独立，不依赖执行顺序

---

## PR 流程

### 提交前检查

```bash
# 1. 代码检查
pnpm lint && pnpm format

# 2. 构建测试
pnpm build

# 3. 运行测试
npx playwright test

# 4. 更新文档（如有需要）
```

### PR 模板

```markdown
## 描述
简要描述这个 PR 做了什么。

## 类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 代码重构

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 添加了测试
- [ ] 更新了文档
- [ ] 本地测试通过

## 相关 Issue
Closes #issue_number
```

### 审查流程

1. 创建 PR 到 `main` 分支
2. 确保 CI 通过（如有）
3. 等待维护者审查
4. 根据反馈修改
5. 合并后删除分支

---

## 问题反馈

### Bug 报告

创建 Issue 时提供：

1. **环境信息**
   - OS 版本
   - Node.js 版本
   - 浏览器版本（前端问题）

2. **复现步骤**
   - 清晰的操作步骤
   - 最小复现代码

3. **预期 vs 实际**
   - 预期行为
   - 实际行为

4. **附加信息**
   - 错误日志
   - 截图（如适用）

### 功能请求

1. 描述功能用途
2. 可能的实现方案
3. 是否愿意实现

---

## 社区规范

- 保持友好和尊重
- 接受建设性批评
- 关注对项目最有利的方案
- 帮助其他贡献者

---

## 联系方式

- **Issue**: https://github.com/ksxh0524/cloud-code/issues
- **讨论**: https://github.com/ksxh0524/cloud-code/discussions

感谢你的贡献！🎉
