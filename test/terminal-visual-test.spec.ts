import { test, expect, chromium } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test.describe('终端显示测试', () => {
  test('测试 Claude 和 OpenCode 终端显示', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();
    
    // 1. 访问前端
    await page.goto(FRONTEND_URL);
    await sleep(2000);
    
    // 2. 点击新建对话
    await page.click('text=新建对话');
    await sleep(1000);
    
    // 3. 选择 Claude Code
    await page.click('text=Claude Code');
    await sleep(500);
    
    // 4. 点击创建
    await page.click('button:has-text("创建")');
    await sleep(5000);
    
    // 5. 截图 - Claude
    await page.screenshot({ path: 'test/screenshots/claude-terminal.png' });
    console.log('Claude terminal screenshot saved');
    
    // 6. 断开连接
    await page.click('text=断开');
    await sleep(1000);
    
    // 7. 新建 OpenCode 会话
    await page.click('text=新建对话');
    await sleep(1000);
    await page.click('text=OpenCode');
    await sleep(500);
    await page.click('button:has-text("创建")');
    await sleep(5000);
    
    // 8. 截图 - OpenCode
    await page.screenshot({ path: 'test/screenshots/opencode-terminal.png' });
    console.log('OpenCode terminal screenshot saved');
    
    await browser.close();
    console.log('Test completed');
  });
});
