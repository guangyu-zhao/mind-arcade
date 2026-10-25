import { games } from '../catalog.js';

export const recordKey = (game) => `mind-arcade.records.${game}`;

export function clearRetiredScores(storage) {
  const prefixes = new Set([
    ...games.map((game) => game.id),
    ...games.map((game) => game.config.slug).filter(Boolean),
    'schulte-grid',
    'sleep-choice',
    'sleep-pvt',
    'sleep-gonogo',
    'direction-recall',
  ]);
  try {
    storage ??= globalThis.localStorage;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      const match = key?.match(/^(.*)\.records\.v\d+$/);
      if ((match && prefixes.has(match[1])) || key?.startsWith('mind-lab.pending.v1:')) {
        storage.removeItem(key);
      }
    }
  } catch {}
}
