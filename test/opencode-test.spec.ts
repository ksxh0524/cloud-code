import { test, expect, chromium } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test.describe('OpenCode 终端测试', () => {
  test('测试 OpenCode 终端显示', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();
    
    // 访问前端
    await page.goto(FRONTEND_URL);
    await sleep(2000);
    
    // 点击新建对话
    await page.click('text=+ 新建对话');
    await sleep(1000);
    
    // 选择 OpenCode
    await page.click('text=OpenCode CLI');
    await sleep(500);
    
    // 点击创建
    await page.click('button:has-text("创建")');
    await sleep(8000); // 等待更长时间
    
    // 截图
    await page.screenshot({ path: 'test/screenshots/opencode-terminal.png' });
    console.log('OpenCode terminal screenshot saved');
    
    await browser.close();
    console.log('Test completed');
  });
});
