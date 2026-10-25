import { Text } from '../i18n/runtime.js';
function normalizePageAddress() {
  if (!/^https?:$/.test(location.protocol) || !location.pathname.endsWith('/index.html')) return;
  const url = new URL(location.href);
  url.pathname = url.pathname.slice(0, -'index.html'.length);
  history.replaceState(history.state, '', url);
}
function keepGameVisible() {
  const panel = document.querySelector('.board-panel');
  if (!panel) return;
  let running = document.body.classList.contains('running');
  new MutationObserver(() => {
    const next = document.body.classList.contains('running'),
      starting = next && !running;
    running = next;
    if (!starting || !matchMedia('(max-width:900px)').matches) return;
    const bounds = panel.getBoundingClientRect();
    const height = window.visualViewport?.height || innerHeight;
    if (bounds.top < 12 || bounds.bottom > height - 12) {
      const shift = bounds.height <= height - 24 ? bounds.bottom - height + 12 : bounds.top - 12;
      window.scrollBy({ top: bounds.top < 12 ? bounds.top - 12 : shift, behavior: 'instant' });
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
function updateLabels() {
  document.querySelectorAll('[data-core-text="overview"]').forEach((node) => {
    node.textContent = Text.t('game.overview');
  });
}
export function mountPage() {
  normalizePageAddress();
  updateLabels();
  keepGameVisible();
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.repeat &&
        ['Enter', ' '].includes(event.key) &&
        event.target instanceof Element &&
        event.target.closest('button')
      )
        event.preventDefault();
    },
    { capture: true },
  );
  window.addEventListener('mindlab-language-change', updateLabels);
}
