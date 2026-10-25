import { test, expect } from '@playwright/test';
import { gamesById } from '../../src/catalog.js';
import { fixturePage, signedIn } from './helpers.js';

const progressiveGames = [
  'symmetry-span',
  'symmetry-span-plus-plus',
  'rotation-span',
  'spatial-updating',
  'arithmetic-updating',
  'multi-stream-running-span',
  'multiple-object-tracking',
];
for (const id of progressiveGames)
  test(`${id}: interrupted rounds leave no saved records and can restart`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
    await fixturePage(page, gamesById.get(id));
    await signedIn(page, 'alice', true);
    for (const interruption of ['hidden', 'pagehide', 'timing']) {
      await page.locator('#action').click();
      await page.clock.runFor(100);
      if (interruption === 'timing') await page.clock.fastForward(2500);
      else
        await page.evaluate((kind) => {
          if (kind === 'pagehide') window.dispatchEvent(new Event('pagehide'));
          else {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
            delete document.hidden;
            document.dispatchEvent(new Event('visibilitychange'));
          }
        }, interruption);
      await expect(page.locator('body')).not.toHaveClass(/running/);
      expect(
        await page.evaluate(() => ({
          calls: window.fixture.state.submitCalls.length,
          keys: Object.keys(localStorage).filter((key) =>
            /^(mind-arcade\.records\.|mind-arcade\.pending:)/.test(key),
          ),
        })),
      ).toEqual({ calls: 0, keys: [] });
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
    await page.locator('#action').click();
    await page.clock.runFor(100);
    await expect(page.locator('body')).toHaveClass(/running/);
  });

for (const id of progressiveGames)
  test(`${id}: stopping before the first completed trial cancels without saving`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
    await fixturePage(page, gamesById.get(id));
    await signedIn(page, 'alice', true);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator('#action').click();
      await page.clock.runFor(100);
      await page.locator('#action').click();
      await page.clock.runFor(350);
      await expect(page.locator('body')).not.toHaveClass(/running/);
      await expect(page.locator('#result-note')).toHaveText('本局已取消，未记录。');
      expect(
        await page.evaluate(() => ({
          calls: window.fixture.state.submitCalls.length,
          keys: Object.keys(localStorage).filter((key) =>
            /^(mind-arcade\.records\.|mind-arcade\.pending:)/.test(key),
          ),
        })),
      ).toEqual({ calls: 0, keys: [] });
    }
  });

for (const id of ['choice-reaction', 'psychomotor-vigilance', 'go-no-go'])
  for (const first of ['frame', 'input'])
    test(`${id}: a 350ms stall cancels when ${first} runs first`, async ({ page }) => {
      await page.addInitScript(() => {
        Math.random = () => 0.1;
      });
      await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
      await fixturePage(page, gamesById.get(id));
      await signedIn(page, 'alice', true);
      await page.locator('#action').click();
      await page.clock.runFor(id === 'psychomotor-vigilance' ? 5000 : 3750);
      await expect(page.locator('body')).toHaveClass(/running/);
      if (first === 'frame') await page.clock.fastForward(350);
      else
        await page.evaluate((id) => {
          const now = performance.now.bind(performance);
          performance.now = () => now() + 350;
          try {
            document.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: id === 'choice-reaction' ? 'ArrowRight' : ' ',
                code: id === 'choice-reaction' ? 'ArrowRight' : 'Space',
                bubbles: true,
              }),
            );
          } finally {
            performance.now = now;
          }
        }, id);
      await expect(page.locator('body')).not.toHaveClass(/running/);
      await expect(page.locator('#result-note')).toHaveText('页面离开或计时中断，本次未记录。');
      await page.clock.runFor(350);
      expect(
        await page.evaluate(() => ({
          calls: window.fixture.state.submitCalls.length,
          keys: Object.keys(localStorage).filter((key) =>
            /^(mind-arcade\.records\.|mind-arcade\.pending:)/.test(key),
          ),
        })),
      ).toEqual({ calls: 0, keys: [] });
      await page.locator('#action').click();
      await page.clock.runFor(3100);
      await expect(page.locator('body')).toHaveClass(/running/);
    });

for (const [id, beforeStall, recalling] of [
  ['sequence-memory', 700, '#board button:not(:disabled)'],
  ['letter-number-sequencing', 700, '#recall-panel'],
  ['picture-span', 2100, '#recall-panel'],
  ['symbol-span', 2100, '#recall-panel'],
  ['sequence-memory', 1230, '#board button:not(:disabled)'],
])
  test(`${id}: a stalled presentation at ${beforeStall}ms cancels without saving and can restart`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
    await fixturePage(page, gamesById.get(id));
    await signedIn(page, 'alice', true);
    await page.locator('#action').click();
    await page.clock.runFor(beforeStall);
    await expect(page.locator('body')).toHaveClass(/running/);
    await page.clock.fastForward(1100);
    await expect(page.locator('body')).not.toHaveClass(/running/);
    await expect(page.locator('#phase-label')).toHaveText('已中断');
    await page.clock.runFor(3500);
    const saved = await page.evaluate(() => ({
      calls: window.fixture.state.submitCalls.length,
      keys: Object.keys(localStorage).filter((key) =>
        /^(mind-arcade\.records\.|mind-arcade\.pending:)/.test(key),
      ),
    }));
    expect(saved).toEqual({ calls: 0, keys: [] });
    await page.locator('#action').click();
    await page.clock.runFor(3000);
    await expect(page.locator('body')).toHaveClass(/running/);
    await expect(page.locator(recalling).first()).toBeVisible();
  });

for (const [width, scale] of [
  [1280, 100],
  [320, 40],
])
  test(`spatial updating: all nine starting cells remain visible at width ${width}, scale ${scale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-25T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-25T00:00:01Z'));
    await fixturePage(page, gamesById.get('spatial-updating'));
    if (scale !== 100) {
      await page.locator('.task-settings-toggle').click();
      await page.locator('#display-scale').fill(String(scale));
    }
    await page.locator('#action').click();
    await page.clock.runFor(1000);
    const cells = page.locator('.updating-card.active .updating-square');
    await expect(cells).toHaveCount(9);
    await expect(page.locator('.updating-card.active .updating-dot')).toBeVisible();
    const sizes = await cells.evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          border: parseFloat(style.borderTopWidth),
          color: style.borderTopColor,
        };
      }),
    );
    for (const size of sizes) {
      expect(size.width).toBeGreaterThan(5);
      expect(size.height).toBeGreaterThan(5);
      expect((size.border * scale) / 100).toBeGreaterThanOrEqual(0.8);
      expect(size.color).toBe('rgb(145, 134, 159)');
    }
    const card = await page.locator('.updating-card.active').boundingBox();
    const grid = await page.locator('.updating-card.active .updating-mini-grid').boundingBox();
    expect(grid.y + grid.height).toBeLessThanOrEqual(card.y + card.height);
  });
