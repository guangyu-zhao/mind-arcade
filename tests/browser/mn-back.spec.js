import { test, expect } from '@playwright/test';
import { gamesById } from '../../src/catalog.js';
import { fixturePage, signedIn } from './helpers.js';
import {
  DEFAULTS,
  EXPOSURE_MS,
  CHANNELS,
  responseWindow,
} from '../../src/games/working-memory/mn-back/rules.js';
import {
  generateSequence,
  matchingChannels,
  validateRecords,
} from '../../src/games/working-memory/mn-back/model.js';

const game = gamesById.get('mn-back');
test.setTimeout(90000);
async function setup(page, rules = DEFAULTS) {
  await page.addInitScript((rules) => {
    if (!localStorage.getItem('mn-back.settings.v1'))
      localStorage.setItem('mn-back.settings.v1', JSON.stringify(rules));
  }, rules);
  await page.clock.install({ time: new Date('2026-10-25T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-25T10:00:01Z'));
  await fixturePage(page, game);
}
async function begin(page) {
  await page.locator('#action').click();
  await expect(page.locator('#cover-title')).toHaveText('3');
  await page.clock.runFor(3000);
  for (let i = 0; i < 5 && !(await page.locator('.mn-cell.lit').count()); i++)
    await page.clock.runFor(16);
  await expect(page.locator('.mn-cell.lit')).toHaveCount(1);
}
async function blank(page) {
  await page.clock.fastForward(EXPOSURE_MS);
  for (let i = 0; i < 5 && (await page.locator('.mn-cell.lit').count()); i++)
    await page.clock.runFor(16);
  await expect(page.locator('.mn-cell.lit')).toHaveCount(0);
}
async function next(page, rules) {
  const counter = await page.locator('#round-counter').textContent();
  for (let remaining = responseWindow(rules); remaining > 0; remaining -= 1000)
    await page.clock.fastForward(Math.min(1000, remaining));
  for (let i = 0; i < 5 && (await page.locator('#round-counter').textContent()) === counter; i++)
    await page.clock.runFor(16);
  expect(await page.locator('#round-counter').textContent()).not.toBe(counter);
}
const saved = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('mind-arcade.records.mn-back:'))
      .map((key) => JSON.parse(localStorage.getItem(key)).record),
  );

for (const m of [1, 2, 3, 4])
  test(`N-back gives ${m} channels a (M+1)/3-second blank response window`, async ({ page }) => {
    const rules = { ...DEFAULTS, shape: m >= 2, color: m >= 3, sound: m === 4 };
    await setup(page, rules);
    await begin(page);
    await blank(page);
    const windowMs = ((m + 1) / 3) * 1000;
    await page.clock.runFor(Math.floor(windowMs / 2));
    await expect(page.locator('#round-counter')).toHaveText('1 / 1');
    const progress = Number(await page.locator('#response-progress').getAttribute('aria-valuenow'));
    expect(progress).toBeGreaterThanOrEqual(46);
    expect(progress).toBeLessThanOrEqual(54);
    await page.clock.runFor(Math.floor(windowMs / 2) - 50);
    await expect(page.locator('#round-counter')).toHaveText('1 / 1');
    await page.clock.runFor(80);
    await expect(page.locator('#round-counter')).toHaveText('1 / 30');
    await expect(page.locator('.mn-cell.lit')).toHaveCount(1);
  });

test('N-back completes N warm-ups plus 30 judgments, pools matches and syncs fractional F1', async ({
  page,
}) => {
  const rules = { ...DEFAULTS, size: 7, n: 6, shape: true, color: true, sound: true };
  await setup(page, rules);
  await signedIn(page, 'alice', true);
  const sequence = generateSequence(rules, () => 0.25);
  await begin(page);
  let addedFalseAlarm = false;
  for (let i = 0; i < sequence.length; i++) {
    if (i < rules.n) {
      await expect(page.locator('#responses button:enabled')).toHaveCount(0);
      await page.keyboard.press('1');
    } else {
      await expect(page.locator('#responses button:enabled')).toHaveCount(4);
      await expect(page.locator('#round-counter')).toHaveText(`${i - rules.n + 1} / 30`);
    }
    await blank(page);
    if (i >= rules.n) {
      const matches = matchingChannels(sequence, i, rules);
      for (const channel of matches)
        await page.keyboard.press(String(CHANNELS.indexOf(channel) + 1));
      const falseChannel = CHANNELS.find((channel) => !matches.includes(channel));
      if (!addedFalseAlarm && falseChannel) {
        await page.locator(`[data-channel=${falseChannel}]`).click();
        addedFalseAlarm = true;
      }
    }
    await next(page, rules);
  }
  await expect(page.locator('body')).not.toHaveClass(/running/);
  await expect(page.locator('#score-value')).toHaveText('98.63');
  const records = await saved(page);
  expect(records).toHaveLength(1);
  expect(validateRecords(records)[0].trials).toHaveLength(36);
  expect(records[0].meta.ownerId).toBe('alice');
  await page.clock.runFor(1000);
  await expect.poll(() => page.evaluate(() => window.fixture.state.submitCalls.length)).toBe(1);
  await expect(page.locator('.cloud-chart')).toHaveCount(3);
  await page.locator('[name=n][value="1"]').check({ force: true });
  await page.clock.runFor(500);
  await expect(page.locator('#score-value')).toHaveText('—');
  await expect(page.locator('[name=position]')).toBeDisabled();
});

