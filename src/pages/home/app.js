import { Text } from '../../i18n/runtime.js';
import { gamesById } from '../../catalog.js';
export function mountOverview() {
  const L = Text;
  const sections = [...document.querySelectorAll('[data-category]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const status = document.getElementById('filter-status');
  const filterKey = 'mind-arcade.overview-category';
  const favoriteKey = 'mind-arcade.favorites',
    favoriteSection = document.querySelector('[data-favorites-section]'),
    favoriteGrid = document.querySelector('[data-favorites-grid]'),
    tiles = [...document.querySelectorAll('.game-tile')],
    homes = new Map(tiles.map((tile) => [tile, tile.parentElement])),
    favorites = new Set();
  function readFavorites() {
    favorites.clear();
    try {
      const value = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
      if (Array.isArray(value)) for (const id of value) if (gamesById.has(id)) favorites.add(id);
    } catch {}
  }
  readFavorites();
  let category = 'all';
  try {
    const saved = sessionStorage.getItem(filterKey);
    if (filters.some((button) => button.dataset.filter === saved)) category = saved;
  } catch {}
  function applyFilter() {
    const focused = document.activeElement?.dataset?.favorite;
    tiles.forEach((tile) => homes.get(tile).append(tile));
    if (category === 'all' || category === 'favorites')
      tiles
        .filter((tile) => favorites.has(tile.dataset.game))
        .forEach((tile) => favoriteGrid.append(tile));
    favoriteSection.hidden = category !== 'favorites' && (category !== 'all' || !favorites.size);
    favoriteSection.querySelector('.favorites-empty').hidden = favorites.size > 0;
    sections.forEach((section) => {
      section.querySelector('.section-count').textContent = String(
        section.querySelectorAll('.game-card').length,
      );
      section.hidden =
        (category !== 'all' && section.dataset.category !== category) ||
        !section.querySelector('.game-card');
    });
    filters.forEach((filter) =>
      filter.setAttribute('aria-pressed', String(filter.dataset.filter === category)),
    );
    tiles.forEach((tile) => {
      const button = tile.querySelector('[data-favorite]'),
        id = tile.dataset.game,
        label = L.t(favorites.has(id) ? 'home.remove-favorite' : 'home.add-favorite', {
          name: L.t(gamesById.get(id).name),
        });
      button.hidden = false;
      button.setAttribute('aria-pressed', String(favorites.has(id)));
      button.setAttribute('aria-label', label);
      button.title = label;
    });
    if (focused)
      document.querySelector(`[data-favorite="${focused}"]`)?.focus({ preventScroll: true });
  }
  function updateStatus() {
    const visible = sections.filter((section) => !section.hidden);
    const count =
      (favoriteSection.hidden ? 0 : favorites.size) +
      visible.reduce((sum, section) => sum + section.querySelectorAll('.game-card').length, 0);
    const name =
      category === 'all'
        ? L.t('game.all-games')
        : category === 'favorites'
          ? L.t('home.favorites')
          : visible[0]?.querySelector('h2').textContent || '';
    status.textContent = L.t('game.value-value-games', { name, count });
  }
  function translate() {
    applyFilter();
    document.title = L.t('game.mind-arcade');
    document.querySelector('meta[name="description"]').content = L.t(
      'game.games-for-working-memory-processing-speed-attention-and-cognitive',
    );
    updateStatus();
  }
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      category = button.dataset.filter;
      applyFilter();
      try {
        sessionStorage.setItem(filterKey, category);
      } catch {}
      updateStatus();
    }),
  );
  tiles.forEach((tile) =>
    tile.querySelector('[data-favorite]').addEventListener('click', () => {
      const id = tile.dataset.game;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      try {
        localStorage.setItem(favoriteKey, JSON.stringify([...favorites]));
      } catch {}
      applyFilter();
      updateStatus();
    }),
  );
  window.addEventListener('storage', (event) => {
    if (event.key !== favoriteKey) return;
    readFavorites();
    applyFilter();
    updateStatus();
  });
  window.addEventListener('mindlab-language-change', translate);
  document.querySelector('.filter-count').textContent = String(
    document.querySelectorAll('.game-card').length,
  );
  translate();
  document.querySelector('.filters').hidden = false;
}
