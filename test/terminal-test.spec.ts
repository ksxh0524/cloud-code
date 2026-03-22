import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

// 测试配置
const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

// 等待函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 清理测试数据
async function cleanupTestData() {
  try {
    const dbPath = path.join(process.cwd(), 'backend', 'data.db');
    execSync(`rm -f ${dbPath}`);
    console.log('✓ Cleaned up test database');
  } catch (e) {
    console.log('No database to clean');
  }
}

// 截图对比函数
async function captureTerminalScreenshot(page: Page, name: string) {
  const terminal = page.locator('#terminal-container');
  await terminal.screenshot({ path: `test/screenshots/${name}.png` });
  console.log(`📸 Screenshot saved: test/screenshots/${name}.png`);
}

test.describe('终端显示测试', () => {
  let browser: any;
  let context: any;
  let page: Page;

  test.beforeAll(async () => {
    await cleanupTestData();
    
    browser = await chromium.launch({
      headless: false,
      args: ['--window-size=1280,800']
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('基本功能测试 - 创建会话并检查终端', async () => {
    console.log('\n=== 测试 1: 基本终端显示 ===');
    
    await page.goto(FRONTEND_URL);
    await sleep(1000);
    
    // 点击新建对话
    await page.click('text=+ 新建对话');
    await sleep(500);
    
    // 输入工作目录
    const input = page.locator('input[type="text"]');
    await input.fill(TEST_WORKDIR);
    await sleep(500);
    
    // 点击确认
    await page.click('button:has-text("确认")');
    await sleep(3000);
    
    // 检查终端容器是否存在
    const terminal = page.locator('#terminal-container');
    await expect(terminal).toBeVisible();
    
    // 检查连接状态
    const status = page.locator('text=已连接');
    await expect(status).toBeVisible({ timeout: 10000 });
    
    console.log('✓ Terminal initialized and connected');
    await captureTerminalScreenshot(page, 'basic-terminal');
  });

  test('终端尺寸自适应测试', async () => {
    console.log('\n=== 测试 2: 尺寸自适应 ===');
    
    // 测试不同窗口尺寸
    const sizes = [
      { width: 1920, height: 1080, name: 'desktop-large' },
      { width: 1280, height: 800, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
      { width: 375, height: 812, name: 'mobile' }
    ];
    
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await sleep(1000);
      
      const terminal = page.locator('#terminal-container');
      const box = await terminal.boundingBox();
      
      console.log(`  ${size.name}: ${box?.width}x${box?.height}`);
      
      // 验证终端容器有合理尺寸
      expect(box?.width).toBeGreaterThan(100);
      expect(box?.height).toBeGreaterThan(100);
      
      await captureTerminalScreenshot(page, `responsive-${size.name}`);
    }
    
    console.log('✓ Responsive test passed');
  });

  test('移动端侧边栏交互测试', async () => {
    console.log('\n=== 测试 3: 移动端交互 ===');
    
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(1000);
    
    // 点击菜单按钮打开侧边栏
    await page.click('.menu-button');
    await sleep(500);
    
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveClass(/open/);
    
    // 点击遮罩关闭侧边栏
    await page.click('.sidebar-overlay');
    await sleep(500);
    await expect(sidebar).not.toHaveClass(/open/);
    
    console.log('✓ Mobile sidebar interaction works');
    await captureTerminalScreenshot(page, 'mobile-sidebar-closed');
  });

  test('终端输入输出测试', async () => {
    console.log('\n=== 测试 4: 终端输入输出 ===');
    
    await page.setViewportSize({ width: 1280, height: 800 });
    await sleep(1000);
    
    // 点击终端区域获得焦点
    const terminalContainer = page.locator('#terminal-container');
    await terminalContainer.click();
    await sleep(500);
    
    // 输入测试命令
    await page.keyboard.type('echo "Hello Cloud Code"');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(2000);
    
    // 截图检查输出
    await captureTerminalScreenshot(page, 'terminal-output');
    
    // 测试清除命令
    await page.keyboard.type('clear');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(1000);
    
    await captureTerminalScreenshot(page, 'terminal-cleared');
    
    console.log('✓ Terminal input/output test passed');
  });

  test('深色模式测试（如果支持）', async () => {
    console.log('\n=== 测试 5: 主题适配 ===');
    
    // 模拟深色模式
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await sleep(3000);
    
    await captureTerminalScreenshot(page, 'dark-mode');
    
    // 恢复浅色模式
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await sleep(2000);
    
    console.log('✓ Theme test completed');
  });

  test('性能测试 - 终端渲染性能', async () => {
    console.log('\n=== 测试 6: 性能测试 ===');
    
    // 使用 Performance API 测量
    const performanceMetrics = await page.evaluate(() => {
      return {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      };
    });
    
    console.log(`  Page load time: ${performanceMetrics.loadTime}ms`);
    console.log(`  DOM ready: ${performanceMetrics.domContentLoaded}ms`);
    
    // 检查终端初始化时间
    const terminalInitTime = await page.evaluate(() => {
      return (window as any).terminalInitTime || 'Not measured';
    });
    console.log(`  Terminal init time: ${terminalInitTime}`);
    
    console.log('✓ Performance test completed');
  });

  test('WebSocket 连接稳定性测试', async () => {
    console.log('\n=== 测试 7: WebSocket 稳定性 ===');
    
    // 监听 WebSocket 事件
    const wsEvents: string[] = [];
    
    page.on('websocket', ws => {
      console.log(`  WebSocket opened: ${ws.url()}`);
      wsEvents.push('opened');
      
      ws.on('close', () => {
        console.log('  WebSocket closed');
        wsEvents.push('closed');
      });
      
      ws.on('framereceived', data => {
        wsEvents.push('received');
      });
    });
    
    // 刷新页面测试重连
    await page.reload();
    await sleep(3000);
    
    // 验证 WebSocket 已连接
    const status = page.locator('text=已连接');
    await expect(status).toBeVisible({ timeout: 10000 });
    
    console.log(`  WebSocket events: ${wsEvents.join(', ')}`);
    console.log('✓ WebSocket stability test passed');
  });
});

// 生成测试报告
test.afterAll(async () => {
  console.log('\n========================================');
  console.log('测试完成！检查 test/screenshots/ 目录查看截图');
  console.log('========================================');
});
