import { test, expect } from '@playwright/test';
import { gamesById } from '../../src/catalog.js';
import { fixturePage } from './helpers.js';
for (const length of [1, 12, 13, 19])
  for (const order of ['forward', 'reverse'])
    test(`visual span ${length} ${order}: pages, distinct adjacent choices and score`, async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
      await fixturePage(page, gamesById.get('picture-span'), `fixture=visual&length=${length}`);
      await page.locator(`[name=order][value=${order}]`).check({ force: true });
      await page.locator('#action').click();
      for (let i = 0; i < 8; i++) {
        await page.clock.runFor(1200);
        if (await page.locator('#study-panel').isVisible()) {
          const items = await page.locator('#study-content svg text').allTextContents();
          expect(items.length).toBeLessThanOrEqual(12);
        }
        if (await page.locator('#recall-panel').isVisible()) break;
      }
      // The deterministic source alternates adjacent choices across page boundaries.
      await page.clock.runFor(20000);
      await expect(page.locator('#recall-panel')).toBeVisible();
      const indexes = Array.from({ length }, (_, index) => (index % 2 ? 13 : 14));
      if (order === 'reverse') indexes.reverse();
      for (const index of indexes) {
        await page.locator('#choices button').nth(index).click();
        await page.clock.runFor(80);
      }
      await expect(page.locator('#score-value')).toHaveText(String(length));
      await page.locator('#action').click();
      expect(errors).toEqual([]);
    });
for (const gameId of ['flanker', 'stroop', 'psychomotor-vigilance', 'choice-reaction', 'go-no-go'])
  test(`${gameId}: 30 second session finishes`, async ({ page }) => {
    const game = gamesById.get(gameId),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
    await page.goto(`${game.route}/`);
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await page.locator('#action').click();
    await page.clock.runFor(35000);
    await expect(page.locator('body')).not.toHaveClass(/running/);
    expect(errors).toEqual([]);
  });
test('custom language combobox supports keyboard navigation and stays in the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./');
  await page.locator('[data-language-switch] button').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.locator('.game-card')).toHaveCount(22);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
test('overview remembers the category after visiting a game', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-filter=attention]').click();
  await page.locator('[data-category=attention] .game-card').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('.back-link').click();
  await expect(page.locator('[data-filter=attention]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-category]:visible')).toHaveCount(1);
  await page.locator('[data-filter=all]').click();
  await expect(page.locator('[data-category]:visible')).toHaveCount(4);
});
test('custom select keeps its label separate from its options after changes and reset', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    const { Select } = await import('/mind-arcade/src/ui/select.js');
    const form = document.createElement('form');
    form.id = 'select-fixture';
    form.innerHTML =
      '<label>Grid size<select><option>4 × 4</option><option>6 × 6</option></select></label>';
    document.body.append(form);
    Select.enhance(form);
  });
  const combo = page.locator('#select-fixture [role=combobox]');
  await expect(combo).toHaveAccessibleName('Grid size');
  await combo.click();
  await page.locator('#select-fixture [role=option]').nth(1).click();
  await expect(combo).toHaveText('6 × 6');
  await expect(combo).toHaveAccessibleName('Grid size');
  await page.locator('#select-fixture').evaluate((form) => form.reset());
  await expect(combo).toHaveText('4 × 4');
  await expect(combo).toHaveAccessibleName('Grid size');
});
for (const ending of ['missed', 'error'])
  test(`target cancellation: ${ending} ends immediately and preserves correct marks`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
    await fixturePage(page, gamesById.get('target-cancellation'));
    await expect(page.locator('[id$="-task"]')).toHaveCount(1);
    await page.locator('#action').click();
    await page.clock.runFor(3100);
    const { hits, distractor } = await page.evaluate(() => {
      const targets = [...document.querySelectorAll('#cancel-targets svg')].map((s) => s.innerHTML);
      const cells = [...document.querySelectorAll('#cancel-grid button')];
      const matches = (cell) => targets.includes(cell.querySelector('svg').innerHTML);
      return {
        hits: cells.flatMap((cell, index) => (matches(cell) ? [index] : [])),
        distractor: cells.findIndex((cell) => !matches(cell)),
      };
    });
    for (const index of hits.slice(0, 3))
      await page.locator('#cancel-grid button').nth(index).click();
    if (ending === 'missed') await page.locator('#next-page').click();
    else await page.locator('#cancel-grid button').nth(distractor).click();
    await expect(page.locator('body')).not.toHaveClass(/running/);
    await expect(page.locator('#final-score')).toHaveText('3');
    const [record] = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('mind-arcade.records.target-cancellation:'))
        .map((key) => JSON.parse(localStorage.getItem(key)).record),
    );
    expect(record).toMatchObject({ score: 3, reason: ending });
    expect(record.elapsedMs).toBeLessThan(30000);
  });
