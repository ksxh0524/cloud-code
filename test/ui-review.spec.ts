import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:18766'
const API = 'http://localhost:18765'

test.describe('UI 布局全面审查', () => {

  // ========== 1. 欢迎页 ==========
  test('1. 欢迎页 - 桌面端', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/01-welcome-desktop.png', fullPage: true })
  })

  test('2. 欢迎页 - 移动端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/02-welcome-mobile.png', fullPage: true })
  })

  // ========== 3. 侧边栏 ==========
  test('3. 侧边栏 - 桌面端展开', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/03-sidebar-desktop.png', fullPage: true })
  })

  test('4. 侧边栏 - 移动端滑出', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.locator('.menu-button').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ui-review/04-sidebar-mobile.png', fullPage: true })
  })

  // ========== 5. 新建对话弹窗 ==========
  test('5. 新建对话弹窗 - 桌面端', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const welcomeBtn = page.locator('.welcome-btn')
    if (await welcomeBtn.isVisible()) {
      await welcomeBtn.click()
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ui-review/05-modal-desktop.png', fullPage: true })
  })

  test('6. 新建对话弹窗 - 移动端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const welcomeBtn = page.locator('.welcome-btn')
    if (await welcomeBtn.isVisible()) {
      await welcomeBtn.click()
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ui-review/06-modal-mobile.png', fullPage: true })
  })

  // ========== 7. 聊天页面 - 空状态 ==========
  test('7. 聊天页 - 空状态', async ({ page }) => {
    const resp = await page.request.post(`${API}/api/conversations`, {
      data: { name: 'UI测试对话', workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await resp.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const menuBtn = page.locator('.menu-button')
    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }
    await page.locator('.conv-item').filter({ hasText: 'UI测试对话' }).first().click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/ui-review/07-chat-empty-desktop.png', fullPage: true })

    // 移动端空状态
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/08-chat-empty-mobile.png', fullPage: true })

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // ========== 9. 设置页面 ==========
  test('8. 设置页面 - 桌面端', async ({ page }) => {
    await page.goto(BASE + '/settings')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/09-settings-desktop.png', fullPage: true })
  })

  test('9. 设置页面 - 移动端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BASE + '/settings')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/10-settings-mobile.png', fullPage: true })
  })

  // ========== 11. 404 页面 ==========
  test('10. 404 页面', async ({ page }) => {
    await page.goto(BASE + '/not-found-page')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: '/tmp/ui-review/11-404-desktop.png', fullPage: true })
  })

  // ========== 12. 带消息的聊天页面（完整体验）==========
  test('11. 聊天页 - 有消息（完整体验）桌面端', async ({ page }) => {
    const resp = await page.request.post(`${API}/api/conversations`, {
      data: { name: 'UI完整测试', workDir: '/Users/liuyang/codes/cloud-code', cliType: 'claude' },
    })
    const conv = await resp.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const menuBtn = page.locator('.menu-button')
    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }
    await page.locator('.conv-item').filter({ hasText: 'UI完整测试' }).first().click()
    await page.waitForTimeout(1000)

    // 发送一条简单消息，等回复
    const ta = page.locator('textarea').last()
    await ta.fill('用一句话介绍自己')
    const sendBtn = page.locator('.send-button, button.send-btn').last()
    if (await sendBtn.isVisible()) {
      await sendBtn.click()
    } else {
      await ta.press('Enter')
    }
    await page.waitForTimeout(20000)

    // 桌面端截图
    await page.screenshot({ path: '/tmp/ui-review/12-chat-messages-desktop.png', fullPage: true })

    // 平板端
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/13-chat-messages-tablet.png', fullPage: true })

    // 移动端
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/14-chat-messages-mobile.png', fullPage: true })

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // ========== 15. 对话列表交互 ==========
  test('12. 对话列表 - 菜单操作', async ({ page }) => {
    const resp = await page.request.post(`${API}/api/conversations`, {
      data: { name: '菜单测试对话', workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await resp.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const menuBtn = page.locator('.menu-button')
    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }
    // 点击三点菜单
    const convItem = page.locator('.conv-item').filter({ hasText: '菜单测试对话' }).first()
    await expect(convItem).toBeVisible({ timeout: 5000 })
    await convItem.locator('.conv-menu').click({ force: true })
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/15-conv-menu.png', fullPage: true })

    // 删除弹窗
    await page.locator('.conv-action.delete').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/16-delete-dialog.png', fullPage: true })

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })

  // ========== 17. 搜索状态 ==========
  test('13. 搜索 - 有结果和无结果', async ({ page }) => {
    const resp = await page.request.post(`${API}/api/conversations`, {
      data: { name: '搜索目标对话', workDir: '/tmp', cliType: 'claude' },
    })
    const conv = await resp.json()

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const menuBtn = page.locator('.menu-button')
    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }

    // 搜索有结果
    const search = page.locator('.conv-search-input')
    await search.fill('搜索目标')
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/17-search-results.png', fullPage: true })

    // 搜索无结果
    await search.fill('zzz-no-match-xyz')
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/ui-review/18-search-empty.png', fullPage: true })

    await page.request.delete(`${API}/api/conversations/${conv.id}`)
  })
})
