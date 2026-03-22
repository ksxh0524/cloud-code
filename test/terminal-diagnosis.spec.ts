import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

test.describe('Terminal Component Diagnosis', () => {
  
  test.beforeAll(async () => {
    // Wait for servers to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('Terminal initialization and WebSocket connection', async ({ page }) => {
    // Create a conversation first
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Terminal Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const conversation = await createResponse.json();
    
    // Capture WebSocket events
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      console.log(`WebSocket opened: ${ws.url()}`);
      
      ws.on('framereceived', data => {
        console.log('WebSocket frame received:', data.payload);
        wsMessages.push({ type: 'received', data: data.payload });
      });
      
      ws.on('framesent', data => {
        console.log('WebSocket frame sent:', data.payload);
        wsMessages.push({ type: 'sent', data: data.payload });
      });
      
      ws.on('close', () => {
        console.log('WebSocket closed');
      });
    });
    
    // Navigate to the conversation
    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Click on the conversation
    const convItem = page.locator(`text=Terminal Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal to appear
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    
    // Wait for connection
    await page.waitForTimeout(3000);
    
    // Check connection status
    const statusConnected = page.locator('text=已连接');
    const statusStarting = page.locator('text=启动中');
    
    console.log('WebSocket messages captured:', wsMessages.length);
    
    // Take screenshot of terminal state
    await terminal.screenshot({ path: 'test/screenshots/terminal-initial.png' });
    
    // Verify terminal container exists and has content
    const terminalContent = await terminal.innerHTML();
    console.log('Terminal HTML length:', terminalContent.length);
    expect(terminalContent.length).toBeGreaterThan(100);
  });

  test('Terminal xterm instance and canvas elements', async ({ page }) => {
    // Create a conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'XTerm Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'opencode'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open conversation
    const convItem = page.locator(`text=XTerm Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check for xterm canvas elements
    const xtermCanvas = terminal.locator('canvas.xterm-text-layer');
    const canvasCount = await xtermCanvas.count();
    console.log(`Number of xterm canvas elements: ${canvasCount}`);
    
    // Check xterm accessibility tree
    const xtermRows = terminal.locator('.xterm-rows');
    const rowsCount = await xtermRows.count();
    console.log(`Number of xterm-rows elements: ${rowsCount}`);
    
    // Check viewport
    const xtermViewport = terminal.locator('.xterm-viewport');
    const viewportExists = await xtermViewport.count() > 0;
    console.log(`xterm-viewport exists: ${viewportExists}`);
    
    // Get terminal dimensions
    const terminalBox = await terminal.boundingBox();
    console.log('Terminal dimensions:', terminalBox);
    
    // Verify terminal has reasonable size
    if (terminalBox) {
      expect(terminalBox.width).toBeGreaterThan(100);
      expect(terminalBox.height).toBeGreaterThan(100);
    }
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-xterm.png' });
  });

  test('Terminal input handling', async ({ page }) => {
    // Create conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Input Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    // Track WebSocket messages
    let inputSent = false;
    page.on('websocket', ws => {
      ws.on('framesent', data => {
        console.log('Frame sent:', data.payload);
        if (data.payload.includes('input')) {
          inputSent = true;
        }
      });
    });
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open conversation
    const convItem = page.locator(`text=Input Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Focus terminal and type
    await terminal.click();
    await page.waitForTimeout(500);
    
    // Type a character
    await page.keyboard.press('a');
    await page.waitForTimeout(500);
    
    // Check if input was sent via WebSocket
    console.log('Input was sent via WebSocket:', inputSent);
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-input.png' });
  });

  test('Terminal resize behavior', async ({ page }) => {
    // Create conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Resize Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'opencode'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open conversation
    const convItem = page.locator(`text=Resize Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get initial dimensions
    const initialBox = await terminal.boundingBox();
    console.log('Initial terminal dimensions:', initialBox);
    
    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    
    // Check dimensions after resize
    const resizedBox = await terminal.boundingBox();
    console.log('Resized terminal dimensions:', resizedBox);
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-resized.png' });
  });

  test('Multiple terminals - conversation switching', async ({ page }) => {
    // Create two conversations
    const conv1 = await (await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: 'Conv 1', workDir: '/Users/liuyang/codes', cliType: 'claude' }
    })).json();
    
    const conv2 = await (await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: { name: 'Conv 2', workDir: '/Users/liuyang/codes', cliType: 'opencode' }
    })).json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Click first conversation
    const item1 = page.locator(`text=Conv 1`).first();
    await expect(item1).toBeVisible({ timeout: 5000 });
    await item1.click();
    
    const terminal1 = page.locator('.terminal-container');
    await expect(terminal1).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await terminal1.screenshot({ path: 'test/screenshots/terminal-conv1.png' });
    
    // Open sidebar and switch to second conversation
    const menuButton = page.locator('button.menu-button');
    if (await menuButton.count() > 0) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }
    
    const item2 = page.locator(`text=Conv 2`).first();
    await expect(item2).toBeVisible({ timeout: 5000 });
    await item2.click();
    await page.waitForTimeout(2000);
    
    const terminal2 = page.locator('.terminal-container');
    await expect(terminal2).toBeVisible({ timeout: 10000 });
    
    await terminal2.screenshot({ path: 'test/screenshots/terminal-conv2.png' });
  });

  test('Terminal error handling and reconnection', async ({ page }) => {
    // Create conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Reconnect Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open conversation
    const convItem = page.locator(`text=Reconnect Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check if reconnect button exists when disconnected
    const reconnectButton = page.locator('button:has-text("重连")');
    const disconnectButton = page.locator('button:has-text("断开")');
    
    // Wait for connection
    await page.waitForTimeout(3000);
    
    // Take screenshot of initial state
    await terminal.screenshot({ path: 'test/screenshots/terminal-reconnect-initial.png' });
    
    // If connected, test disconnect functionality
    if (await disconnectButton.count() > 0) {
      console.log('Terminal is connected, testing disconnect...');
      await disconnectButton.click();
      await page.waitForTimeout(1000);
      
      // Check for reconnect button
      if (await reconnectButton.count() > 0) {
        console.log('Disconnect successful, reconnect button visible');
        await terminal.screenshot({ path: 'test/screenshots/terminal-disconnected.png' });
        
        // Test reconnect
        await reconnectButton.click();
        await page.waitForTimeout(3000);
        
        await terminal.screenshot({ path: 'test/screenshots/terminal-reconnected.png' });
      }
    }
  });
});
