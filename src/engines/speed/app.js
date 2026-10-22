import { Core } from '../../core/index.js';
import { GameI18n } from '../../i18n/runtime.js';
import { SpeedSymbols } from './symbols.js';
import { currentGame } from '../../catalog.js';
export function mountGame() {
  const game = Object.freeze(currentGame().config);
  const I18n = GameI18n;
  const m = I18n.message;
  const $ = (id) => document.getElementById(id);
  const isCancellation = game.kind === 'cancellation';
  const RECORDS_KEY = Core.recordKey(currentGame().id);

  const byId = new Map(
    [...SpeedSymbols.search, ...SpeedSymbols.coding].map((item) => [item.id, item]),
  );
  const searchIds = SpeedSymbols.search.map((item) => item.id);
  const codingIds = SpeedSymbols.coding.map((item) => item.id);
  const duration = 30;
  let phase = 'idle';
  let session = null;
  let trial = null;
  let pointerAnswer = null;
  let locked = false;
  let frame = 0;
  let generation = 0;
  let noticeTimeout;
  let lastClock = '';
  let records = [];

  const timers = new Set();

  const shuffle = Core.shuffle;
  function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
  }
  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => ({ duration, kind: game.kind }),
    display: () => document.querySelector('.board-panel'),

    interrupt: () => interrupt(),
  });

  function validateRecords(value) {
    if (!Array.isArray(value)) throw new Error('Invalid records');
    return value.map((record) => {
      if (
        !record ||
        record.meta?.rulesVersion !== currentGame().version ||
        typeof record.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) ||
        typeof record.endedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.endedAt)) ||
        record.duration !== 30 ||
        !['error', 'missed', 'timeout'].includes(record.reason) ||
        !Number.isFinite(record.elapsedMs) ||
        record.elapsedMs < 0 ||
        record.elapsedMs > 30000 ||
        (record.reason === 'timeout' && record.elapsedMs !== 30000) ||
        record.score !== record.correct ||
        ![record.correct, record.wrong, record.missed, record.pages].every(
          (n) => Number.isSafeInteger(n) && n >= 0 && n <= 20000,
        ) ||
        (!isCancellation && (record.missed !== 0 || record.pages !== 0))
      )
        throw new Error('Invalid record');
      return {
        meta: Core.readMeta(record.meta),
        id: record.id,
        endedAt: new Date(record.endedAt).toISOString(),
        duration: record.duration,
        elapsedMs: record.elapsedMs,
        reason: record.reason,
        score: record.correct,
        correct: record.correct,
        wrong: record.wrong,
        missed: record.missed,
        pages: record.pages,
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
      records = mergeRecords(Core.readRecords(RECORDS_KEY, validateRecords));
    } catch {
      storageFailed();
    }
  }
  function persistRecords() {
    try {
      records = Core.saveRecords(RECORDS_KEY, records, validateRecords);

      return true;
    } catch {
      storageFailed();
      return false;
    }
  }

  function schedule(callback, delay) {
    const token = generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (token === generation) callback();
    }, delay);
    timers.add(timer);
  }
  function cancelScheduled() {
    generation++;
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    timers.clear();
  }
  function setPhase(next, label) {
    phase = next;
    I18n.text($('phase-label'), label);
    $('phase-label').dataset.phase = next;
    const active = next === 'running' || next === 'countdown';
    document.body.classList.toggle('running', active);
  }
  function showPanel(name) {
    for (const id of ['idle', 'countdown', 'play', 'result']) $(id + '-panel').hidden = id !== name;
  }
  function chooseTargets() {
    const first = pick(searchIds);
    const second = pick(searchIds.filter((id) => id !== first));
    return [first, second];
  }

  function symbolDrawing(id) {
    const asset = byId.get(id);
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 96 96');
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '3');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    node.classList.add('symbol');
    node.innerHTML = asset.drawing; // Locally generated SVG; never imported content.
    return node;
  }
  function symbolLabel(id) {
    return m('ui.symbol-value', Number(id.slice(1)) + 1);
  }
  function drawSymbols(parent, ids) {
    I18n.replaceChildren(parent);
    parent.style.setProperty('--count', String(ids.length));
    ids.forEach((id) => {
      const tile = document.createElement('div');
      tile.className = 'symbol-tile';
      tile.setAttribute('role', 'img');
      I18n.attribute(tile, 'aria-label', symbolLabel(id));
      tile.append(symbolDrawing(id));
      parent.append(tile);
    });
  }
  function updateClock(remaining) {
    const whole = Math.ceil(Math.max(0, remaining) / 1000);
    const value = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    if (value !== lastClock) {
      lastClock = value;
      I18n.text($('timer-main'), value);
      I18n.attribute($('timer-main'), 'aria-label', m('ui.value-seconds-remaining', whole));
      const limit = session?.duration ?? duration;
      const elapsedSeconds = Math.max(0, limit - whole);
      $('progress').setAttribute('aria-valuemax', String(limit));
      $('progress').setAttribute('aria-valuenow', String(elapsedSeconds));
      $('progress-fill').style.width = `${(elapsedSeconds / limit) * 100}%`;
    }
  }
  function elapsed() {
    return Core.elapsed(session.startedMono);
  }
  function tick() {
    if (phase !== 'running') return;
    const remaining = session.duration * 1000 - elapsed();
    updateClock(remaining);
    if (remaining <= 0) {
      finish();
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function acceptsInput() {
    if (phase !== 'running' || !history.checkTiming()) return false;
    if (elapsed() >= session.duration * 1000) {
      finish();
      return false;
    }
    return !locked;
  }
  function disableResponses(disabled) {
    $('play-panel')
      .querySelectorAll('button')
      .forEach((button) => {
        button.disabled = disabled;
      });
  }
  function updateCounter() {
    I18n.text(
      $('attempt-count'),
      isCancellation
        ? m('ui.page-value-marked-value', session.pages + 1, trial?.selected.size || 0)
        : m('ui.answered-value', session.correct + session.wrong),
    );
  }
  function ready(note = '') {
    history.cancel();
    cancelScheduled();
    session = null;
    trial = null;
    locked = false;
    setPhase('idle', 'ui.ready');
    showPanel('idle');

    I18n.text($('idle-caption'), game.rule);
    I18n.text($('action-label'), 'ui.start');
    I18n.text($('board-hint'), ['coding', 'cancellation'].includes(game.kind) ? game.hint : '');
    I18n.text($('attempt-count'), '');
    I18n.text($('result-note'), note);
    $('action-icon').removeAttribute('hidden');
    disableResponses(true);
    lastClock = '';
    updateClock(duration * 1000);
  }
  function start() {
    if (document.hidden) return;
    cancelScheduled();
    session = { duration, correct: 0, wrong: 0, missed: 0, pages: 0 };
    trial = null;
    locked = false;
    setPhase('countdown', 'ui.ready');
    showPanel('countdown');
    I18n.text($('action-label'), 'ui.cancel-round');
    I18n.text($('result-note'), '');
    I18n.text($('attempt-count'), '');
    I18n.text($('board-hint'), ['coding', 'cancellation'].includes(game.kind) ? game.hint : '');
    $('action-icon').setAttribute('hidden', '');
    lastClock = '';
    updateClock(duration * 1000);
    function countDown(value) {
      I18n.text($('countdown-value'), String(value));
      schedule(() => {
        if (value > 1) countDown(value - 1);
        else begin();
      }, 1000);
    }
    countDown(3);
  }
  function begin() {
    if (phase !== 'countdown' || document.hidden) {
      ready('ui.you-left-the-page-no-score-was-saved');
      return;
    }
    if (game.kind === 'coding') {
      session.key = shuffle(codingIds);
      drawCodingKey();
    }
    if (isCancellation) session.targets = chooseTargets();
    setPhase('running', 'ui.in-progress');
    showPanel('play');
    I18n.text($('action-label'), 'ui.cancel-round');
    nextTrial();
    session.meta = history.begin();
    session.startedMono = performance.now();
    $('play-panel').focus({ preventScroll: true });
    tick();
  }
  function nextTrial() {
    if (phase !== 'running') return;
    locked = false;
    $('play-panel')
      .querySelectorAll('.answer-correct')
      .forEach((button) => button.classList.remove('answer-correct'));
    if (game.kind === 'search') {
      const targets = chooseTargets();
      const options = shuffle(searchIds.filter((id) => !targets.includes(id))).slice(0, 5);
      const answer = Math.random() < 0.5;
      if (answer) options[Math.floor(Math.random() * options.length)] = pick(targets);
      trial = { answer };
      drawSymbols($('target-row'), targets);
      drawSymbols($('search-row'), options);
    } else if (game.kind === 'comparison') {
      const first = shuffle(searchIds).slice(0, 3);
      const second = [...first];
      const answer = Math.random() < 0.5;
      if (!answer) {
        const index = Math.floor(Math.random() * first.length);
        second[index] = pick(searchIds.filter((id) => !first.includes(id)));
      }
      trial = { answer };
      drawSymbols($('first-row'), first);
      drawSymbols($('second-row'), second);
    } else if (game.kind === 'coding') {
      const digit = 1 + Math.floor(Math.random() * 9);
      trial = { answer: session.key[digit - 1] };
      I18n.text($('prompt-digit'), String(digit));
    } else {
      const distractors = searchIds.filter((id) => !session.targets.includes(id));
      const page = [
        ...Array(5).fill(session.targets[0]),
        ...Array(5).fill(session.targets[1]),
        ...Array.from({ length: 26 }, () => pick(distractors)),
      ];
      trial = { page: shuffle(page), selected: new Set() };
      drawSymbols($('cancel-targets'), session.targets);
      I18n.replaceChildren($('cancel-grid'));
      trial.page.forEach((id, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cancel-cell';
        button.dataset.cell = String(index);
        I18n.attribute(
          button,
          'aria-label',
          m(
            'ui.row-value-column-value-value',
            Math.floor(index / 6) + 1,
            (index % 6) + 1,
            symbolLabel(id),
          ),
        );
        button.setAttribute('aria-pressed', 'false');
        button.append(symbolDrawing(id));
        $('cancel-grid').append(button);
      });
    }
    disableResponses(false);
    updateCounter();
  }
  function drawCodingKey() {
    I18n.replaceChildren($('coding-key'));
    session.key.forEach((id, index) => {
      const pair = document.createElement('div');
      pair.className = 'key-pair';
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      pair.setAttribute('role', 'img');
      I18n.attribute(
        pair,
        'aria-label',
        m('ui.number-value-maps-to-value', index + 1, symbolLabel(id)),
      );
      pair.append(number, symbolDrawing(id));
      $('coding-key').append(pair);
    });
    I18n.replaceChildren($('coding-options'));
    codingIds.forEach((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'coding-option';
      button.dataset.symbol = id;
      I18n.attribute(button, 'aria-label', m('ui.option-value-value', index + 1, symbolLabel(id)));
      const shortcut = document.createElement('kbd');
      shortcut.textContent = String(index + 1);
      button.append(symbolDrawing(id), shortcut);
      $('coding-options').append(button);
    });
  }
  function answer(value, button) {
    if (!acceptsInput()) return;
    locked = true;
    const correct = value === trial.answer;
    session[correct ? 'correct' : 'wrong']++;
    if (!correct) {
      finish('error');
      return;
    }
    button?.classList.add('answer-correct');
    disableResponses(true);
    updateCounter();
    schedule(() => {
      if (phase !== 'running') return;
      if (elapsed() >= session.duration * 1000) finish();
      else nextTrial();
    }, 160);
  }
  function toggleCell(index, button) {
    if (!acceptsInput() || !Number.isInteger(index) || index < 0 || index >= trial.page.length)
      return;
    if (!session.targets.includes(trial.page[index])) {
      session.wrong++;
      finish('error');
      return;
    }
    if (trial.selected.has(index)) trial.selected.delete(index);
    else trial.selected.add(index);
    button.classList.toggle('marked', trial.selected.has(index));
    button.setAttribute('aria-pressed', String(trial.selected.has(index)));
    updateCounter();
  }
  function commitPage(submitted) {
    let hits = 0;
    trial.selected.forEach((index) => {
      if (session.targets.includes(trial.page[index])) {
        hits++;
        session.correct++;
      } else session.wrong++;
    });
    if (submitted) {
      session.missed += trial.page.filter((id) => session.targets.includes(id)).length - hits;
      session.pages++;
    }
    trial.selected.clear();
  }
  function submitPage() {
    if (!acceptsInput()) return;
    locked = true;
    commitPage(true);
    if (session.missed) {
      finish('missed');
      return;
    }
    disableResponses(true);
    schedule(() => {
      if (elapsed() >= session.duration * 1000) finish();
      else nextTrial();
    }, 160);
  }
  function finish(reason = 'timeout') {
    if (phase !== 'running' || !history.checkTiming()) return;
    const elapsedMs = reason === 'timeout' ? 30000 : Math.min(30000, elapsed());
    if (isCancellation) commitPage(false);
    cancelScheduled();
    locked = true;
    disableResponses(true);
    setPhase('finished', 'ui.game-over');
    showPanel('result');
    updateClock(30000 - elapsedMs);
    I18n.text($('action-label'), 'ui.play-again');
    $('action-icon').removeAttribute('hidden');
    I18n.text(
      $('finish-title'),
      reason === 'timeout'
        ? 'ui.time-is-up'
        : reason === 'missed'
          ? 'rules.missed-ended'
          : 'rules.first-error-ended',
    );
    I18n.text($('final-score'), String(session.correct));
    I18n.text($('board-hint'), '');
    I18n.text($('attempt-count'), '');
    const previous = Core.previousRecords(records, session.meta);
    const last = previous.at(-1);
    const best = previous.reduce((value, record) => Math.max(value, record.score), -Infinity);
    const record = {
      meta: history.finish(session.meta),
      id:
        globalThis.crypto?.randomUUID?.() ||
        `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      endedAt: new Date().toISOString(),
      duration: session.duration,
      elapsedMs,
      reason,
      score: session.correct,
      correct: session.correct,
      wrong: session.wrong,
      missed: session.missed,
      pages: session.pages,
    };
    records = mergeRecords(records, [record]);
    Core.commitRecord(record);
    const saved = persistRecords();
    if (!saved) I18n.text($('result-note'), 'ui.local-result-kept-on-page');
    else if (!last) I18n.text($('result-note'), 'ui.saved');
    else if (record.score > best) I18n.text($('result-note'), 'ui.new-best');
    else {
      const difference = record.score - last.score;
      I18n.text(
        $('result-note'),
        difference === 0
          ? 'ui.same-score-as-last-attempt'
          : m(
              difference > 0
                ? 'ui.value-points-higher-than-last-time'
                : 'ui.value-points-lower-than-last-time',
              Math.abs(difference),
            ),
      );
    }
    history.updateContext();
  }

  $('play-panel').addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    pointerAnswer =
      button && !button.disabled && phase === 'running' && !locked
        ? { button, trial, pointerId: event.pointerId }
        : null;
  });
  $('play-panel').addEventListener('pointercancel', (event) => {
    if (pointerAnswer?.pointerId === event.pointerId) pointerAnswer = null;
  });
  $('play-panel').addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    if (event.detail > 0 || event.pointerType) {
      const pending = pointerAnswer;
      pointerAnswer = null;
      if (
        !pending ||
        pending.button !== button ||
        pending.trial !== trial ||
        (event.pointerId > 0 && event.pointerId !== pending.pointerId)
      )
        return;
    }
    if (button.dataset.answer !== undefined) answer(button.dataset.answer === 'true', button);
    else if (button.dataset.symbol) answer(button.dataset.symbol, button);
    else if (button.dataset.cell !== undefined) toggleCell(Number(button.dataset.cell), button);
    else if (button.id === 'next-page') submitPage();
  });
  $('action').addEventListener('click', () => {
    if (phase === 'running' && elapsed() >= session.duration * 1000) finish();
    else if (['running', 'countdown'].includes(phase))
      ready('ui.round-canceled-no-score-was-saved');
    else start();
  });
  document.addEventListener('keydown', (event) => {
    if (
      phase !== 'running' ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('input, textarea, select, summary, a, [data-language-switch], #action') ||
        (target instanceof HTMLElement && target.isContentEditable))
    )
      return;
    if (isCancellation && event.code === 'Space') {
      if (target instanceof Element && target.closest('#cancel-grid button')) return;
      event.preventDefault();
      submitPage();
    } else if (game.kind === 'coding' && /^[1-9]$/.test(event.key)) {
      event.preventDefault();
      const id = codingIds[Number(event.key) - 1];
      answer(id, $('coding-options').querySelector(`[data-symbol="${id}"]`));
    } else if (
      ['search', 'comparison'].includes(game.kind) &&
      ['ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
      event.preventDefault();
      const value = event.key === 'ArrowRight';
      answer(value, $(game.kind + '-task').querySelector(`[data-answer="${value}"]`));
    } else if (
      isCancellation &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      const button = target instanceof Element ? target.closest('[data-cell]') : null;
      if (!button) return;
      event.preventDefault();
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 }[event.key];
      const index = Math.max(0, Math.min(35, Number(button.dataset.cell) + offset));
      $('cancel-grid').querySelector(`[data-cell="${index}"]`)?.focus({ preventScroll: true });
    }
  });
  function interrupt() {
    if (['running', 'countdown'].includes(phase)) ready('ui.you-left-the-page-no-score-was-saved');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) interrupt();
  });
  window.addEventListener('pagehide', interrupt);

  window.addEventListener('storage', (event) => {
    if (event.key !== RECORDS_KEY || !event.newValue) return;
    try {
      records = mergeRecords(records, Core.readRecords(RECORDS_KEY, validateRecords));
      history.updateContext();
    } catch {}
  });

  $(game.kind + '-task').hidden = false;

  drawSymbols(
    $('idle-samples'),
    (game.kind === 'coding' ? codingIds : searchIds)
      .filter((_, index) => index % 3 === 0)
      .slice(0, 3),
  );
  loadData();
  ready();
  history.updateContext();
}
