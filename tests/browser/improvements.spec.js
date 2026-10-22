import { test, expect } from '@playwright/test';
import { gamesById } from '../../src/catalog.js';
import { fixturePage, signedIn } from './helpers.js';

async function pauseClock(page) {
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-22T00:00:01Z'));
}

test('favorites move to the top, persist and retain the three-column layout', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-favorite=rotation-span]').click();
  await expect(page.locator('[data-favorites-grid] .game-card')).toHaveCount(1);
  await expect(page.locator('.game-card')).toHaveCount(21);
  await expect(page.locator('[data-favorite=rotation-span]')).toBeFocused();
  await page.reload();
  await expect(page.locator('[data-favorite=rotation-span]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('[data-filter=favorites]').click();
  await expect(page.locator('.game-card:visible')).toHaveCount(1);
  await page.locator('[data-language-select]').selectOption('en', { force: true });
  await expect(page.locator('[data-favorite=rotation-span]')).toHaveAccessibleName(
    'Remove Rotation Span from favorites',
  );
  await page.locator('[data-favorite=rotation-span]').click();
  await expect(page.locator('.favorites-empty')).toBeVisible();
  await page.locator('[data-filter=all]').click();
  await expect(page.locator('.game-card:visible')).toHaveCount(21);
});

test('a damaged local record does not prevent the next game from being saved', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('mind-arcade.records.schulte-table', JSON.stringify([{ id: 'broken' }])),
  );
  await fixturePage(page, gamesById.get('schulte-table'));
  await page.locator('#action').click();
  await page.locator('#board button').filter({ hasText: /^1$/ }).click();
  await page.locator('#board button').filter({ hasText: /^3$/ }).click();
  const stored = await page.evaluate(() => ({
    records: Object.keys(localStorage)
      .filter((key) => key.startsWith('mind-arcade.records.schulte-table:'))
      .map((key) => JSON.parse(localStorage.getItem(key)).record),
    quarantine: JSON.parse(localStorage.getItem('mind-arcade.records.schulte-table.quarantine')),
  }));
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0].score).toBe(1);
  expect(stored.quarantine).toEqual([{ id: 'broken' }]);
});

test('the result shows pending, failed and synced cloud status and the charts show sample sizes', async ({
  page,
}) => {
  await fixturePage(page, gamesById.get('schulte-table'));
  await signedIn(page);
  await expect(page.locator('.cloud-sample-size')).toHaveCount(3);
  await page.evaluate(() => {
    window.fixture.state.holdSubmit = true;
  });
  await page.locator('#action').click();
  await page.locator('#board button').filter({ hasText: /^1$/ }).click();
  await page.locator('#board button').filter({ hasText: /^3$/ }).click();
  await expect(page.locator('.cloud-save-status')).toHaveAttribute('data-state', 'pending');
  await expect.poll(() => page.evaluate(() => window.fixture.state.submissions.length)).toBe(1);
  await page.evaluate(() =>
    window.fixture.state.submissions[0].resolve({
      error: { code: 'P0001', message: 'invalid_record' },
    }),
  );
  await expect(page.locator('.cloud-save-status')).toHaveAttribute('data-state', 'failed');
  await page.evaluate(() => {
    window.fixture.state.holdSubmit = false;
  });
  await page.locator('.cloud-status-wrap button').click();
  await expect(page.locator('.cloud-save-status')).toHaveAttribute('data-state', 'synced');
  await page.evaluate(() => window.fixture.state.session('bob'));
  await expect(page.locator('.cloud-save-status')).toBeHidden();
});

test('score comparisons use cloud history and exclude the previous account on a shared browser', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await pauseClock(page);
  await fixturePage(page, gamesById.get('sequence-memory'));
  await signedIn(page, 'alice', true);
  await page.clock.runFor(500);
  await expect(page.locator('.cloud-chart')).toHaveCount(3);
  await page.locator('#action').click();
  await page.clock.runFor(1500);
  await page.locator('#board button').nth(0).click();
  await page.clock.runFor(100);
  await page.locator('#action').click();
  await expect(page.locator('#result-note')).toContainText('11');
  await page.evaluate(() => {
    const fixture = window.fixture.state;
    const data = fixture.data;
    fixture.data = () => ({ ...data(), personal: { histogram: [] }, history: [] });
    fixture.session('bob');
  });
  await page.clock.runFor(1000);
  await expect(page.locator('.cloud-chart')).toHaveCount(1);
  await page.locator('#action').click();
  await page.clock.runFor(1500);
  await page.locator('#board button').nth(0).click();
  await page.clock.runFor(100);
  await page.locator('#action').click();
  await expect(page.locator('#result-note')).toHaveText('已记录');
});

