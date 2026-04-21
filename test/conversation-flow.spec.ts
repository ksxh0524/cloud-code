import { test, expect } from '@playwright/test'

const FRONTEND_URL = 'http://localhost:18766'
const BACKEND_URL = 'http://localhost:18765'

test.describe('完整对话流程 E2E', () => {
  test('创建会话 -> 发送消息 -> 接收响应 -> 查看历史', async ({ page }) => {
    // 1. 访问首页
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 验证页面加载
    await expect(page.locator('text=欢迎使用 Cloud Code')).toBeVisible()

    // 2. 创建新会话
    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(500)

    // 填写会话信息
    const dialog = page.locator('.modal-content')
    await expect(dialog).toBeVisible()

    await page.fill('input[placeholder="输入对话名称"]', 'E2E 测试会话')

    // 选择工作目录（使用 /tmp）
    await page.click('.directory-select button')
    await page.waitForTimeout(300)
    await page.click('text=/tmp')
    await page.waitForTimeout(300)

    // 点击创建
    await page.click('button:has-text("创建")')
    await page.waitForTimeout(1000)

    // 验证会话已创建并进入聊天界面
    await expect(page.locator('text=E2E 测试会话')).toBeVisible()

    // 3. 发送消息
    const messageInput = page.locator('.message-input')
    await messageInput.fill('你好，请回复"测试成功"')
    await page.click('button.send-button')

    // 4. 等待流式响应
    await page.waitForTimeout(500)

    // 验证消息显示在用户列表
    await expect(page.locator('text=你好，请回复"测试成功"')).toBeVisible()

    // 等待 AI 响应（最多 30 秒）
    const responseLocator = page.locator('.message-item.assistant').first()
    await expect(responseLocator).toBeVisible({ timeout: 30000 })

    // 5. 验证响应不为空
    const responseText = await responseLocator.textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(5)

    // 6. 验证会话列表中有此会话
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    const sidebar = page.locator('aside.sidebar.open')
    await expect(sidebar).toBeVisible()

    // 检查会话是否在列表中
    await expect(page.locator('.conversation-list')).toContainText('E2E 测试会话')

    // 截图保存
    await page.screenshot({ path: 'test/results/conversation-flow.png' })
  })

  test('多消息对话流程', async ({ page }) => {
    // 1. 创建会话
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(500)

    await page.fill('input[placeholder="输入对话名称"]', '多轮对话测试')

    // 选择工作目录
    await page.click('.directory-select button')
    await page.waitForTimeout(300)
    await page.click('text=/tmp')
    await page.waitForTimeout(300)

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(1000)

    // 2. 发送第一条消息
    const messageInput = page.locator('.message-input')
    await messageInput.fill('记住：我的名字是测试用户')
    await page.click('button.send-button')

    // 等待第一条响应
    const firstResponse = page.locator('.message-item.assistant').first()
    await expect(firstResponse).toBeVisible({ timeout: 30000 })

    await page.waitForTimeout(1000)

    // 3. 发送第二条消息
    await messageInput.fill('我的名字是什么？')
    await page.click('button.send-button')

    // 等待第二条响应
    const responses = page.locator('.message-item.assistant')
    await expect(responses).toHaveCount(2, { timeout: 30000 })

    // 4. 验证所有消息都在列表中
    const userMessages = page.locator('.message-item.user')
    await expect(userMessages).toHaveCount(2)

    // 验证第二条响应包含相关内容
    const secondResponseText = await responses.nth(1).textContent()
    expect(secondResponseText?.toLowerCase()).toContain('测试用户')

    // 截图
    await page.screenshot({ path: 'test/results/multi-message-flow.png' })
  })

  test('工具调用可视化', async ({ page }) => {
    // 创建会话并发送需要工具调用的消息
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(500)

    await page.fill('input[placeholder="输入对话名称"]', '工具调用测试')

    await page.click('.directory-select button')
    await page.waitForTimeout(300)
    await page.click('text=/tmp')
    await page.waitForTimeout(300)

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(1000)

    // 发送需要工具调用的消息
    const messageInput = page.locator('.message-input')
    await messageInput.fill('查看当前目录的文件列表')
    await page.click('button.send-button')

    // 等待并检查是否出现工具调用
    const toolCall = page.locator('.tool-call')
    await expect(toolCall.first()).toBeVisible({ timeout: 30000 })

    // 验证工具调用显示正确的工具名称
    await expect(page.locator('.tool-call-header')).toContainText('Bash')

    // 点击展开工具调用详情
    await page.click('.tool-call-header')
    await page.waitForTimeout(300)

    // 验证工具详情可见
    const toolContent = page.locator('.tool-call-content')
    await expect(toolContent).toBeVisible()

    // 截图
    await page.screenshot({ path: 'test/results/tool-call-visualization.png' })
  })

  test('会话重命名和删除', async ({ page }) => {
    // 1. 创建测试会话
    const createRes = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: '待重命名会话', workDir: '/tmp', cliType: 'claude' },
    })
    const conversation = await createRes.json()

    // 2. 访问首页
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 3. 打开侧边栏
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    // 4. 找到会话并点击更多按钮
    const convItem = page.locator(`.conversation-item:has-text("待重命名会话")`)
    await expect(convItem).toBeVisible()

    // 点击更多按钮（三个点）
    await convItem.locator('.more-button').click()
    await page.waitForTimeout(300)

    // 5. 选择重命名
    await page.click('text=重命名')
    await page.waitForTimeout(300)

    // 输入新名称
    await page.fill('.rename-input input', '已重命名的会话')
    await page.click('button:has-text("确认")')
    await page.waitForTimeout(500)

    // 验证重命名成功
    await expect(page.locator('.conversation-list')).toContainText('已重命名的会话')
    await expect(page.locator('.conversation-list')).not.toContainText('待重命名会话')

    // 6. 删除会话
    const renamedItem = page.locator(`.conversation-item:has-text("已重命名的会话")`)
    await renamedItem.locator('.more-button').click()
    await page.waitForTimeout(300)

    await page.click('text=删除')
    await page.waitForTimeout(300)

    // 确认删除
    await page.click('button:has-text("确认")')
    await page.waitForTimeout(500)

    // 验证删除成功
    await expect(page.locator('.conversation-list')).not.toContainText('已重命名的会话')

    // 截图
    await page.screenshot({ path: 'test/results/conversation-rename-delete.png' })
  })

  test('设置页面功能', async ({ page }) => {
    // 访问首页
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 打开侧边栏
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    // 点击设置
    await page.click('text=设置')
    await page.waitForTimeout(500)

    // 验证设置页面
    await expect(page.locator('text=设置')).toBeVisible()
    await expect(page.locator('text=默认工作目录')).toBeVisible()

    // 修改默认工作目录
    await page.click('.workdir-select button')
    await page.waitForTimeout(300)
    await page.click('text=/tmp')
    await page.waitForTimeout(300)

    // 保存设置
    await page.click('button:has-text("保存")')
    await page.waitForTimeout(500)

    // 验证保存成功提示
    await expect(page.locator('text=保存成功')).toBeVisible()

    // 截图
    await page.screenshot({ path: 'test/results/settings-page.png' })
  })

  test('连接状态指示器', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 打开侧边栏查看连接状态
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    // 验证连接状态指示器存在
    const statusIndicator = page.locator('.connection-status')
    await expect(statusIndicator).toBeVisible()

    // 验证状态文字（连接中或已连接）
    const statusText = await statusIndicator.textContent()
    expect(statusText).toMatch(/连接中|已连接/)

    // 截图
    await page.screenshot({ path: 'test/results/connection-status.png' })
  })
})

