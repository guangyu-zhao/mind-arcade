import { Core } from '../../../core/index.js';
import { stimulusColors } from '../../../core/palette.js';
import { GameI18n as I18n, Text } from '../../../i18n/runtime.js';
import { element } from '../../../ui/dom.js';
import {
  CHANNELS,
  DEFAULTS,
  EXPOSURE_MS,
  SCORED_TRIALS,
  VERSION,
  activeChannels,
  readRules,
  responseWindow,
} from './rules.js';
import { generateSequence, scoreTrials, validateRecords } from './model.js';
import { shapeDrawing } from './shapes.js';
import { createLetterAudio } from './audio.js';

export function mountGame({ random = Math.random } = {}) {
  const $ = (id) => document.getElementById(id),
    form = $('settings'),
    slider = $('display-scale'),
    matrix = $('matrix'),
    frame = $('matrix-frame'),
    responses = $('responses'),
    storageKey = Core.recordKey('mn-back'),
    settingsKey = 'mn-back.settings.v1',
    scaleKey = 'mn-back.scale.v1',
    colors = Object.values(stimulusColors),
    audio = createLetterAudio();
  let settings = { ...DEFAULTS },
    records = [],
    running = false,
    session = null,
    revision = 0,
    raf = 0,
    noticeTimer,
    lastProgress = -1,
    result = null,
    phase = 'ready',
    deadline = 0,
    countdown = 0,
    index = -1,
    selected = new Set(),
    cells = [],
    buttons = new Map();
  const history = Core.createHistory({
    version: VERSION,
    rules: () => settings,
    display: () => frame,
    interrupt: () => cancel('ui.session-interrupted-no-result-saved'),
  });

  function notify(message) {
    clearTimeout(noticeTimer);
    I18n.text($('notice'), message);
    $('notice').hidden = false;
    noticeTimer = setTimeout(() => {
      $('notice').hidden = true;
    }, 6500);
  }
  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      notify('ui.local-storage-unavailable');
    }
  }
  try {
    const saved = localStorage.getItem(settingsKey);
    if (saved) settings = readRules(JSON.parse(saved));
  } catch {}
  try {
    records = Core.readRecords(storageKey, validateRecords);
  } catch {
    notify('ui.local-storage-unavailable');
  }
  for (const input of form.elements) {
    if (input.type === 'radio') input.checked = Number(input.value) === settings[input.name];
    if (input.type === 'checkbox')
      input.checked = input.name === 'position' || settings[input.name];
  }
  function scale(value) {
    const next = Number.isFinite(value)
      ? Math.round(Math.max(40, Math.min(100, value)) / 5) * 5
      : 100;
    slider.value = String(next);
    slider.setAttribute('aria-valuetext', `${next}%`);
    $('display-scale-value').value = `${next}%`;
    frame.style.setProperty('--display-scale', next / 100);
  }
  let savedScale = 100;
  try {
    savedScale = Number(localStorage.getItem(scaleKey) || 100);
  } catch {}
  scale(savedScale);
  slider.addEventListener('input', () => {
    if (!running) scale(Number(slider.value));
  });
  slider.addEventListener('change', () => {
    if (!running) store(scaleKey, slider.value);
  });

  function lock(value) {
    for (const input of form.querySelectorAll('input'))
      input.disabled = value || input.name === 'position';
    slider.disabled = value;
    document.body.classList.toggle('running', value);
    I18n.text($('action-label'), value ? 'ui.cancel-round' : 'ui.start');
    $('action-icon').hidden = value;
  }
  function setProgress(value) {
    const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
    if (lastProgress === percent) return;
    lastProgress = percent;
    $('response-fill').style.width = `${percent}%`;
    $('response-progress').setAttribute('aria-valuenow', String(percent));
  }
  function clearStimulus() {
    for (const cell of cells) {
      cell.className = 'mn-cell';
      cell.style.removeProperty('--stimulus-color');
      cell.replaceChildren();
    }
    audio.stop();
  }
  function canRespond() {
    if (!running || !['exposure', 'response'].includes(phase) || index < session.rules.n)
      return false;
    if (!history.checkTiming()) return false;
    return phase !== 'response' || performance.now() < deadline;
  }
  function toggle(channel) {
    if (!buttons.has(channel) || !canRespond()) return;
    if (selected.has(channel)) selected.delete(channel);
    else selected.add(channel);
    buttons.get(channel).setAttribute('aria-pressed', String(selected.has(channel)));
  }
  function renderBoard() {
    clearStimulus();
    matrix.style.setProperty('--side', settings.size);
    cells = Array.from({ length: settings.size ** 2 }, () => element('div', 'mn-cell'));
    matrix.replaceChildren(...cells);
    buttons = new Map();
    responses.replaceChildren();
    const channels = activeChannels(settings);
    responses.style.setProperty('--channels', channels.length);
    for (const channel of channels) {
      const button = element('button'),
        label = element('span'),
        key = element('kbd', '', CHANNELS.indexOf(channel) + 1),
        check = element('span', 'mn-check', '✓');
      button.type = 'button';
      button.dataset.channel = channel;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-keyshortcuts', String(CHANNELS.indexOf(channel) + 1));
      check.setAttribute('aria-hidden', 'true');
      I18n.text(label, `mn.${channel}`);
      button.append(label, key, check);
      let pointerTrial = null;
      button.addEventListener('pointerdown', () => {
        pointerTrial = canRespond() ? index : null;
      });
      button.addEventListener('click', (event) => {
        if (event.detail && pointerTrial !== index) return;
        toggle(channel);
      });
      button.addEventListener('keydown', (event) => {
        if (![' ', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        if (
          !event.repeat &&
          !event.isComposing &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.shiftKey
        )
          toggle(channel);
      });
      buttons.set(channel, button);
      responses.append(button);
    }
  }
  function refresh() {
    const warmup = running && index >= 0 && index < session.rules.n;
    I18n.text(
      $('phase-label'),
      running
        ? phase === 'loading'
          ? 'mn.loading-audio'
          : phase === 'countdown'
            ? 'mn.get-ready'
            : warmup
              ? 'mn.memorize'
              : 'mn.judge'
        : result
          ? 'ui.complete-2'
          : 'ui.ready',
    );
    $('round-counter').textContent =
      running && index >= 0
        ? `${warmup ? index + 1 : index - session.rules.n + 1} / ${warmup ? session.rules.n : SCORED_TRIALS}`
        : '';
    $('cover').hidden = running && index >= 0;
    $('cover').classList.toggle('countdown', phase === 'countdown');
    I18n.text(
      $('cover-title'),
      phase === 'countdown'
        ? String(countdown)
        : phase === 'loading'
          ? 'mn.loading-audio'
          : result
            ? 'ui.complete-2'
            : 'ui.ready',
    );
    $('cover-caption').textContent =
      running || result ? '' : Text.t('mn.warmup-count', { n: settings.n });
    $('board-hint').textContent =
      !running || index < 0
        ? !running && !result
          ? Text.t('mn.match-instruction')
          : ''
        : warmup
          ? Text.t('mn.warmup-hint')
          : Text.t('mn.judge-hint', { n: session.rules.n });
    for (const button of buttons.values()) button.disabled = !running || index < session.rules.n;
    $('response-progress').style.visibility = running && index >= 0 ? 'visible' : 'hidden';
    $('score-value').textContent = result
      ? result.score.toLocaleString(Text.locale, { maximumFractionDigits: 2 })
      : '—';
    $('result-details').hidden = !result;
    $('result-details').replaceChildren(
      ...(result
        ? ['hits', 'falseAlarms', 'misses'].map((key) =>
            element('span', '', Text.t(`mn.${key}`, { count: result[key] })),
          )
        : []),
    );
  }
  function cleanup() {
    running = false;
    revision++;
    cancelAnimationFrame(raf);
    clearStimulus();
    selected.clear();
    for (const button of buttons.values()) button.setAttribute('aria-pressed', 'false');
    setProgress(0);
    lock(false);
  }
  function cancel(message = 'ui.round-canceled-no-score-was-saved') {
    if (!running) return;
    cleanup();
    history.cancel();
    phase = 'ready';
    session = null;
    refresh();
    I18n.text($('result-note'), message);
  }
  function finish() {
    result = scoreTrials(session.trials, session.rules);
    const record = {
      id: crypto.randomUUID(),
      endedAt: new Date().toISOString(),
      meta: history.finish(session.meta),
      reason: 'complete',
      elapsedMs: session.trials.reduce(
        (sum, trial) => sum + trial.exposureMs + trial.responseMs,
        0,
      ),
      score: result.score,
      trials: session.trials,
    };
    validateRecords([record]);
    cleanup();
    phase = 'complete';
    records = Core.mergeRecords(records, [record]);
    Core.commitRecord(record);
    try {
      records = Core.saveRecords(storageKey, records, validateRecords);
      I18n.text($('result-note'), 'ui.saved');
    } catch {
      notify('ui.local-storage-unavailable');
      I18n.text($('result-note'), 'ui.local-result-kept-on-page');
    }
    refresh();
    history.updateContext();
  }
  function showTrial(now) {
    index++;
    if (index === session.sequence.length) {
      finish();
      return;
    }
    phase = 'exposure';
    selected.clear();
    for (const button of buttons.values()) button.setAttribute('aria-pressed', 'false');
    const stimulus = session.sequence[index],
      cell = cells[stimulus.position];
    cell.classList.add('lit');
    if (session.rules.color) cell.style.setProperty('--stimulus-color', colors[stimulus.color]);
    if (session.rules.shape) {
      cell.classList.add('with-shape');
      cell.append(shapeDrawing(stimulus.shape));
    }
    try {
      if (session.rules.sound) audio.play(stimulus.sound);
    } catch {
      cancel('mn.audio-failed');
      return;
    }
    session.started = now;
    deadline = now + EXPOSURE_MS;
    setProgress(1);
    refresh();
  }
  function tick(now) {
    if (!running || !history.checkPresentation(deadline)) return;
    if (now >= deadline) {
      if (phase === 'countdown') {
        if (--countdown === 0) showTrial(now);
        else {
          deadline = now + 1000;
          refresh();
        }
      } else if (phase === 'exposure') {
        session.exposureMs = now - session.started;
        clearStimulus();
        phase = 'response';
        session.blankStarted = now;
        deadline = now + responseWindow(session.rules);
      } else if (phase === 'response') {
        session.trials.push({
          stimulus: session.sequence[index],
          responses: [...selected],
          exposureMs: session.exposureMs,
          responseMs: now - session.blankStarted,
        });
        showTrial(now);
      }
    }
    if (running) {
      if (phase === 'response') setProgress((deadline - now) / responseWindow(session.rules));
      raf = requestAnimationFrame(tick);
    }
  }
  async function start() {
    const token = ++revision;
    running = true;
    result = null;
    index = -1;
    selected.clear();
    lock(true);
    I18n.text($('result-note'), '');
    phase = settings.sound ? 'loading' : 'countdown';
    countdown = 3;
    session = {
      rules: { ...settings },
      sequence: generateSequence(settings, random),
      trials: [],
      meta: history.begin(),
    };
    refresh();
    try {
      if (settings.sound) await audio.prepare();
    } catch {
      if (token === revision) cancel('mn.audio-failed');
      return;
    }
    if (token !== revision) return;
    phase = 'countdown';
    deadline = performance.now() + 1000;
    refresh();
    raf = requestAnimationFrame(tick);
  }
  $('action').addEventListener('click', () => {
    if (running) cancel();
    else void start();
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('change', () => {
    if (running) return;
    settings = readRules({
      size: Number(form.elements.size.value),
      n: Number(form.elements.n.value),
      sound: form.elements.sound.checked,
      shape: form.elements.shape.checked,
      color: form.elements.color.checked,
    });
    store(settingsKey, JSON.stringify(settings));
    result = null;
    phase = 'ready';
    I18n.text($('result-note'), '');
    renderBoard();
    refresh();
    history.updateContext();
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      event.target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"]')
    )
      return;
    const channel = CHANNELS[Number(event.key) - 1];
    if (channel && buttons.has(channel) && canRespond()) {
      event.preventDefault();
      toggle(channel);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel('ui.you-left-the-page-no-score-was-saved');
  });
  window.addEventListener('pagehide', () => cancel('ui.you-left-the-page-no-score-was-saved'));
  window.addEventListener('mindlab-language-change', refresh);
  renderBoard();
  refresh();
  history.updateContext();
}
