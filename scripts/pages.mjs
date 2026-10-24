import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { translate } from '../src/i18n/translate.js';
import { localizeHTML } from './localize-html.mjs';
import { games, categories } from '../src/catalog.js';
const root = resolve(import.meta.dirname, '..');
const read = (name) => readFile(resolve(root, name), 'utf8');
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const render = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
const translated = (tag, pair, attrs = '') => {
  const id = pair;
  return `<${tag} ${attrs} data-i18n="${id}">${escape(translate(id))}</${tag}>`;
};
export async function generatePages({ output = resolve(root, '.generated') } = {}) {
  const [page, header, icons] = await Promise.all([
    read('src/ui/templates/page.html'),
    read('src/ui/templates/header.html'),
    read('src/pages/home/icons.html'),
  ]);
  const inputs = {};
  async function emit(route, id, html) {
    const folder = resolve(output, route);
    await mkdir(folder, { recursive: true });
    const target = resolve(folder, 'index.html');
    await writeFile(target, html);
    inputs[id] = target;
  }
  for (const game of games) {
    const body = localizeHTML(
      render(await read(`${game.source}/view.html`), {
        header: render(header, {
          title: escape(translate(game.name)),
          back: '<nav class="back-nav"><a class="back-link" href="../../">← <span data-core-text="overview">总览</span></a></nav>',
        }),
      }),
    );
    const entry = [
      ...game.assets.styles.map((style) => `import '/${style}';`),
      "import { bootstrap } from '/src/bootstrap.js';",
      "import { mountTaskSettings } from '/src/ui/settings.js';",
      'bootstrap();',
      `const { mountGame } = await import('/${game.assets.entry}');`,
      'mountGame();',
      'mountTaskSettings();',
      "document.documentElement.dataset.ready = 'true';",
    ].join('\n');
    await mkdir(resolve(output, game.route), { recursive: true });
    await writeFile(resolve(output, game.route, 'entry.js'), entry);
    await emit(
      game.route,
      game.id,
      render(page, {
        id: game.id,
        title: escape(translate(game.name)),
        description: escape(translate(game.description)),
        bodyClass: game.bodyClass,
        entry: './entry.js',
        body,
      }),
    );
  }
  const filters = `<nav class="filters" aria-label="筛选分类" data-i18n-attrs='{"aria-label":"catalog.filter-by-category"}' hidden><button type="button" data-filter="all" aria-controls="games" aria-pressed="true">${translated('span', 'game.all-games')}<span class="filter-count">${games.length}</span></button><button type="button" data-filter="favorites" aria-controls="games" aria-pressed="false">${translated('span', 'home.favorites')}</button>${categories.map((c) => `<button type="button" data-filter="${c.id}" aria-controls="games" aria-pressed="false"><span class="category-dot ${c.id}" aria-hidden="true"></span>${translated('span', c.name)}</button>`).join('')}</nav><p id="filter-status" class="sr-only" role="status" aria-live="polite"></p>`;
  const sections = categories
    .map((category) => {
      const group = games.filter((g) => g.category === category.id);
      const cards = group
        .map(
          (g) =>
            `<div class="game-tile ${category.id}" data-game="${g.id}"><a class="game-card" href="./${g.route}/" aria-labelledby="${g.id}-title" aria-describedby="${g.id}-description"><span class="icon-tile"><svg class="game-icon" aria-hidden="true"><use href="#${g.icon}"/></svg></span><div class="card-copy">${translated('h3', g.name, `id="${g.id}-title"`)}${translated('p', g.description, `id="${g.id}-description"`)}</div><svg class="card-arrow" aria-hidden="true"><use href="#arrow"/></svg></a><button type="button" class="favorite-button" data-favorite="${g.id}" aria-pressed="false" aria-label="${escape(translate('home.add-favorite', { name: translate(g.name) }))}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L2.9 9.6l6.3-.9Z"/></svg></button></div>`,
        )
        .join('');
      return `<section class="category ${category.id}" data-category="${category.id}" aria-labelledby="${category.id}-title"><div class="section-heading">${translated('h2', category.name, `id="${category.id}-title"`)}<span class="section-count" aria-hidden="true">${group.length}</span><span class="category-name" lang="en">${translate(category.name, {}, 'en')}</span></div><div class="cards-viewport" tabindex="0" role="group" aria-labelledby="${category.id}-title"><div class="game-grid">${cards}</div></div></section>`;
    })
    .join('');
  await emit(
    '',
    'index',
    render(page, {
      id: '',
      title: '思维游乐场',
      description: '工作记忆、加工速度、注意力与认知控制。',
      entry: '/src/pages/home/entry.js',
      body:
        icons +
        '<div class="page">' +
        render(header, { title: '思维游乐场' }) +
        filters +
        '<main id="games"><section class="category favorites" data-favorites-section hidden><div class="section-heading"><h2 data-i18n="home.favorites">常用</h2></div><div class="cards-viewport"><div class="game-grid" data-favorites-grid></div></div><p class="favorites-empty" data-i18n="home.favorites-empty" hidden>点击星标收藏游戏。</p></section>' +
        sections +
        '</main></div>',
    }),
  );
  return inputs;
}