test.describe('错误场景 E2E', () => {
  test('发送空消息应被阻止', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 创建会话
    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(500)

    await page.fill('input[placeholder="输入对话名称"]', '空消息测试')

    await page.click('.directory-select button')
    await page.waitForTimeout(300)
    await page.click('text=/tmp')
    await page.waitForTimeout(300)

    await page.click('button:has-text("创建")')
    await page.waitForTimeout(1000)

    // 尝试发送空消息
    const sendButton = page.locator('button.send-button')

    // 空输入框时发送按钮应该是禁用状态
    const isDisabled = await sendButton.isDisabled()
    expect(isDisabled).toBe(true)

    // 或者输入空格后检查
    await page.fill('.message-input', '   ')
    await page.click('button.send-button')

    // 验证没有发送消息（消息列表中只有欢迎消息）
    const userMessages = page.locator('.message-item.user')
    await expect(userMessages).toHaveCount(0)

    // 截图
    await page.screenshot({ path: 'test/results/empty-message-prevented.png' })
  })

  test('会话切换功能', async ({ page }) => {
    // 创建两个会话
    const res1 = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: '会话一', workDir: '/tmp', cliType: 'claude' },
    })
    const conv1 = await res1.json()

    const res2 = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: '会话二', workDir: '/tmp', cliType: 'claude' },
    })
    const conv2 = await res2.json()

    // 访问首页
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // 打开侧边栏
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    // 验证两个会话都在列表中
    await expect(page.locator('.conversation-list')).toContainText('会话一')
    await expect(page.locator('.conversation-list')).toContainText('会话二')

    // 点击会话二
    await page.click('text=会话二')
    await page.waitForTimeout(500)

    // 验证会话二被选中（通常有视觉指示）
    const selectedConv = page.locator('.conversation-item.selected, .conversation-item.active')
    const selectedText = await selectedConv.textContent()
    expect(selectedText).toContain('会话二')

    // 截图
    await page.screenshot({ path: 'test/results/conversation-switch.png' })
  })
})
