import { test, expect } from '@playwright/test';
import { gamesById } from '../../src/catalog.js';
import { fixturePage, signedIn } from './helpers.js';
const game = gamesById.get('schulte-table');
test('account dialog supports language changes, password visibility and login errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fixturePage(page, game);
  await page.evaluate(() => window.fixture.state.resolveSession({ data: { session: null } }));
  await page.locator('[data-language-select]').selectOption('en', { force: true });
  await page.locator('.cloud-account button').click();
  await page.locator('[name=username]').fill('Alice');
  await page.locator('[name=password]').fill('abcdef');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.locator('[name=password]')).toHaveAttribute('type', 'text');
  await page.locator('[data-language-select]').evaluate((select) => {
    select.value = 'de';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('[name=username]')).toHaveValue('Alice');
  await expect(page.locator('[name=password]')).toHaveValue('abcdef');
  await page.locator('.cloud-form button[type=submit]').click();
  await expect(page.locator('.cloud-form-error')).not.toBeEmpty();
  expect(await page.evaluate(() => window.fixture.state.authCalls[0].params.email)).toMatch(
    /@users\.mind-lab\.invalid$/,
  );
  expect(errors).toEqual([]);
});
test('the three charts update only for the selected variant and survive keyboard inspection', async ({
  page,
}) => {
  await fixturePage(page, game);
  await signedIn(page);
  await expect(page.locator('.cloud-chart')).toHaveCount(3);
  await expect(page.locator('.cloud-panels select')).toHaveCount(0);
  const last = () => page.evaluate(() => window.fixture.state.dashboardCalls.at(-1)?.args);
  expect((await last()).p_rules.size).toBe(5);
  await page.locator('[name=size][value="6"]').check({ force: true });
  await expect.poll(async () => (await last()).p_rules.size).toBe(6);
  const chart = page.locator('.cloud-chart').last();
  await chart.focus();
  await page.keyboard.press('End');
  const selected = await chart.getAttribute('data-point');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(chart).toBeFocused();
  await expect(chart).toHaveAttribute('data-point', selected);
  await page.evaluate(() => window.fixture.state.session(null));
  await expect(page.locator('.cloud-chart')).toHaveCount(1);
});
test('finishing a real game submits once and leaves other accounts pending records alone', async ({
  page,
}) => {
  await fixturePage(page, game);
  await signedIn(page);
  await page.locator('#action').click();
  await page.locator('#board button').filter({ hasText: /^1$/ }).click();
  await page.locator('#board button').filter({ hasText: /^3$/ }).click();
  await expect.poll(() => page.evaluate(() => window.fixture.state.submitCalls.length)).toBe(1);
  const submitted = await page.evaluate(() => window.fixture.state.submitCalls[0]);
  expect(submitted.p_owner).toBe('alice');
  expect(submitted.p_game_id).toBe('schulte-table');
  expect(submitted.p_record.meta.rules.size).toBe(5);
  await page.reload();
  await signedIn(page);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.fixture.state.submitCalls.length)).toBe(0);
});
test('an account change discards an in-flight dashboard response without exposing previous personal scores', async ({
  page,
}) => {
  await fixturePage(page, game);
  await page.evaluate(() => {
    window.fixture.state.holdDashboard = true;
  });
  await signedIn(page);
  await expect
    .poll(() => page.evaluate(() => window.fixture.state.dashboards.length))
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    window.fixture.state.session('bob');
  });
  await page.waitForTimeout(30);
  await page.evaluate(() => {
    const f = window.fixture.state;
    f.dashboards[0].resolve({ data: f.data(999) });
    f.holdDashboard = false;
  });
  await expect(page.locator('.cloud-account button')).toHaveText('bob');
  await expect(page.locator('.cloud-panels')).not.toContainText('999');
  await expect(page.locator('.cloud-chart')).toHaveCount(3);
});
