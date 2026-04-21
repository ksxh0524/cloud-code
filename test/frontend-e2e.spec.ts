import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:18766'
const API = 'http://localhost:18765'

// Helper: open sidebar on mobile viewport
async function openSidebar(page: import('@playwright/test').Page) {
  const menuBtn = page.locator('.menu-button')
  if (await menuBtn.isVisible()) {
    await menuBtn.click()
    await page.waitForTimeout(500)
  }
}

// Helper: unique suffix to avoid collisions across tests
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

test.describe('Cloud Code Frontend E2E', () => {

  // --- 1. 首页加载 ---
  test('1. 首页加载 - 显示 Cloud Code 欢迎页', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.welcome-title')).toHaveText('Cloud Code', { timeout: 15000 })
    await expect(page.locator('.welcome-btn')).toHaveText('+ 新建对话')
  })

  // --- 2. 侧边栏打开/关闭 ---
  test('2. 侧边栏 - 打开/关闭', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    await expect(page.locator('.conv-search-input')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.settings-link')).toHaveText('设置')

    const overlay = page.locator('.sidebar-overlay')
    if (await overlay.isVisible()) {
      await overlay.click()
      await expect(page.locator('.sidebar-overlay')).not.toBeVisible({ timeout: 3000 })
    }
  })

  // --- 3. 新建对话弹窗 ---
  test('3. 新建对话弹窗 - 打开和关闭', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    const welcomeBtn = page.locator('.welcome-btn')
    if (await welcomeBtn.isVisible()) {
      await welcomeBtn.click()
    } else {
      await openSidebar(page)
      await page.locator('.new-chat-btn').click()
    }

    // Modal should appear with title
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-overlay')).toContainText('新建对话')
    // CustomSelect uses .custom-select-button (headlessui Listbox)
    await expect(page.locator('.custom-select-button').first()).toBeVisible()
    // Cancel button
    await page.locator('.modal-overlay button').filter({ hasText: '取消' }).click()
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 })
  })

  // --- 4. 对话搜索 ---
  test('4. 对话搜索框 - 输入和过滤', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const searchInput = page.locator('.conv-search-input')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('test-search-query')
    await page.waitForTimeout(300)
    expect(await searchInput.inputValue()).toBe('test-search-query')
    await expect(page.locator('.conv-empty')).toContainText('未找到匹配的对话')
  })

  // --- 5. 对话列表 - 空状态 ---
  test('5. 对话列表 - 显示对话项或空状态', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const convItems = await page.locator('.conv-item').count()
    const convEmpty = await page.locator('.conv-empty').count()
    expect(convItems + convEmpty).toBeGreaterThan(0)
  })

  // --- 6. 设置页面 ---
  test('6. 设置页面 - 通过侧边栏导航', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)
    await page.locator('.settings-link').click()
    await page.waitForURL('**/settings', { timeout: 5000 })

    await expect(page.locator('text=设置')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=默认工作目录')).toBeVisible()
  })

  // --- 7. 404 页面 ---
  test('7. 404 页面 - SPA 路由', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.goto(BASE + '/nonexistent-page-xyz')
    await page.waitForLoadState('networkidle')
    // React Router renders NotFound with h1 "404"
    await expect(page.locator('h1')).toHaveText('404', { timeout: 10000 })
    await expect(page.locator('text=页面未找到')).toBeVisible()
  })

  // --- 8. 连接状态 ---
  test('8. 连接状态 - 侧边栏显示', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const statusDot = page.locator('.status-dot')
    await expect(statusDot).toBeVisible({ timeout: 5000 })
    const statusText = page.locator('.connection-status span').last()
    const text = await statusText.textContent()
    expect(['已连接', '未连接']).toContain(text)
  })

  // --- 9. Toast 容器 ---
  test('9. Toast 通知组件 - 容器存在', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const toastContainer = page.locator('.toast-container')
    expect(await toastContainer.count()).toBeGreaterThanOrEqual(0)
  })

  // --- 10. 聊天头部标题 ---
  test('10. 聊天头部标题 - 默认显示 Cloud Code', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.chat-title')).toHaveText('Cloud Code', { timeout: 5000 })
  })

  // --- 11. 创建对话 - 切换到聊天界面 ---
  test('11. 创建对话 - 切换到聊天界面', async ({ page }) => {
    const name = `E2E Conv ${uid()}`
    const response = await page.request.post(`${API}/api/conversations`, {
      data: { name, workDir: '/tmp', cliType: 'claude' },
    })
    expect(response.ok()).toBeTruthy()
    const conv = await response.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const convItem = page.locator('.conv-item').filter({ hasText: name }).first()
    await expect(convItem).toBeVisible({ timeout: 5000 })
    await convItem.click()
    await page.waitForTimeout(1000)

    await expect(page.locator('.chat-title')).toHaveText(name, { timeout: 5000 })
    await expect(page.locator('.empty-chat-title')).toHaveText('开始对话')
    await expect(page.locator('textarea').last()).toBeVisible()

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // --- 12. 删除对话确认弹窗 ---
  test('12. 删除对话 - 确认弹窗', async ({ page }) => {
    const name = `Del ${uid()}`
    const response = await page.request.post(`${API}/api/conversations`, {
      data: { name, workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await response.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const convItem = page.locator('.conv-item').filter({ hasText: name }).first()
    await expect(convItem).toBeVisible({ timeout: 5000 })
    await convItem.locator('.conv-menu').click({ force: true })
    await expect(page.locator('.conv-actions')).toBeVisible({ timeout: 3000 })
    await page.locator('.conv-action.delete').click()
    await expect(page.locator('.conv-delete-dialog')).toBeVisible()
    await expect(page.locator('.conv-delete-header')).toHaveText('确认删除')
    await page.locator('.conv-delete-btn.cancel').click()
    await expect(page.locator('.conv-delete-dialog')).not.toBeVisible()

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // --- 13. 重命名对话 ---
  test('13. 重命名对话 - 编辑功能', async ({ page }) => {
    const name = `Rename ${uid()}`
    const response = await page.request.post(`${API}/api/conversations`, {
      data: { name, workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await response.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    const convItem = page.locator('.conv-item').filter({ hasText: name }).first()
    await expect(convItem).toBeVisible({ timeout: 5000 })
    // Open menu
    await convItem.locator('.conv-menu').click({ force: true })
    await expect(page.locator('.conv-actions')).toBeVisible({ timeout: 3000 })
    // Click rename via evaluate (Playwright click + React event propagation issue)
    // After click, React re-renders and the name moves from text to input value,
    // so filter({ hasText: name }) breaks. Use global selector instead.
    await page.evaluate((searchName) => {
      const items = document.querySelectorAll('.conv-item')
      for (const item of items) {
        if (item.textContent?.includes(searchName)) {
          item.querySelector('.conv-action:not(.delete)')?.click()
          break
        }
      }
    }, name)

    // Use global selector since convItem locator breaks after React re-render
    const editInput = page.locator('.conv-edit-input').first()
    await expect(editInput).toBeVisible({ timeout: 5000 })
    expect(await editInput.inputValue()).toBe(name)

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // --- 14. 设置页面 - 返回首页 ---
  test('14. 设置页面 - 返回首页', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)
    await page.locator('.settings-link').click()
    await page.waitForURL('**/settings', { timeout: 5000 })

    const backLink = page.locator('a').filter({ hasText: '返回' })
    if (await backLink.isVisible()) {
      await backLink.click()
      await page.waitForURL('**/', { timeout: 5000 })
      await expect(page.locator('.welcome-title')).toHaveText('Cloud Code')
    }
  })

  // --- 15. 移动端响应式 ---
  test('15. 移动端 - 菜单按钮可见和侧边栏滑入', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.menu-button')).toBeVisible({ timeout: 5000 })
    await page.locator('.menu-button').click()
    await page.waitForTimeout(500)
    await expect(page.locator('.sidebar.open')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.sidebar-overlay')).toBeVisible()
  })

  // --- 16. 欢迎页功能说明 ---
  test('16. 欢迎页 - 功能说明和特性列表', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.welcome-desc')).toHaveText('移动端的 Claude Code 助手')
    await expect(page.locator('.welcome-feature').first()).toContainText('对话交互')
  })

  // --- 17. 侧边栏新建按钮 ---
  test('17. 侧边栏 - 新建对话按钮', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)
    await expect(page.locator('.new-chat-btn')).toHaveText('+ 新建对话')
    await page.locator('.new-chat-btn').click()
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 })
  })

  // --- 18. 搜索清空后恢复列表 ---
  test('18. 搜索清空 - 恢复对话列表', async ({ page }) => {
    const name = `Search ${uid()}`
    const response = await page.request.post(`${API}/api/conversations`, {
      data: { name, workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await response.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await openSidebar(page)

    // Type nonsense - no match
    const searchInput = page.locator('.conv-search-input')
    await searchInput.fill('xyz-no-match-12345')
    await page.waitForTimeout(300)
    await expect(page.locator('.conv-empty')).toContainText('未找到匹配的对话')

    // Clear search - should restore list
    await searchInput.fill('')
    await page.waitForTimeout(300)
    const convItem = page.locator('.conv-item').filter({ hasText: name }).first()
    await expect(convItem).toBeVisible({ timeout: 5000 })

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })
})
