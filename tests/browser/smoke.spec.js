import { test, expect } from '@playwright/test';
import { games } from '../../src/catalog.js';
for (const game of games) {
  test(game.id, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${game.route}/`);
    await expect(page.locator('#action')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    expect(errors).toEqual([]);
    await page.locator('#action').click();
    await expect(page.locator('body')).toHaveClass(/running/);
    await page.waitForTimeout(250);
    await page.locator('#action').click();
    await expect(page.locator('body')).not.toHaveClass(/running/);
    expect(errors).toEqual([]);
  });
}
