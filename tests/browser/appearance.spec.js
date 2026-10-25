import { test, expect } from '@playwright/test';
test('overview renders fixed three-column groups and a mobile game remains usable', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.game-card')).toHaveCount(22);
  for (const grid of await page.locator('.game-grid').all())
    expect(
      (await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns)).split(' '),
    ).toHaveLength(3);
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('Working-Memory/Picture-Span/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const slider = page.locator('#display-scale');
  await page.locator('.task-settings-toggle').click();
  const before = await page.locator('#memory-frame').boundingBox();
  await slider.fill('50');
  await slider.dispatchEvent('input');
  const after = await page.locator('#memory-frame').boundingBox();
  expect(after.height).toBeLessThan(before.height * 0.7);
  await page.screenshot({ path: testInfo.outputPath('picture-mobile.png'), fullPage: true });
});
test('visual span keeps instructions and pagination readable when the pictures shrink', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('Working-Memory/Picture-Span/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('.task-settings-toggle').click();
  await page.locator('#display-scale').fill('40');
  for (const language of ['zh', 'en', 'de', 'fr', 'ja', 'ko']) {
    await page.locator('[data-language-select]').selectOption(language, { force: true });
    const metrics = await page.locator('#memory-frame').evaluate((frame) => {
      const scale = Number(document.querySelector('#display-scale').value) / 100;
      const bounds = frame.getBoundingClientRect();
      return [...frame.querySelectorAll('#idle-title, #idle-caption')].map((node) => ({
        font: parseFloat(getComputedStyle(node).fontSize) * scale,
        fits:
          node.getBoundingClientRect().left >= bounds.left - 1 &&
          node.getBoundingClientRect().right <= bounds.right + 1 &&
          node.scrollWidth <= node.clientWidth + 1,
      }));
    });
    for (const item of metrics) {
      expect(item.font).toBeGreaterThanOrEqual(16);
      expect(item.fits).toBe(true);
    }
  }
  await page.locator('#answer-pagination').evaluate((pager) => {
    document.querySelector('#idle-panel').hidden = true;
    document.querySelector('#recall-panel').hidden = false;
    pager.hidden = false;
    pager.querySelector('[data-page-label]').textContent = '2 / 3';
  });
  for (const button of await page.locator('#answer-pagination button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(43);
    expect(bounds.height).toBeGreaterThanOrEqual(43);
  }
});
