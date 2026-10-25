import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function fixturePage(page, game, params = 'fixture=cloud') {
  const html = await readFile(`.generated/${game.route}/index.html`, 'utf8');
  const script = `/mind-arcade/@fs${resolve('tests/fixtures/game.js')}`;
  await page.route(`**/${game.route}/?**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: html.replace(
        /<script type="module"[^>]*><\/script>/,
        `<script type="module" src="${script}"></script>`,
      ),
    }),
  );
  await page.goto(`${game.route}/?${params}`);
  await page.locator('html[data-fixture-ready="true"]').waitFor({ state: 'attached' });
}
export async function signedIn(page, id = 'alice', pausedClock = false) {
  await page.locator('html[data-fixture-ready="true"]').waitFor({ state: 'attached' });
  await page.evaluate((id) => {
    window.fixture.state.session(id);
    window.fixture.state.resolveSession({ data: { session: null } });
  }, id);
  if (pausedClock) await page.clock.runFor(1);
  await expect.poll(() => page.evaluate(() => window.fixture.service.userId)).toBe(id);
}
