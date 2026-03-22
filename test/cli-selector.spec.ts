import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

test.describe('CLI Selector Tests', () => {
  
  test('CLI types API returns correct format', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/cli-types`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.length).toBe(2);
    
    const claude = data.find((c: any) => c.type === 'claude');
    expect(claude).toBeTruthy();
    expect(claude.name).toBe('Claude Code');
    expect(claude.description).toBeTruthy();
    
    const opencode = data.find((c: any) => c.type === 'opencode');
    expect(opencode).toBeTruthy();
    expect(opencode.name).toBe('OpenCode');
    expect(opencode.description).toBeTruthy();
  });

  test('CLI check returns installed status', async ({ request }) => {
    const claudeRes = await request.get(`${BACKEND_URL}/api/cli-check/claude`);
    expect(claudeRes.ok()).toBeTruthy();
    const claudeData = await claudeRes.json();
    expect(claudeData.installed).toBe(true);
    expect(claudeData.version).toBeTruthy();
    
    const opencodeRes = await request.get(`${BACKEND_URL}/api/cli-check/opencode`);
    expect(opencodeRes.ok()).toBeTruthy();
    const opencodeData = await opencodeRes.json();
    expect(opencodeData.installed).toBe(true);
    expect(opencodeData.version).toBeTruthy();
  });

  test('New conversation modal shows CLI options correctly', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Click new conversation button in sidebar
    await page.click('button.new-chat-btn');
    await page.waitForTimeout(1000);
    
    // Check modal is open
    const modalHeader = page.locator('.modal-header:has-text("新建对话")');
    await expect(modalHeader).toBeVisible();
    
    // Check CLI options are shown - use first() to avoid strict mode
    await expect(page.locator('span:has-text("Claude Code")').first()).toBeVisible();
    await expect(page.locator('span:has-text("OpenCode")').first()).toBeVisible();
    
    // Check both show as installed
    await expect(page.locator('text=2.1.81')).toBeVisible();
    await expect(page.locator('text=1.2.27')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test/screenshots/cli-selector.png' });
  });

  test('Can switch between CLI types', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open modal
    await page.click('button.new-chat-btn');
    await page.waitForTimeout(1000);
    
    // Initially Claude Code should be selected
    await expect(page.locator('text=CLI: Claude Code')).toBeVisible();
    
    // Click on OpenCode option
    await page.locator('span:has-text("OpenCode")').first().click();
    await page.waitForTimeout(500);
    
    // Check OpenCode is now selected
    await expect(page.locator('text=CLI: OpenCode')).toBeVisible();
    
    // Click on Claude Code option
    await page.locator('span:has-text("Claude Code")').first().click();
    await page.waitForTimeout(500);
    
    // Check Claude is now selected
    await expect(page.locator('text=CLI: Claude Code')).toBeVisible();
  });

  test('Mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Check menu button is visible on mobile
    const menuButton = page.locator('button.menu-button');
    await expect(menuButton).toBeVisible();
    
    // Click menu to open sidebar
    await menuButton.click();
    await page.waitForTimeout(500);
    
    // Check sidebar is visible
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test/screenshots/mobile-layout.png' });
  });

  test('Can create conversation with Claude Code', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open modal
    await page.click('button.new-chat-btn');
    await page.waitForTimeout(1000);
    
    // Select Claude Code (should be default)
    await page.locator('span:has-text("Claude Code")').first().click();
    
    // Select a work directory - use index
    const selects = page.locator('select');
    const firstSelect = selects.first();
    await firstSelect.selectOption({ index: 2 }); // Select cloud-code
    await page.waitForTimeout(500);
    
    // Click create
    await page.click('button:has-text("创建")');
    await page.waitForTimeout(2000);
    
    // Check terminal appeared
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
  });
});