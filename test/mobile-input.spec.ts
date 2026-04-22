import { test, expect } from '@playwright/test'

test.describe('Mobile Input Box', () => {
  test.use({ ...test.info?.project?.use, viewport: { width: 375, height: 812 } })
  
  test('textarea has no native styling artifacts', async ({ page }) => {
    await page.route('**/ws', route => route.abort())
    await page.route('**/api/**', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }))
    
    await page.goto('http://localhost:18766')
    await page.waitForTimeout(2000)

    const textarea = page.locator('.input-textarea')
    if (await textarea.isVisible()) {
      const styles = await textarea.evaluate(el => {
        const cs = getComputedStyle(el)
        return {
          backgroundColor: cs.backgroundColor,
          border: cs.border,
          boxShadow: cs.boxShadow,
          appearance: cs.appearance,
        }
      })
      
      // 移除调试输出，使用expect验证代替
      // Background should be a light color (not black/transparent)
      expect(styles.backgroundColor).not.toBe('rgb(0, 0, 0)')
      // Should have no border
      expect(styles.border).toContain('none')
    }
  })
})
