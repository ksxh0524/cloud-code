import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

test.describe('Terminal DOM Structure Analysis', () => {
  
  test.beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('Analyze xterm internal structure', async ({ page }) => {
    // Create conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'DOM Analysis',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Open conversation
    const convItem = page.locator(`text=DOM Analysis`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    // Wait for terminal
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Get all HTML content
    const html = await terminal.innerHTML();
    console.log('\n=== TERMINAL HTML STRUCTURE ===\n');
    console.log(html.substring(0, 3000));
    console.log('\n=== END HTML ===\n');
    
    // Analyze DOM structure
    const structure = await page.evaluate(() => {
      const terminal = document.querySelector('.terminal-container');
      if (!terminal) return null;
      
      const xtermElement = terminal.querySelector('.xterm');
      
      return {
        hasTerminalContainer: !!terminal,
        hasXtermClass: !!xtermElement,
        xtermChildren: xtermElement ? Array.from(xtermElement.children).map(c => ({
          tag: c.tagName,
          className: c.className,
          childCount: c.children.length
        })) : [],
        allCanvases: Array.from(terminal.querySelectorAll('canvas')).map(c => ({
          className: c.className,
          width: c.width,
          height: c.height,
          style: c.style.cssText
        })),
        allDivs: Array.from(terminal.querySelectorAll('div')).map(d => ({
          className: d.className,
          textContent: d.textContent?.substring(0, 50)
        })).slice(0, 20)
      };
    });
    
    console.log('DOM Structure Analysis:', JSON.stringify(structure, null, 2));
    
    // Take screenshot
    await terminal.screenshot({ path: 'test/screenshots/terminal-dom-analysis.png' });
  });

  test('Check xterm screen and accessibility tree', async ({ page }) => {
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Screen Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    const convItem = page.locator(`text=Screen Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Check xterm specific elements
    const xtermScreen = terminal.locator('.xterm-screen');
    const xtermTextLayer = terminal.locator('.xterm-text-layer');
    const xtermSelectionLayer = terminal.locator('.xterm-selection-layer');
    const xtermLinkLayer = terminal.locator('.xterm-link-layer');
    const xtermCursorLayer = terminal.locator('.xterm-cursor-layer');
    
    console.log('xterm-screen exists:', await xtermScreen.count());
    console.log('xterm-text-layer exists:', await xtermTextLayer.count());
    console.log('xterm-selection-layer exists:', await xtermSelectionLayer.count());
    console.log('xterm-link-layer exists:', await xtermLinkLayer.count());
    console.log('xterm-cursor-layer exists:', await xtermCursorLayer.count());
    
    // Get screen dimensions
    const screenBox = await xtermScreen.boundingBox();
    console.log('xterm-screen dimensions:', screenBox);
  });

  test('Test actual terminal input and output', async ({ page }) => {
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'IO Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    // Track all WebSocket messages
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', data => {
        try {
          const parsed = JSON.parse(data.payload);
          wsMessages.push({ direction: 'received', ...parsed });
        } catch (e) {
          wsMessages.push({ direction: 'received', raw: data.payload });
        }
      });
      ws.on('framesent', data => {
        try {
          const parsed = JSON.parse(data.payload);
          wsMessages.push({ direction: 'sent', ...parsed });
        } catch (e) {
          wsMessages.push({ direction: 'sent', raw: data.payload });
        }
      });
    });
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    const convItem = page.locator(`text=IO Test`).first();
    await expect(convItem).toBeVisible({ timeout: 5000 });
    await convItem.click();
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Type Enter key
    await terminal.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Type 'ls' command
    await page.keyboard.type('ls', { delay: 100 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    console.log('\n=== WEBSOCKET MESSAGES ===\n');
    wsMessages.forEach((msg, i) => {
      console.log(`${i + 1}. [${msg.direction}] ${JSON.stringify(msg).substring(0, 200)}`);
    });
    console.log('\nTotal messages:', wsMessages.length);
    
    // Check terminal content
    const content = await page.evaluate(() => {
      const rows = document.querySelectorAll('.xterm-rows .xterm-row');
      return Array.from(rows).map(r => r.textContent).filter(Boolean);
    });
    
    console.log('\n=== TERMINAL CONTENT ===\n');
    content.forEach((line, i) => {
      console.log(`Row ${i}: ${line}`);
    });
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-io-test.png' });
  });

  test('Verify terminal lifecycle and cleanup', async ({ page }) => {
    // Create conversation
    const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Lifecycle Test',
        workDir: '/Users/liuyang/codes',
        cliType: 'claude'
      }
    });
    const conversation = await createResponse.json();
    
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // First terminal
    const convItem1 = page.locator(`text=Lifecycle Test`).first();
    await expect(convItem1).toBeVisible({ timeout: 5000 });
    await convItem1.click();
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get initial DOM structure
    const initialStructure = await page.evaluate(() => {
      return document.querySelectorAll('.xterm').length;
    });
    console.log('Initial xterm instances:', initialStructure);
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-lifecycle-1.png' });
    
    // Create another conversation to test switching
    const createResponse2 = await page.request.post(`${BACKEND_URL}/api/conversations`, {
      data: {
        name: 'Lifecycle Test 2',
        workDir: '/Users/liuyang/codes',
        cliType: 'opencode'
      }
    });
    const conversation2 = await createResponse2.json();
    
    // Switch to conversation 2
    const convItem2 = page.locator(`text=Lifecycle Test 2`).first();
    await expect(convItem2).toBeVisible({ timeout: 5000 });
    await convItem2.click();
    await page.waitForTimeout(3000);
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-lifecycle-2.png' });
    
    // Switch back to conversation 1
    await convItem1.click();
    await page.waitForTimeout(2000);
    
    await terminal.screenshot({ path: 'test/screenshots/terminal-lifecycle-3.png' });
    
    // Check if we have multiple xterm instances
    const finalStructure = await page.evaluate(() => {
      return document.querySelectorAll('.xterm').length;
    });
    console.log('Final xterm instances:', finalStructure);
    
    // Should only have 1 xterm instance
    expect(finalStructure).toBe(1);
  });
});
