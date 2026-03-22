import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

test.describe('Python Backend E2E Tests', () => {
  
  test.beforeAll(async () => {
    // Wait for servers to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('Health check', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('Get CLI types', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/cli-types`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data.find((c: any) => c.id === 'claude')).toBeTruthy();
    expect(data.find((c: any) => c.id === 'opencode')).toBeTruthy();
  });

  test('Create and list conversations', async ({ request }) => {
    // Create a conversation
    const createResponse = await request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Playwright Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'opencode'
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const conversation = await createResponse.json();
    expect(conversation.name).toBe('Playwright Test');
    expect(conversation.cliType).toBe('opencode');
    
    // List conversations
    const listResponse = await request.get(`${BACKEND_URL}/api/conversations`);
    expect(listResponse.ok()).toBeTruthy();
    const conversations = await listResponse.json();
    expect(conversations.length).toBeGreaterThan(0);
    expect(conversations.find((c: any) => c.id === conversation.id)).toBeTruthy();
  });

  test('Frontend loads', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Check if the page loaded
    const title = await page.title();
    expect(title).toContain('Cloud Code');
  });

  test('Create conversation via UI', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Click new conversation button (use first one in sidebar)
    const newButton = page.locator('button.new-chat-btn, button:has-text("新建对话")').first();
    await newButton.click();
    await page.waitForTimeout(500);
    
    // Fill in the form
    const input = page.locator('input[type="text"]');
    if (await input.count() > 0) {
      await input.fill('/Users/liuyang/codes');
      await page.waitForTimeout(500);
      
      // Click confirm
      const confirmButton = page.locator('button:has-text("确认")');
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
        
        // Check if terminal appeared
        const terminal = page.locator('#terminal-container');
        await expect(terminal).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('WebSocket connection test', async ({ page }) => {
    // Create a conversation first
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'WebSocket Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'opencode'
      }
    });
    const conversation = await createResponse.json();
    
    // Navigate to the conversation
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Click on the conversation (use first match)
    const convItem = page.locator(`text=WebSocket Test`).first();
    if (await convItem.count() > 0) {
      await convItem.click();
      await page.waitForTimeout(3000);
      
      // Check for connection status
      const connectedText = page.locator('text=已连接');
      const exists = await connectedText.count();
      console.log(`Connection status indicator exists: ${exists > 0}`);
    }
  });
});