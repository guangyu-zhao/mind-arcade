import { Text } from '../../i18n/runtime.js';
const strings = {
  language: 'ui.language',
  ready: 'ui.ready',
  start: 'ui.start',
  again: 'span.play-again',
  stop: 'ui.end-save',
  how: 'span.how-to-play',
  storageFailed: 'ui.local-storage-unavailable',
  submit: 'span.confirm',
  next: 'span.next',
  saved: 'ui.saved',
  canceled: 'ui.round-canceled-no-score-was-saved',
  interrupted: 'span.session-interrupted',
  hiddenStop: 'span.the-session-ended-when-the-page-was-hidden-you-can-start-again',
  resizeStop: 'span.the-display-size-changed-please-start-again',
  timingStop: 'span.the-display-paused-please-start-again',
  errorStop: 'span.this-session-could-not-finish-you-can-start-again',
  displayScale: 'ui.display-size',
  selected: 'span.selected-value-value',
  undo: 'span.undo',
  cell: 'span.row-value-column-value',
  lost: 'ui.local-result-kept-on-page',
  levelUnit: 'span.unit',
  levelValue: 'span.level-value',
  startNote: 'span.start-at-level-1-3-lives',
  challengeRules: 'span.pass-to-advance-one-level-a-miss-costs-one-life-retry-the-same-le',
  livesLeft: 'span.value-lives-remaining',
  nextLevel: 'span.next-level',
  retryLevel: 'span.retry-level',
  levelPassed: 'span.level-value-cleared',
  levelMissed: 'span.level-not-cleared-value-lives-left',
  stopped: 'span.session-ended',
  finalLevel: 'span.highest-cleared-level-value',
  notInTrend: 'span.interrupted-excluded-from-level-history',
  gameOverLevel: 'span.game-over-highest-cleared-level-value',
  noLevel: 'span.level-1-not-yet-cleared',
  noLevelFinished: 'span.game-over-level-1-not-yet-cleared',
  reviewTitle: 'span.review-title',
  reviewItem: 'span.review-item',
  reviewYourAnswer: 'span.review-your-answer',
  reviewExpected: 'span.review-expected',
  reviewTimeout: 'span.review-timeout',
  reviewPrevious: 'game.previous',
  reviewNext: 'game.next',
};
const L = Text;
function tr(key, values = {}) {
  const entry = strings[key];
  return entry ? (typeof entry === 'function' ? entry(values) : L.t(entry, values)) : key;
}
function text(node, key, values = {}) {
  node.dataset.l10n = key;
  node.dataset.values = JSON.stringify(values);
  node.textContent = tr(key, values);
  return node;
}
function label(node, key, values = {}) {
  node.dataset.l10nAria = key;
  node.dataset.ariaValues = JSON.stringify(values);
  node.setAttribute('aria-label', tr(key, values));
  return node;
}
function update() {
  document.querySelectorAll('[data-l10n]').forEach((n) => {
    n.textContent = tr(n.dataset.l10n, JSON.parse(n.dataset.values || '{}'));
  });
  document
    .querySelectorAll('[data-l10n-aria]')
    .forEach((n) =>
      n.setAttribute(
        'aria-label',
        tr(n.dataset.l10nAria, JSON.parse(n.dataset.ariaValues || '{}')),
      ),
    );
  document.title = tr('title');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = tr('intro');
  window.dispatchEvent(new Event('game-language-change'));
}
window.addEventListener('mindlab-language-change', update);
const GameText = {
  tr,
  text,
  label,
  add(entries) {
    Object.assign(strings, entries);
  },
  update,
};
export { GameText };
