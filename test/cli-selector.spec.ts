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

    await expect(page.locator('text=Cloud Code')).toBeVisible()

    await page.screenshot({ path: 'test/results/frontend-load.png' })
  })

  test('new conversation modal opens', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    await page.click('.new-chat-large-btn')
    await page.waitForTimeout(1000)

    await expect(page.locator('text=新建对话')).toBeVisible()

    await page.screenshot({ path: 'test/results/new-conv-modal.png' })
  })

  test('mobile responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    const menuButton = page.locator('button.menu-button')
    await expect(menuButton).toBeVisible()

    await menuButton.click()
    await page.waitForTimeout(300)

    const sidebar = page.locator('aside.sidebar.open')
    await expect(sidebar).toBeVisible()

    await page.screenshot({ path: 'test/results/mobile-layout.png' })
  })
})