test('N-back exposes a full 400 ms item, keeps response toggles through the blank window, and scores no answers as zero', async ({
  page,
}) => {
  await setup(page);
  await begin(page);
  await page.clock.runFor(350);
  await expect(page.locator('.mn-cell.lit')).toHaveCount(1);
  await page.clock.runFor(80);
  await expect(page.locator('.mn-cell.lit')).toHaveCount(0);
  await next(page, DEFAULTS);
  await expect(page.locator('#round-counter')).toHaveText('1 / 30');
  const button = page.locator('[data-channel=position]');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  for (let i = 0; i < 30; i++) {
    await blank(page);
    await next(page, DEFAULTS);
  }
  await expect(page.locator('#score-value')).toHaveText('0');
  expect((await saved(page))[0].score).toBe(0);
  await expect(page.locator('[name=position]')).toBeChecked();
  await expect(page.locator('[name=position]')).toBeDisabled();
});

test('N-back ignores held shortcuts and a click that started in the preceding item', async ({
  page,
}) => {
  await setup(page);
  await begin(page);
  await blank(page);
  await next(page, DEFAULTS);
  await page.keyboard.down('1');
  await expect(page.locator('[data-channel=position]')).toHaveAttribute('aria-pressed', 'true');
  await blank(page);
  await next(page, DEFAULTS);
  await page.keyboard.down('1');
  await expect(page.locator('[data-channel=position]')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('1');
  const box = await page.locator('[data-channel=position]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await blank(page);
  await next(page, DEFAULTS);
  await page.mouse.up();
  await expect(page.locator('[data-channel=position]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#action').click();
  expect(await saved(page)).toEqual([]);
});

for (const key of ['Space', 'Enter'])
  test(`N-back keeps a held ${key} on the focused answer in its original item`, async ({
    page,
  }) => {
    await setup(page);
    await begin(page);
    await blank(page);
    await next(page, DEFAULTS);
    const button = page.locator('[data-channel=position]');
    await button.focus();
    await page.keyboard.down(key);
    await blank(page);
    await next(page, DEFAULTS);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.down(key);
    await page.keyboard.up(key);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press(key);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(key);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

test('N-back cancels stalled presentation without saving and can restart', async ({ page }) => {
  await setup(page);
  await begin(page);
  await page.clock.fastForward(1400);
  await expect(page.locator('body')).not.toHaveClass(/running/);
  expect(await saved(page)).toEqual([]);
  await begin(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('body')).not.toHaveClass(/running/);
  expect(await saved(page)).toEqual([]);
});

test('N-back audio loads all 26 clips and an unavailable recording never creates a silent scored game', async ({
  page,
}) => {
  await setup(page, { ...DEFAULTS, sound: true });
  const duration = await page.evaluate(async () => {
    const ctx = new AudioContext(),
      response = await fetch('../../audio/mn-back/letters-400ms.mp3'),
      buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const durations = Array.from({ length: 26 }, (_, i) =>
      buffer
        .getChannelData(0)
        .slice((i * buffer.sampleRate * 400) / 1000, ((i + 1) * buffer.sampleRate * 400) / 1000)
        .some((value) => Math.abs(value) > 0.01),
    );
    await ctx.close();
    return { seconds: buffer.duration, active: durations };
  });
  expect(duration.seconds).toBeCloseTo(10.4, 2);
  expect(duration.active.every(Boolean)).toBeTruthy();
  await page.route('**/audio/mn-back/letters-400ms.mp3', (route) => route.abort());
  await page.locator('#action').click();
  await expect(page.locator('#result-note')).toContainText('声音未能播放');
  await expect(page.locator('body')).not.toHaveClass(/running/);
  expect(await saved(page)).toEqual([]);
  await page.unroute('**/audio/mn-back/letters-400ms.mp3');
  await begin(page);
  await expect(page.locator('#responses button')).toHaveCount(2);
  await page.locator('#action').click();
});

test('N-back scale shrinks the occupied board space, and settings persist with translated labels', async ({
  page,
}) => {
  await setup(page);
  const before = await page.locator('#matrix-frame').boundingBox(),
    buttonsBefore = await page.locator('#responses').boundingBox();
  await page.locator('#display-scale').fill('50');
  const after = await page.locator('#matrix-frame').boundingBox(),
    buttonsAfter = await page.locator('#responses').boundingBox();
  expect(after.width).toBeCloseTo(before.width / 2, 0);
  expect(after.height).toBeCloseTo(before.height / 2, 0);
  expect(buttonsAfter.y).toBeLessThan(buttonsBefore.y - 100);
  await page.locator('[name=shape]').check();
  await page.locator('[name=color]').check();
  await page.locator('[name=n][value="2"]').check({ force: true });
  await page.locator('[data-language-select]').selectOption('en', { force: true });
  await expect(page.locator('[data-channel=shape]')).toContainText('Shape');
  await expect(page.locator('.task-settings-summary')).toContainText('N = 2');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.locator('#display-scale')).toHaveValue('50');
  await expect(page.locator('[name=shape]')).toBeChecked();
  await page.screenshot({ path: '/tmp/mn-back-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/mn-back-mobile.png', fullPage: true });
});
