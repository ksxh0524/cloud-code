# Cloud Code 测试指南

> 涵盖单元测试、E2E 测试和测试最佳实践

---

## 目录

- [测试概览](#测试概览)
- [后端单元测试](#后端单元测试)
- [E2E 测试](#e2e-测试)
- [测试编写指南](#测试编写指南)
- [CI/CD 集成](#cicd-集成)
- [调试技巧](#调试技巧)

---

## 测试概览

### 测试金字塔

```
       /\
      /  \     E2E 测试 (Playwright)
     /____\
    /      \   集成测试
   /________\
  /          \ 单元测试 (Vitest)
 /____________\
```

### 当前测试覆盖

| 类型 | 工具 | 目录 |
|------|------|------|
| 单元测试 | Vitest | `backend/` |
| E2E 测试 | Playwright | `test/` |

---

## 后端单元测试

### 运行测试

```bash
cd backend

# 运行所有测试
pnpm test

# 监听模式（开发时）
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

### 测试配置

`backend/package.json`：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 编写单元测试

```typescript
// backend/src/__tests__/store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { store } from '../store.js'
import { promises as fs } from 'fs'
import path from 'path'

const TEST_DIR = path.join(process.cwd(), 'test-data')

describe('Store', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  it('should create conversation', async () => {
    const conversation = await store.createConversation({
      name: 'Test',
      workDir: '/test/path'
    })

    expect(conversation).toHaveProperty('id')
    expect(conversation.name).toBe('Test')
    expect(conversation.workDir).toBe('/test/path')
  })

  it('should get conversation by id', async () => {
    const created = await store.createConversation({
      name: 'Test',
      workDir: '/test'
    })

    const found = await store.getConversation(created.id)
    expect(found).toEqual(created)
  })

  it('should return null for non-existent id', async () => {
    const found = await store.getConversation('non-existent')
    expect(found).toBeNull()
  })
})
```

### 常用断言

```typescript
// 基本断言
expect(value).toBe(expected)           // 严格相等
expect(value).toEqual(expected)        // 深度相等
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeTruthy()
expect(value).toBeFalsy()

// 字符串
expect(str).toContain(substring)
expect(str).toMatch(/regex/)

// 数组
expect(arr).toContain(item)
expect(arr).toHaveLength(n)

// 对象
expect(obj).toHaveProperty('key')
expect(obj).toHaveProperty('key', value)

// 异步
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

### Mock 技巧

```typescript
import { vi } from 'vitest'

// Mock 模块
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

// Mock 函数
const mockFn = vi.fn()
mockFn.mockReturnValue('mocked')
mockFn.mockResolvedValue({ data: [] })
mockFn.mockImplementation((arg) => arg * 2)

// Spy
const spy = vi.spyOn(object, 'method')
expect(spy).toHaveBeenCalled()
expect(spy).toHaveBeenCalledWith(arg1, arg2)
expect(spy).toHaveBeenCalledTimes(1)
```

---

## E2E 测试

### 环境准备

```bash
# 安装 Playwright
npm install -g @playwright/test
npx playwright install

# 或本地安装
pnpm add -D @playwright/test
npx playwright install
```

### 运行测试

```bash
# 确保服务已启动
./manager.sh start

# 运行所有测试
npx playwright test

# 运行特定文件
npx playwright test test/mobile-ui.spec.ts

# UI 模式（调试用）
npx playwright test --ui

# headed 模式（可见浏览器）
npx playwright test --headed

# 特定浏览器
npx playwright test --project=chromium

# 调试模式
npx playwright test --debug

# 生成并查看报告
npx playwright test
npx playwright show-report
```

### 浏览器支持

| 浏览器 | 项目名 | 说明 |
|--------|--------|------|
| Chrome | chromium | 桌面版 |
| Firefox | firefox | 桌面版 |
| Safari | webkit | 桌面版 |
| Pixel 5 | Mobile Chrome | 移动端 |
| iPhone 12 | Mobile Safari | 移动端 |

### 编写 E2E 测试

```typescript
// test/example.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  // 每个测试前执行
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:18766')
    await page.waitForLoadState('networkidle')
  })

  test('should display homepage', async ({ page }) => {
    // 断言页面标题
    await expect(page).toHaveTitle(/Cloud Code/)

    // 断言元素可见
    const title = page.locator('h1')
    await expect(title).toBeVisible()
    await expect(title).toHaveText('Cloud Code')
  })

  test('should create new conversation', async ({ page }) => {
    // 点击按钮
    await page.click('.new-chat-btn')

    // 填写表单
    await page.fill('[name="name"]', 'Test Chat')
    await page.click('text=创建')

    // 验证结果
    await expect(page.locator('.conversation-item')).toContainText('Test Chat')
  })

  test('should send message', async ({ page }) => {
    // 输入消息
    await page.fill('.input-box', 'Hello, AI!')

    // 发送
    await page.click('button[type="submit"]')

    // 等待响应（流式）
    await page.waitForSelector('.message.assistant', { timeout: 30000 })

    // 验证响应包含内容
    const response = page.locator('.message.assistant')
    await expect(response).not.toBeEmpty()
  })
})
```

### 移动端测试

```typescript
import { test, expect } from '@playwright/test'

test.describe('Mobile UI', () => {
  // 设置移动端视口
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('http://localhost:18766')
  })

  test('should show hamburger menu', async ({ page }) => {
    const menuButton = page.locator('.menu-button')
    await expect(menuButton).toBeVisible()
  })

  test('should toggle sidebar', async ({ page }) => {
    // 打开侧边栏
    await page.click('.menu-button')
    await expect(page.locator('.sidebar')).toHaveClass(/open/)

    // 点击遮罩关闭
    await page.click('.sidebar-overlay')
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  })
})
```

### WebSocket 测试

```typescript
import { test, expect } from '@playwright/test'

test('should connect and receive messages', async ({ page }) => {
  // 监听 WebSocket
  const wsMessages: any[] = []

  page.on('websocket', (ws) => {
    ws.on('framereceived', (data) => {
      wsMessages.push(JSON.parse(data.payload as string))
    })
  })

  await page.goto('http://localhost:18766')

  // 等待连接建立
  await page.waitForTimeout(2000)

  // 发送消息
  await page.fill('.input-box', 'Hello')
  await page.click('button[type="submit"]')

  // 等待响应
  await page.waitForTimeout(5000)

  // 验证收到消息
  const streamMessages = wsMessages.filter(m => m.type === 'stream')
  expect(streamMessages.length).toBeGreaterThan(0)

  const doneMessage = wsMessages.find(m => m.type === 'done')
  expect(doneMessage).toBeDefined()
})
```

### 常用 API

#### 页面操作

```typescript
// 导航
await page.goto('http://localhost:18766')
await page.reload()
await page.goBack()

// 点击
await page.click('selector')
await page.click('text=Button Text')
await page.click('button:has-text("Submit")')
await page.dblclick('selector')

// 输入
await page.fill('input[name="username"]', 'value')
await page.type('input', 'text', { delay: 100 }) // 模拟打字
await page.clear('input')

// 选择
await page.selectOption('select', 'option-value')
await page.check('checkbox')
await page.uncheck('checkbox')

// 滚动
await page.scrollTo('bottom')
await page.evaluate(() => window.scrollTo(0, 500))
```

#### 定位器

```typescript
// 基本定位
page.locator('css-selector')
page.locator('text=Visible Text')
page.locator('button:has-text("Click")')
page.locator('[data-testid="submit"]')

// 链式定位
page.locator('.list').locator('.item').first()
page.locator('.list').locator('.item').nth(2)

// 过滤器
page.locator('button').filter({ hasText: 'Submit' })
page.locator('.item').filter({ has: page.locator('.badge') })
```

#### 断言

```typescript
// 可见性
await expect(locator).toBeVisible()
await expect(locator).toBeHidden()

// 内容
await expect(locator).toHaveText('exact text')
await expect(locator).toContainText('partial')
await expect(locator).toHaveValue('input value')

// 属性
await expect(locator).toHaveAttribute('href', '/path')
await expect(locator).toHaveClass('active')
await expect(locator).toHaveId('element-id')

// 数量
await expect(locator).toHaveCount(3)

// 截图对比
await expect(page).toHaveScreenshot('homepage.png')
```

---

## 测试编写指南

### 最佳实践

1. **独立测试**：每个测试应该独立运行，不依赖其他测试
2. **清晰命名**：测试名应该描述行为和预期结果
3. **单一职责**：一个测试只验证一个概念
4. **使用数据属性**：优先使用 `data-testid` 而非 CSS 类

```tsx
// 好的做法
<button data-testid="submit-button">Submit</button>
await page.click('[data-testid="submit-button"]')

// 避免
<button className="btn-primary">Submit</button>
await page.click('.btn-primary') // 类名可能变化
```

### 测试结构模板

```typescript
test.describe('Feature', () => {
  test.describe('Success Cases', () => {
    test('should do X when Y', async ({ page }) => {
      // Arrange
      await setupState()

      // Act
      await performAction()

      // Assert
      await expect(result).toBe(expected)
    })
  })

  test.describe('Error Cases', () => {
    test('should show error when invalid input', async () => {
      // ...
    })
  })

  test.describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      // ...
    })
  })
})
```

### 等待策略

```typescript
// 好的做法：等待特定条件
await page.waitForSelector('.loaded', { timeout: 10000 })
await page.waitForFunction(() => document.querySelector('.item'))

// 避免：固定等待
await page.waitForTimeout(5000) // 不稳定且慢
```

---

## CI/CD 集成

### GitHub Actions 示例

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: cd backend && pnpm test

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: npx playwright install --with-deps
      - run: |
          cp backend/.env.example backend/.env
          ./manager.sh start
          npx playwright test
          ./manager.sh stop
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 调试技巧

### 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `Timeout exceeded` | 元素未出现 | 增加超时或使用更稳定的定位器 |
| `Element not found` | 选择器错误 | 检查选择器，使用 Playwright 录制器 |
| `WebSocket closed` | 服务未启动 | 确保后端服务运行中 |
| `Strict mode violation` | 多个匹配元素 | 使用 `.first()` 或更精确的选择器 |

### 调试工具

```bash
# 录制用户操作
npx playwright codegen http://localhost:18766

# 追踪（详细日志）
npx playwright test --trace on
npx playwright show-trace trace.zip

# 截图失败测试
npx playwright test --screenshot=only-on-failure

# 慢动作（可见执行）
npx playwright test --headed --slow-mo 1000
```

### Playwright Inspector

```typescript
// 在代码中设置断点
test('example', async ({ page }) => {
  await page.goto('http://localhost:18766')

  // 暂停，打开 Inspector
  await page.pause()

  await page.click('.button')
})
```

运行：

```bash
PWDEBUG=1 npx playwright test
```

---

## 覆盖率目标

| 类型 | 目标覆盖率 | 优先级 |
|------|-----------|--------|
| 单元测试 | ≥ 70% | 中 |
| 核心功能 | ≥ 80% | 高 |
| E2E 测试 | 关键流程 | 高 |

---

## 相关文档

- [API 文档](API.md) - REST API 和 WebSocket
- [CONTRIBUTING.md](../CONTRIBUTING.md) - 贡献指南
