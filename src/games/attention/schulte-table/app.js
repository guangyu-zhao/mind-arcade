import { currentGame } from '../../../catalog.js';
import { Core } from '../../../core/index.js';
import { GameI18n } from '../../../i18n/runtime.js';
export function mountGame() {
  const I18n = GameI18n;
  const m = I18n.message;

  const RECORDS_KEY = Core.recordKey(currentGame().id);
  const SETTINGS_KEY = 'schulte-grid.settings.v1';
  const SCALE_KEY = 'schulte-grid.matrix-scale.v1';
  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const scaleSlider = $('matrix-scale');
  const settingsForm = $('settings');

  const defaultSettings = { size: 5, direction: 'asc', disappear: false };
  let settings = { ...defaultSettings };
  let records = [];

  let phase = 'idle';
  let round = null;
  let pointerAnswer = null;
  let completed = 0;
  let score = 0;
  let frame = 0;
  let noticeTimeout = 0;
  let lastTimerValue = '';

  function validSettings(value) {
    return (
      value &&
      Number.isInteger(value.size) &&
      value.size >= 5 &&
      value.size <= 9 &&
      ['asc', 'desc'].includes(value.direction) &&
      typeof value.disappear === 'boolean'
    );
  }

  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => ({ ...settings, durationMs: 30000 }),
    display: () => $('board'),

    interrupt: () => interrupt(),
  });

  function validateRecords(value) {
    if (!Array.isArray(value)) throw new Error('invalid records');
    return value.map((record) => {
      if (
        !validSettings(record) ||
        record.meta?.rulesVersion !== currentGame().version ||
        typeof record.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) ||
        typeof record.endedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.endedAt)) ||
        !Number.isFinite(record.elapsedMs) ||
        record.elapsedMs < 0 ||
        record.elapsedMs > 30000 ||
        record.durationMs !== 30000 ||
        !['error', 'timeout'].includes(record.reason) ||
        (record.reason === 'timeout' && record.elapsedMs !== 30000) ||
        !Number.isSafeInteger(record.score) ||
        record.score < 0
      ) {
        throw new Error('invalid record');
      }
      return {
        meta: Core.readMeta(record.meta),
        id: record.id,
        endedAt: new Date(record.endedAt).toISOString(),
        size: record.size,
        direction: record.direction,
        disappear: record.disappear,
        elapsedMs: Math.round(record.elapsedMs),
        durationMs: 30000,
        reason: record.reason,
        score: record.score,
      };
    });
  }

  const mergeRecords = Core.mergeRecords;

  function notify(message) {
    clearTimeout(noticeTimeout);
    I18n.text($('notice'), message);
    $('notice').hidden = false;
    noticeTimeout = setTimeout(() => {
      $('notice').hidden = true;
    }, 6500);
  }

  function storageFailed() {
    notify('ui.local-storage-unavailable');
  }

  function loadData() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      if (validSettings(parsed))
        settings = { size: parsed.size, direction: parsed.direction, disappear: parsed.disappear };
    } catch {}
    try {
      records = mergeRecords(Core.readRecords(RECORDS_KEY, validateRecords));
    } catch {
      storageFailed();
    }
    let savedScale = 100;
    try {
      const raw = localStorage.getItem(SCALE_KEY);
      if (raw !== null && raw.trim() !== '') savedScale = Number(raw);
    } catch {}
    applyMatrixScale(savedScale);
  }

  function applyMatrixScale(value) {
    const minimum = Number(scaleSlider.min);
    const maximum = Number(scaleSlider.max);
    const step = Number(scaleSlider.step);
    const clamped = Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : maximum;
    const scale = minimum + Math.round((clamped - minimum) / step) * step;
    scaleSlider.value = String(scale);
    I18n.attribute(scaleSlider, 'aria-valuetext', `${scale}%`);
    $('matrix-scale-value').value = `${scale}%`;
    $('board-frame').style.setProperty('--matrix-scale', String(scale / 100));
  }

  scaleSlider.addEventListener('input', () => {
    if (phase !== 'running') applyMatrixScale(Number(scaleSlider.value));
  });
  scaleSlider.addEventListener('change', () => {
    if (phase === 'running') return;
    try {
      localStorage.setItem(SCALE_KEY, scaleSlider.value);
    } catch {}
  });

  function persistRecords() {
    try {
      records = Core.saveRecords(RECORDS_KEY, records, validateRecords);

      return true;
    } catch {
      storageFailed();
      return false;
    }
  }

  function targetNumber() {
    return settings.direction === 'asc' ? completed + 1 : settings.size ** 2 - completed;
  }
  function setTimer(ms) {
    const centiseconds = Math.round(ms / 10);
    const minutes = Math.floor(centiseconds / 6000);
    const remainingSeconds = Math.floor(centiseconds / 100) % 60;
    const fraction = String(centiseconds % 100).padStart(2, '0');
    const value = `${minutes}:${remainingSeconds}:${fraction}`;
    if (value === lastTimerValue) return;
    lastTimerValue = value;
    I18n.text(
      $('timer-main'),
      `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`,
    );
    I18n.text($('timer-fraction'), `.${fraction}`);
  }

  function interrupt() {
    if (phase !== 'running') return;
    ready('ui.session-interrupted-no-result-saved');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) interrupt();
  });
  window.addEventListener('pagehide', interrupt);

  function elapsed() {
    return Core.elapsed(round.startedMono);
  }
  function tick() {
    if (phase !== 'running') return;
    const remaining = 30000 - elapsed();
    setTimer(Math.max(0, remaining));
    if (remaining <= 0) {
      finish('timeout');
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function shuffledNumbers(size) {
    return Core.shuffle(Array.from({ length: size ** 2 }, (_, index) => index + 1));
  }

  function drawBoard(numbers = null) {
    board.style.setProperty('--size', String(settings.size));
    board.dataset.size = String(settings.size);
    I18n.attribute(
      board,
      'aria-label',
      m('ui.value-by-value-number-grid', settings.size, settings.size),
    );
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < settings.size ** 2; index++) {
      const cell = document.createElement('button');
      const number = numbers?.[index];
      cell.type = 'button';
      cell.className = 'cell';
      cell.disabled = !numbers;
      const label = document.createElement('span');
      if (number !== undefined) {
        cell.dataset.number = String(number);
        I18n.text(label, String(number));
        I18n.attribute(cell, 'aria-label', String(number));
      } else {
        I18n.attribute(cell, 'aria-hidden', 'true');
      }
      cell.append(label);
      fragment.append(cell);
    }
    I18n.replaceChildren(board, fragment);
  }

  function updateProgress() {
    const total = settings.size ** 2;
    I18n.text($('next-label'), completed === total ? 'ui.complete-2' : 'ui.next');
    I18n.text($('next-number'), completed === total ? '✓' : String(targetNumber()));
    I18n.replaceChildren($('board-count'), document.createTextNode(`${completed} `));
    const denominator = document.createElement('span');
    I18n.text(denominator, `/ ${total}`);
    $('board-count').append(denominator);
    I18n.text($('score-count'), String(score));
    I18n.attribute($('progress'), 'aria-valuemax', String(total));
    I18n.attribute($('progress'), 'aria-valuenow', String(completed));
    $('progress-fill').style.width = `${(completed / total) * 100}%`;
  }

  function lockSettings(locked) {
    scaleSlider.disabled = locked;
    settingsForm.querySelectorAll('fieldset').forEach((fieldset) => {
      fieldset.disabled = locked;
    });
  }

  function ready(note = '') {
    history.cancel();
    cancelAnimationFrame(frame);
    phase = 'idle';
    round = null;
    completed = 0;
    score = 0;
    document.body.classList.remove('running');
    lockSettings(false);
    setTimer(30000);
    drawBoard();
    updateProgress();
    $('board-cover').hidden = false;

    const first = settings.direction === 'asc' ? 1 : settings.size ** 2;
    const last = settings.direction === 'asc' ? settings.size ** 2 : 1;
    const arrow = document.createElement('span');
    I18n.text(arrow, '→');
    I18n.replaceChildren(
      $('cover-title'),
      document.createTextNode(String(first)),
      arrow,
      document.createTextNode(String(last)),
    );

    I18n.text(
      $('board-instruction'),
      settings.direction === 'asc'
        ? 'ui.click-from-lowest-to-highest'
        : 'ui.click-from-highest-to-lowest',
    );
    I18n.text($('timer-label'), 'ui.time-remaining');
    I18n.text($('action-label'), 'ui.start');
    $('action-icon').removeAttribute('hidden');
    I18n.text($('result-note'), note);
  }

  function start() {
    if (document.hidden) return;
    completed = 0;
    score = 0;
    setTimer(30000);
    drawBoard(shuffledNumbers(settings.size));
    updateProgress();
    lockSettings(true);
    $('board-cover').hidden = true;
    I18n.text($('timer-label'), 'ui.time-remaining');
    I18n.text($('action-label'), 'ui.cancel-round');
    I18n.attribute($('action-icon'), 'hidden', '');
    I18n.text($('result-note'), '');
    document.body.classList.add('running');
    round = { ...settings, startedMono: performance.now() };
    round.meta = history.begin();
    phase = 'running';
    frame = requestAnimationFrame(tick);
  }

  function finish(reason = 'timeout') {
    if (phase !== 'running' || !history.checkTiming()) return;
    const elapsedMs = reason === 'timeout' ? 30000 : Math.min(30000, elapsed());
    phase = 'finished';
    cancelAnimationFrame(frame);
    setTimer(30000 - elapsedMs);
    document.body.classList.remove('running');
    lockSettings(false);
    board.querySelectorAll('button').forEach((cell) => {
      cell.disabled = true;
    });
    $('board-cover').hidden = false;
    I18n.text($('cover-title'), m('ui.value-pts', score));
    I18n.text($('timer-label'), 'ui.time-remaining');
    I18n.text($('action-label'), 'ui.play-again');
    $('action-icon').removeAttribute('hidden');
    const previous = Core.previousRecords(records, round.meta);
    const best = previous.reduce((value, record) => Math.max(value, record.score), -1);
    const record = {
      meta: history.finish(round.meta),
      id:
        globalThis.crypto?.randomUUID?.() ||
        `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      endedAt: new Date().toISOString(),
      size: round.size,
      direction: round.direction,
      disappear: round.disappear,
      durationMs: 30000,
      elapsedMs,
      reason,
      score,
    };
    records = mergeRecords(records, [record]);
    Core.commitRecord(record);
    const saved = persistRecords();
    I18n.text(
      $('result-note'),
      !saved
        ? 'ui.local-result-kept-on-page'
        : reason === 'error'
          ? 'rules.first-error-ended'
          : score > best && previous.length
            ? 'ui.new-best'
            : 'ui.saved',
    );
    history.updateContext();
  }

  function flash(cell, className) {
    cell.classList.remove('hit', 'wrong');
    // Restart feedback even when the same cell is clicked twice quickly.
    void cell.offsetWidth;
    cell.classList.add(className);
  }

  board.addEventListener('animationend', (event) => {
    if (event.target instanceof HTMLElement) event.target.classList.remove('hit', 'wrong');
  });

  board.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const cell =
      event.target instanceof Element ? event.target.closest('button[data-number]') : null;
    pointerAnswer =
      cell && !cell.disabled && phase === 'running'
        ? { cell, round, completed, score, pointerId: event.pointerId }
        : null;
  });
  board.addEventListener('pointercancel', (event) => {
    if (pointerAnswer?.pointerId === event.pointerId) pointerAnswer = null;
  });
  board.addEventListener('click', (event) => {
    if (phase !== 'running' || !(event.target instanceof Element) || !history.checkTiming()) return;
    const cell = event.target.closest('button[data-number]');
    if (!cell || cell.disabled) return;
    if (event.detail > 0 || event.pointerType) {
      const pending = pointerAnswer;
      pointerAnswer = null;
      if (
        !pending ||
        pending.cell !== cell ||
        pending.round !== round ||
        pending.completed !== completed ||
        pending.score !== score ||
        (event.pointerId > 0 && event.pointerId !== pending.pointerId)
      )
        return;
    }
    if (elapsed() >= 30000) {
      finish('timeout');
      return;
    }
    if (Number(cell.dataset.number) !== targetNumber()) {
      flash(cell, 'wrong');
      finish('error');
      return;
    }
    completed++;
    score++;
    flash(cell, 'hit');
    if (round.disappear) {
      cell.classList.add('removed');
      cell.disabled = true;
      cell.removeAttribute('aria-label');
      I18n.attribute(cell, 'aria-hidden', 'true');
    }
    updateProgress();
    if (completed === settings.size ** 2) {
      completed = 0;
      drawBoard(shuffledNumbers(settings.size));
      updateProgress();
    }
  });

  $('action').addEventListener('click', () => {
    if (phase === 'running') ready('ui.round-canceled-no-score-was-saved');
    else start();
  });
  settingsForm.addEventListener('submit', (event) => event.preventDefault());
  settingsForm.addEventListener('change', () => {
    if (phase === 'running') return;
    const form = new FormData(settingsForm);
    const nextSettings = {
      size: Number(form.get('size')),
      direction: form.get('direction'),
      disappear: form.get('disappear') === 'true',
    };
    if (!validSettings(nextSettings)) return;
    settings = nextSettings;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
    ready();
    history.updateContext();
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== RECORDS_KEY || !event.newValue) return;
    try {
      records = mergeRecords(records, Core.readRecords(RECORDS_KEY, validateRecords));
      history.updateContext();
    } catch {}
  });

  loadData();
  for (const [name, value] of Object.entries(settings)) {
    const input = settingsForm.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  ready();
  history.updateContext();
}
