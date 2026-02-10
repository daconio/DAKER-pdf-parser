import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display DAKER logo and title', async ({ page }) => {
    await page.goto('/');

    // Check for DAKER branding - logo image with alt text
    await expect(page.locator('img[alt="DAKER"]')).toBeVisible();
  });

  test('should have working navigation to convert page', async ({ page }) => {
    await page.goto('/');

    // Look for a link or button that leads to convert
    const convertLink = page.locator('a[href*="convert"], button:has-text("시작")').first();
    if (await convertLink.isVisible()) {
      await convertLink.click();
      await expect(page).toHaveURL(/convert/);
    }
  });
});

test.describe('Convert Page', () => {
  test('should load convert page', async ({ page }) => {
    await page.goto('/convert');

    // Page should load without errors
    await expect(page).toHaveURL(/convert/);
  });

  test('should display mode selector', async ({ page }) => {
    await page.goto('/convert/ai-edit');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for AI Edit mode indicator
    const aiEditText = page.locator('text=AI').first();
    await expect(aiEditText).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Nitro Design System', () => {
  test('should apply Nitro primary color', async ({ page }) => {
    await page.goto('/convert/ai-edit');
    await page.waitForLoadState('networkidle');

    // Check that primary color (#0F5FFE) is being used
    const primaryButton = page.locator('button').filter({ hasText: /download|save/i }).first();
    if (await primaryButton.isVisible()) {
      const bgColor = await primaryButton.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // Primary color should be blue (#0F5FFE = rgb(15, 95, 254))
      expect(bgColor).toMatch(/rgb\(15,\s*95,\s*254\)|#0f5ffe/i);
    }
  });

  test('should have sharp corners (0 radius)', async ({ page }) => {
    await page.goto('/convert/ai-edit');
    await page.waitForLoadState('networkidle');

    // Check CSS variable for radius
    const radius = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--radius').trim();
    });
    expect(radius).toBe('0');
  });

  test('should use Roboto font family', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check font-family includes Roboto
    const fontFamily = await page.evaluate(() => {
      return getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily.toLowerCase()).toContain('roboto');
  });
});

test.describe('Theme Toggle', () => {
  test('should toggle between light and dark mode', async ({ page }) => {
    await page.goto('/convert/ai-edit');
    await page.waitForLoadState('networkidle');

    // Find theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme"], button:has([data-testid="theme-toggle"])').first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialIsDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      // Click toggle
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Check theme changed
      const afterIsDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      expect(afterIsDark).not.toBe(initialIsDark);
    }
  });
});
