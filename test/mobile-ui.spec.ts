import { test, expect } from '@playwright/test'

test.describe('Mobile UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
  })

  test('mobile layout elements', async ({ page }) => {
    await page.goto('http://localhost:18766')
    await page.waitForLoadState('networkidle')

    // Menu button visible
    const menuButton = page.locator('button.menu-button')
    await expect(menuButton).toBeVisible()

    // Welcome message visible
    await expect(page.locator('text=欢迎使用 Cloud Code')).toBeVisible()

    // New chat button visible
    await expect(page.locator('.new-chat-large-btn')).toBeVisible()

    await page.screenshot({ path: 'test/results/mobile-home.png' })
  })

  test('sidebar open/close on mobile', async ({ page }) => {
    await page.goto('http://localhost:18766')
    await page.waitForLoadState('networkidle')

    // Open sidebar
    await page.click('button.menu-button')
    await page.waitForTimeout(300)

    const sidebar = page.locator('aside.sidebar.open')
    await expect(sidebar).toBeVisible()

    // Connection status visible in sidebar
    await expect(page.locator('.connection-status')).toBeVisible()

    // Settings link visible
    await expect(page.locator('text=设置')).toBeVisible()

    // Close by clicking overlay
    await page.click('.sidebar-overlay')
    await page.waitForTimeout(300)

    // Sidebar should be hidden
    await expect(page.locator('aside.sidebar.open')).not.toBeVisible()
  })

  test('new conversation modal on mobile', async ({ page }) => {
    await page.goto('http://localhost:18766')
    await page.waitForLoadState('networkidle')

    // Open modal
    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(1000)

    // Modal visible
    await expect(page.locator('text=新建对话')).toBeVisible()

    // Close button works
    await page.click('button:has-text("取消")')
    await page.waitForTimeout(300)

    // Modal closed
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })
})
