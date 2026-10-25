import { test, expect } from '@playwright/test';
import { games } from '../../src/catalog.js';
import { translate, languages } from '../../src/i18n/translate.js';
for (const game of games)
  test(`${game.id}: languages and mobile`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${game.route}/`);
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    for (const language of languages) {
      await page.locator('[data-language-select]').selectOption(language, { force: true });
      await expect(page.locator('h1')).toHaveText(translate(game.name, {}, language));
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/\b(?:ui|game|cloud|catalog|span|metric|mn)\.[a-z]/);
      expect(errors).toEqual([]);
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${game.id}: ${language}, ${width}px`,
        ).toBeTruthy();
      }
    }
  });
