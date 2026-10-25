import { Text, mountLanguage } from './i18n/runtime.js';
import { currentGame } from './catalog.js';
import { Select } from './ui/select.js';
import { mountPage } from './ui/page.js';
import { mountCloud } from './services/cloud/client.js';
import { clearRetiredScores } from './core/storage.js';

export function bootstrap({ cloud } = {}) {
  clearRetiredScores();
  mountLanguage();
  const game = currentGame();
  const updateTitle = () => {
    const name = Text.t(game?.name || 'game.mind-arcade');
    document.querySelector('[data-game-title]').textContent = name;
    document.title = name;
  };
  updateTitle();
  window.addEventListener('mindlab-language-change', updateTitle);
  Select.enhance();
  mountPage();
  return mountCloud(cloud);
}