for (const id of ['arithmetic-updating', 'spatial-updating', 'multi-stream-running-span'])
  test(`${id}: small mobile scale preserves readable instructions and usable answers`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await pauseClock(page);
    await fixturePage(page, gamesById.get(id), 'fixture=progressive');
    await page.locator('#display-scale').fill('40');
    const font = await page
      .locator('.stage-center p')
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize) * 0.4);
    expect(font).toBeGreaterThanOrEqual(16);
    await page.locator('#action').click();
    await page.clock.runFor(12000);
    await expect(page.locator('.updating-answer-card')).toHaveCount(1);
    const control = page
      .locator(
        id === 'spatial-updating' ? '.updating-pick-grid button' : '.updating-input-row input',
      )
      .first();
    const bounds = await control.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(id === 'spatial-updating' ? 35 : 43);
    expect(bounds.width).toBeGreaterThanOrEqual(43);
    if (id === 'arithmetic-updating') {
      expect((await page.locator('.updating-sign').boundingBox()).width).toBeGreaterThanOrEqual(43);
      await control.fill('3');
      await page.locator('.updating-sign').click();
      await expect(control).toHaveValue('-3');
    }
    await page.screenshot({ path: testInfo.outputPath('small-answer.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.locator('#action').click();
    await page.evaluate(() => {
      const { task, context } = window.fixture;
      const trial = task.generate(task.levelPlan(12, context.rules));
      trial.responses = task.expected(trial).map((row) => row.map((value) => (value + 1) % 9));
      task.feedback(context, trial);
    });
    const next = page.locator('.updating-review-pagination button').last();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.locator('.updating-review-pagination > span')).toContainText('2 /');
    for (const language of ['zh', 'en', 'de', 'fr', 'ja', 'ko']) {
      await page.locator('[data-language-select]').selectOption(language, { force: true });
      for (const element of await page
        .locator(
          '.updating-review-pagination button, .updating-review-pagination > span, .updating-review-area .channel-name',
        )
        .all()) {
        const fits = await element.evaluate((node) => {
          const box = node.getBoundingClientRect(),
            frame = document.getElementById('stage-frame').getBoundingClientRect();
          return (
            box.left >= frame.left - 1 &&
            box.right <= frame.right + 1 &&
            box.top >= frame.top - 1 &&
            box.bottom <= frame.bottom + 1
          );
        });
        expect(fits).toBe(true);
      }
    }
  });

test('rotation span offers a collapsed judgment review and translates its answers', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await pauseClock(page);
  await fixturePage(page, gamesById.get('rotation-span'), 'fixture=progressive');
  await page.locator('#action').click();
  await page.clock.runFor(750);
  await page.locator('#toolbar button').first().click();
  await page.clock.runFor(2200);
  await page.locator('.arrow-choice').first().click();
  await page.locator('#toolbar .primary').click();
  await page.locator('#action').click();
  await expect(page.locator('.judgment-review')).not.toHaveAttribute('open');
  await page.locator('.judgment-review summary').click();
  await expect(page.locator('.judgment-review')).toContainText('镜像');
  await expect(page.locator('.judgment-review svg text')).toHaveText('2');
  await page.locator('[data-language-select]').selectOption('en', { force: true });
  await expect(page.locator('.judgment-review')).toContainText('Mirrored');
  await page.locator('#action').click();
  await expect(page.locator('.judgment-review')).toHaveCount(0);
});

for (const id of ['symmetry-span', 'symmetry-span-plus-plus'])
  test(`${id}: judgment reviews show the expected pattern and translate answers`, async ({
    page,
  }) => {
    await pauseClock(page);
    await fixturePage(page, gamesById.get(id), 'fixture=progressive');
    await page.locator('#action').click();
    if (id === 'symmetry-span-plus-plus') await page.locator('#toolbar .primary').click();
    await page.clock.runFor(750);
    await page.locator('#action').click();
    await page.evaluate(async (id) => {
      const { judgmentReview } = await import('/mind-arcade/src/engines/span/review.js');
      const { task, context } = window.fixture;
      const item =
        id === 'symmetry-span'
          ? {
              cells: Array.from({ length: 16 }, (_, i) => i === 0 || i === 3),
              response: false,
              timedOut: false,
            }
          : { frames: [{ target: 0 }, { target: 3 }], response: 'neither', timedOut: false };
      const trial = {
        level: 1,
        rules: { ...context.rules, size: 4 },
        targetColor: 'blue',
        judgments: [item, { ...item, response: null, timedOut: true }],
      };
      document
        .querySelector('.board-panel')
        .append(judgmentReview(context, [trial], task.describeJudgment));
    }, id);
    await page.locator('.judgment-review summary').click();
    await expect(page.locator('.judgment-review-drawing svg rect')).toHaveCount(16);
    await page.locator('.judgment-review-navigation button').last().click();
    await expect(page.locator('.judgment-review-navigation span')).toHaveText('2 / 2');
    await page.locator('[data-language-select]').selectOption('en', { force: true });
    await expect(page.locator('.judgment-review')).toContainText('No answer');
  });
