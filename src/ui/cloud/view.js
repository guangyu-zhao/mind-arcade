import { element } from '../dom.js';
import { button, labeled } from './elements.js';
import { text } from '../../i18n/cloud.js';
import { createCharts } from './charts.js';
import { createAccountDialog } from './account.js';

export function mountCloudView({ game, account, queue, statistics, isRunning, retry }) {
  const root = document.querySelector('.page') || document.body;
  const accountBox = element('div', 'cloud-account'),
    dialog = createAccountDialog(account, isRunning);
  const accountButton = button('login', () => dialog.open());
  accountBox.append(accountButton);
  document.querySelector('.site-header')?.append(accountBox);
  let panels,
    publicBody,
    personalBody,
    trendBody,
    statusNode,
    retryButton,
    resizeObserver,
    width = 0,
    frame,
    afterGame = false;
  const charts = game ? createCharts(game.metric) : null;
  const savedStatus = game ? element('p', 'cloud-save-status') : null;
  if (savedStatus) {
    savedStatus.hidden = true;
    savedStatus.setAttribute('role', 'status');
    document.getElementById('result-note')?.after(savedStatus);
  }
  function renderAccount() {
    const { user, profile, ready } = account.state;
    accountButton.textContent = user
      ? profile?.username || user.user_metadata?.username || text('account')
      : text('login');
    accountButton.disabled = !ready || isRunning();
    accountButton.setAttribute(
      'aria-label',
      user ? `${text('account')}: ${accountButton.textContent}` : text('login'),
    );
  }
  function renderStatus() {
    if (!statusNode) return;
    const { waiting, failed, flushing, error, unavailable } = queue.state;
    if (savedStatus) {
      const latest = queue.state.latest;
      savedStatus.hidden = !latest;
      savedStatus.dataset.state = latest?.status || '';
      savedStatus.textContent = latest ? text(`save-${latest.status}`) : '';
    }
    const messages = [];
    if (flushing) messages.push(text('syncing'));
    else if (waiting) messages.push(`${waiting} ${text('pending')}`);
    if (failed) messages.push(`${failed} ${text('failed')}`);
    const errors = [
      ...new Set([account.state.error, error, statistics.state.error].filter(Boolean)),
    ];
    messages.push(...errors.map(text));
    if (unavailable && (waiting || failed)) messages.push(text('keepOpen'));
    statusNode.textContent = messages.join(' · ');
    statusNode.dataset.error = String(!!failed || !!errors.length);
    retryButton.hidden = !failed && !waiting && !errors.length;
    retryButton.disabled = flushing;
    statusNode.parentElement.hidden = !messages.length;
  }
  function renderData(force = false) {
    if (!panels) return;
    if (isRunning() && !force) {
      afterGame = true;
      return;
    }
    afterGame = false;
    const bodies = [publicBody, personalBody, trendBody],
      focused = document.activeElement;
    const focusIndex =
      !force && focused?.matches('.cloud-chart')
        ? bodies.findIndex((body) => body.contains(focused))
        : -1;
    const selected = Number(focused?.dataset?.point ?? 0);
    bodies.forEach((body) => body.replaceChildren());
    const { snapshot, error } = statistics.state,
      empty = error || 'loading';
    publicBody.append(
      snapshot?.population.aggregation === 'recent-five-mean'
        ? charts.histogram(
            snapshot.population.histogram,
            publicBody,
            text('populationDistribution'),
            { count: 'players', horizontal: text('recentFiveMean'), decimals: 3 },
          )
        : labeled('p', snapshot ? 'statisticsUpdate' : empty, 'cloud-empty'),
    );
    if (!account.state.user) {
      for (const body of [personalBody, trendBody]) {
        const prompt = element('div', 'cloud-empty');
        prompt.append(button('signInPrompt', () => dialog.open('login')));
        body.append(prompt);
      }
    } else if (!snapshot) {
      personalBody.append(labeled('p', empty, 'cloud-empty'));
      trendBody.append(labeled('p', empty, 'cloud-empty'));
    } else {
      personalBody.append(
        charts.histogram(snapshot.personal.histogram, personalBody, text('personalDistribution')),
      );
      trendBody.append(charts.trend(snapshot.history, trendBody));
    }
    const replacement = bodies[focusIndex]?.querySelector('.cloud-chart');
    if (replacement) {
      replacement.focus({ preventScroll: true });
      charts.restore(replacement, selected);
    }
    renderStatus();
  }
  if (game) {
    panels = element('section', 'cloud-panels');
    const panel = (key, wide = false) => {
      const section = element('section', `cloud-panel${wide ? ' cloud-wide' : ''}`),
        heading = labeled('h2', key),
        body = element('div', 'cloud-chart-body');
      heading.id = `cloud-${key}`;
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading, body);
      panels.append(section);
      return body;
    };
    publicBody = panel('populationDistribution');
    personalBody = panel('personalDistribution');
    trendBody = panel('trend', true);
    const wrap = element('div', 'cloud-status-wrap');
    wrap.hidden = true;
    statusNode = element('p', 'cloud-status');
    statusNode.setAttribute('role', 'status');
    retryButton = button('retry', retry);
    retryButton.hidden = true;
    wrap.append(statusNode, retryButton);
    panels.append(wrap);
    (document.querySelector('main') || root).append(panels);
    resizeObserver = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next === width) return;
      width = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => renderData());
    });
    resizeObserver.observe(panels);
  }
  function translate() {
    document.querySelectorAll('[data-cloud-text]').forEach((node) => {
      node.textContent = text(node.dataset.cloudText);
    });
    document.querySelectorAll('[data-cloud-label]').forEach((node) => {
      node.setAttribute('aria-label', text(node.dataset.cloudLabel));
      node.title = text(node.dataset.cloudLabel);
    });
    renderAccount();
    renderData();
    renderStatus();
    dialog.translate();
  }
  window.addEventListener('mindlab-language-change', translate);
  translate();
  return {
    renderAccount,
    renderData,
    renderStatus,
    closeAccount: dialog.close,
    resume() {
      if (afterGame) renderData();
    },
    dispose() {
      window.removeEventListener('mindlab-language-change', translate);
      resizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      dialog.dispose();
      accountBox.remove();
      panels?.remove();
      savedStatus?.remove();
    },
  };
}