test('choice reaction accepts arrow keys and ends on the first wrong direction', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
  await fixturePage(page, gamesById.get('choice-reaction'));
  await page.locator('#action').click();
  await page.clock.runFor(3750);
  const left = (await page.locator('#stimulus path').getAttribute('transform')).includes('scale');
  await page.keyboard.press(left ? 'ArrowLeft' : 'ArrowRight');
  await expect(page.locator('#attempt-count')).toContainText('1');
  await page.clock.runFor(750);
  const nextLeft = (await page.locator('#stimulus path').getAttribute('transform')).includes(
    'scale',
  );
  await page.keyboard.press(nextLeft ? 'ArrowRight' : 'ArrowLeft');
  await expect(page.locator('body')).not.toHaveClass(/running/);
  const [record] = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('mind-arcade.records.choice-reaction:'))
      .map((key) => JSON.parse(localStorage.getItem(key)).record),
  );
  expect(record).toMatchObject({ score: 1, reason: 'error' });
});
test('target cancellation keeps Space available for a focused cell and navigation', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
  await fixturePage(page, gamesById.get('target-cancellation'));
  await page.locator('#action').click();
  await page.clock.runFor(3100);
  const index = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('#cancel-targets svg')].map((s) => s.innerHTML);
    return [...document.querySelectorAll('#cancel-grid button')].findIndex((cell) =>
      targets.includes(cell.querySelector('svg').innerHTML),
    );
  });
  const cell = page.locator('#cancel-grid button').nth(index);
  await cell.focus();
  await page.keyboard.press('Space');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveClass(/running/);
  await page.locator('.back-link').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('body')).toHaveClass(/running/);
  await page.locator('#next-page').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#final-score')).toHaveText('1');
  await expect(page.locator('body')).not.toHaveClass(/running/);
});
test('holding Enter does not insert a second memory answer', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
  await fixturePage(page, gamesById.get('sequence-memory'));
  await page.locator('#action').click();
  await page.clock.runFor(1500);
  await page.locator('#board button').nth(0).click();
  await page.clock.runFor(3200);
  const first = page.locator('#board button').nth(0);
  await first.focus();
  await page.keyboard.down('Enter');
  await expect(page.locator('#response-count')).toHaveText('1 / 2');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.locator('#response-count')).toHaveText('1 / 2');
  await expect(page.locator('#phase-label')).toHaveAttribute('data-phase', 'recalling');
  await page.locator('#board button').nth(1).click();
  await expect(page.locator('#score-value')).toHaveText('2');
});
test('games remain usable when the browser blocks local storage entirely', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.goto('Working-Memory/Sequence-Memory/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('#action').click();
  await expect(page.locator('body')).toHaveClass(/running/);
  await page.locator('#action').click();
  await expect(page.locator('body')).not.toHaveClass(/running/);
  await expect(page.locator('#result-note')).toHaveText('本地记录暂存于本页。');
  expect(errors).toEqual([]);
});
for (const gameId of ['schulte-table', 'flanker', 'choice-reaction', 'symbol-search'])
  test(`${gameId}: the cancel button discards an unfinished timed round`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-17T00:00:01Z'));
    await page.goto(`${gamesById.get(gameId).route}/`);
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await page.locator('#action').click();
    await page.clock.runFor(3100);
    await expect(page.locator('#action-label')).toHaveText('取消本局');
    await page.locator('#action').click();
    await expect(page.locator('body')).not.toHaveClass(/running/);
    await expect(page.locator('#result-note')).toHaveText('本局已取消，未记录。');
    expect(
      await page.evaluate(
        (id) =>
          Object.keys(localStorage).filter(
            (key) =>
              key === `mind-arcade.records.${id}` || key.startsWith(`mind-arcade.records.${id}:`),
          ),
        gameId,
      ),
    ).toEqual([]);
  });
