import { test, expect } from '@playwright/test'

const FRONTEND_URL = 'http://localhost:18766'
const BACKEND_URL = 'http://localhost:18765'

test.describe('REST API', () => {
  test('health check', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/health`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.timestamp).toBeTruthy()
  })

  test('CLI types API returns correct format', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/cli-types`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()

    expect(data.length).toBe(2)
    const claude = data.find((c: any) => c.type === 'claude')
    expect(claude).toBeTruthy()
    expect(claude.name).toBe('Claude Code')

    const opencode = data.find((c: any) => c.type === 'opencode')
    expect(opencode).toBeTruthy()
    expect(opencode.name).toBe('OpenCode')
  })

  test('CLI check returns installed status', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/cli-check/claude`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data.installed).toBe('boolean')
  })

  test('conversation CRUD', async ({ request }) => {
    // Create
    const createRes = await request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: 'test-conv', workDir: '/tmp', cliType: 'claude' },
    })
    expect(createRes.ok()).toBeTruthy()
    const conv = await createRes.json()
    expect(conv.id).toBeTruthy()
    expect(conv.name).toBe('test-conv')

    // List
    const listRes = await request.get(`${BACKEND_URL}/api/conversations`)
    expect(listRes.ok()).toBeTruthy()
    const list = await listRes.json()
    expect(list.length).toBeGreaterThan(0)

    // Get single
    const getRes = await request.get(`${BACKEND_URL}/api/conversations/${conv.id}`)
    expect(getRes.ok()).toBeTruthy()

    // Update
    const updateRes = await request.patch(`${BACKEND_URL}/api/conversations/${conv.id}`, {
      data: { name: 'renamed' },
    })
    expect(updateRes.ok()).toBeTruthy()
    const updated = await updateRes.json()
    expect(updated.name).toBe('renamed')

    // Delete
    const deleteRes = await request.delete(`${BACKEND_URL}/api/conversations/${conv.id}`)
    expect(deleteRes.ok()).toBeTruthy()
  })

  test('config API', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/config`)
    expect(res.ok()).toBeTruthy()
    const config = await res.json()
    expect(config.feishu).toBeTruthy()
    expect(config.defaultWorkDir).toBeTruthy()
  })

  test('workdirs API', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/workdirs`)
    expect(res.ok()).toBeTruthy()
  })

  test('directories API', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/directories?path=/tmp`)
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Frontend', () => {
  test('page loads correctly', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // Should show welcome text
    await expect(page.locator('text=欢迎使用 Cloud Code')).toBeVisible()

    await page.screenshot({ path: 'test/results/frontend-load.png' })
  })

  test('new conversation modal opens and shows CLI options', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // Click new conversation button
    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(1000)

    // Modal should be visible
    await expect(page.locator('text=新建对话')).toBeVisible()

    // CLI options should show
    await expect(page.locator('text=Claude Code').first()).toBeVisible()

    await page.screenshot({ path: 'test/results/new-conv-modal.png' })
  })

  test('mobile responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // Menu button visible on mobile
    const menuButton = page.locator('button.menu-button')
    await expect(menuButton).toBeVisible()

    // Click to open sidebar
    await menuButton.click()
    await page.waitForTimeout(300)

    // Sidebar should be open
    const sidebar = page.locator('aside.sidebar.open')
    await expect(sidebar).toBeVisible()

    await page.screenshot({ path: 'test/results/mobile-layout.png' })
  })
})
