import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:18766';
const BACKEND_URL = 'http://localhost:18765';

// 测试不同移动设备尺寸
const MOBILE_DEVICES = [
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'Pixel 5', width: 393, height: 851 },
  { name: 'iPhone SE', width: 375, height: 667 },
];

test.describe('Mobile UI Tests', () => {
  
  test.beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  // 测试每个设备尺寸
  for (const device of MOBILE_DEVICES) {
    test.describe(`${device.name} (${device.width}x${device.height})`, () => {
      
      test(`Home page layout - ${device.name}`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        
        // Check menu button is visible
        const menuButton = page.locator('button.menu-button');
        await expect(menuButton).toBeVisible();
        
        // Check sidebar is hidden initially
        const sidebar = page.locator('aside.sidebar');
        await expect(sidebar).not.toHaveClass(/open/);
        
        // Take screenshot
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-home.png`,
          fullPage: true 
        });
      });

      test(`Sidebar open/close - ${device.name}`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        
        // Open sidebar
        await page.click('button.menu-button');
        await page.waitForTimeout(500);
        
        // Check sidebar is visible
        const sidebar = page.locator('aside.sidebar');
        await expect(sidebar).toBeVisible();
        
        // Take screenshot with sidebar open
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-sidebar-open.png`,
          fullPage: true 
        });
        
        // Close sidebar by clicking overlay
        await page.click('.sidebar-overlay');
        await page.waitForTimeout(300);
        
        // Take screenshot after closing
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-sidebar-closed.png`,
          fullPage: true 
        });
      });

      test(`New conversation modal - ${device.name}`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        
        // Close sidebar if open
        const sidebar = page.locator('aside.sidebar');
        if (await sidebar.isVisible() && await sidebar.evaluate(el => el.classList.contains('open'))) {
          await page.click('.sidebar-overlay');
          await page.waitForTimeout(300);
        }
        
        // Open new conversation modal - click on the main content button
        const newChatBtn = page.locator('button.new-chat-btn').first();
        await newChatBtn.click();
        await page.waitForTimeout(1000);
        
        // Check modal is visible
        const modal = page.locator('.modal-content');
        await expect(modal).toBeVisible();
        
        // Take screenshot of modal
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-new-conversation-modal.png`,
          fullPage: true 
        });
        
        // Check modal fits in viewport
        const modalBox = await modal.boundingBox();
        expect(modalBox?.width).toBeLessThanOrEqual(device.width);
        expect(modalBox?.height).toBeLessThanOrEqual(device.height);
        
        // Close modal
        await page.click('button.modal-close');
        await page.waitForTimeout(300);
      });

      test(`Terminal with session - ${device.name}`, async ({ page }) => {
        // Create a conversation first
        const createResponse = await page.request.post(`${BACKEND_URL}/api/conversations`, {
          data: {
            name: `Mobile Test ${device.name}`,
            workDir: '/Users/liuyang/codes',
            cliType: 'claude'
          }
        });
        const conversation = await createResponse.json();
        
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        
        // Open the conversation
        const convItem = page.locator(`text=Mobile Test ${device.name}`).first();
        await expect(convItem).toBeVisible({ timeout: 5000 });
        await convItem.click();
        
        // Wait for terminal to load
        const terminal = page.locator('.terminal-container');
        await expect(terminal).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(3000);
        
        // Take screenshot of terminal
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-terminal.png`,
          fullPage: true 
        });
        
        // Check terminal fits in viewport
        const terminalBox = await terminal.boundingBox();
        expect(terminalBox?.width).toBeLessThanOrEqual(device.width - 16); // Account for padding
      });

      test(`Settings page - ${device.name}`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await page.goto(`${FRONTEND_URL}/settings`);
        await page.waitForLoadState('networkidle');
        
        // Take screenshot of settings
        await page.screenshot({ 
          path: `test/screenshots/mobile/${device.name}-settings.png`,
          fullPage: true 
        });
        
        // Check back button is visible and clickable
        const backButton = page.locator('a.back-link');
        await expect(backButton).toBeVisible();
        
        // Navigate back
        await backButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should be back on home
        await expect(page.locator('button.menu-button')).toBeVisible();
      });
    });
  }

  test('Modal responsiveness - compare desktop vs mobile', async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.click('button.new-chat-btn');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test/screenshots/mobile/modal-desktop.png',
      fullPage: true 
    });
    
    await page.click('button.modal-close');
    await page.waitForTimeout(300);
    
    // Mobile view
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('button.new-chat-btn');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test/screenshots/mobile/modal-mobile.png',
      fullPage: true 
    });
    
    // Compare modal sizes
    const modal = page.locator('.modal-content');
    const modalBox = await modal.boundingBox();
    
    // Mobile modal should take most of the screen width
    expect(modalBox?.width).toBeGreaterThan(350);
    expect(modalBox?.width).toBeLessThanOrEqual(390);
  });

  test('Safe area insets simulation', async ({ page }) => {
    // iPhone with notch simulation
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Add safe area insets via CSS
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--sat', '47px'); // safe-area-inset-top
      document.documentElement.style.setProperty('--sar', '0px');
      document.documentElement.style.setProperty('--sab', '34px'); // safe-area-inset-bottom
      document.documentElement.style.setProperty('--sal', '0px');
    });
    
    // Open sidebar
    await page.click('button.menu-button');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'test/screenshots/mobile/safe-area-test.png',
      fullPage: true 
    });
    
    // Check that elements respect safe areas
    const sidebar = page.locator('aside.sidebar');
    const sidebarStyles = await sidebar.evaluate(el => {
      return window.getComputedStyle(el).paddingTop;
    });
    
    console.log('Sidebar padding-top:', sidebarStyles);
  });
});
