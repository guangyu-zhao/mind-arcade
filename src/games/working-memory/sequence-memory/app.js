import { currentGame } from '../../../catalog.js';
import { Core } from '../../../core/index.js';
import { GameI18n } from '../../../i18n/runtime.js';
export function mountGame() {
  const I18n = GameI18n;
  const m = I18n.message;

  const RECORDS_KEY = Core.recordKey(currentGame().id);
  const SETTINGS_KEY = 'sequence-memory.settings.v1';
  const SCALE_KEY = 'sequence-memory.matrix-scale.v1';
  const FLASH_MS = 550;
  const GAP_MS = 220;
  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const scaleSlider = $('matrix-scale');
  const settingsForm = $('settings');

  const pendingTimers = new Set();
  let settings = { size: 3, mode: 'prefix', order: 'forward' };
  let records = [];

  let phase = 'idle';
  let session = null;
  let pointerAnswer = null;
  let sequence = [];
  let responseIndex = 0;
  let completedLength = 0;
  let generation = 0;
  let cells = [];
  let noticeTimeout;

  function validSettings(value) {
    return (
      value &&
      Number.isInteger(value.size) &&
      value.size >= 3 &&
      value.size <= 7 &&
      ['prefix', 'random'].includes(value.mode) &&
      ['forward', 'reverse'].includes(value.order)
    );
  }

  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => settings,
    display: () => $('board-frame'),

    interrupt: () => interrupt(),
  });

  function validateRecords(value) {
    if (!Array.isArray(value)) throw new Error('Invalid records');
    return value.map((record) => {
      if (
        !validSettings(record) ||
        record.meta?.rulesVersion !== currentGame().version ||
        typeof record.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) ||
        typeof record.endedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.endedAt)) ||
        !Number.isSafeInteger(record.score) ||
        record.score < 0 ||
        record.score > 100000 ||
        !Number.isFinite(record.elapsedMs) ||
        record.elapsedMs < 1 ||
        record.elapsedMs > 31536000000 ||
        !['mistake', 'stopped'].includes(record.reason)
      ) {
        throw new Error('Invalid record');
      }
      return {
        meta: Core.readMeta(record.meta),
        id: record.id,
        endedAt: new Date(record.endedAt).toISOString(),
        size: record.size,
        mode: record.mode,
        order: record.order,
        score: record.score,
        elapsedMs: Math.round(record.elapsedMs),
        reason: record.reason,
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
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (validSettings(parsed))
        settings = { size: parsed.size, mode: parsed.mode, order: parsed.order ?? 'forward' };
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
    if (!isActive()) applyMatrixScale(Number(scaleSlider.value));
  });
  scaleSlider.addEventListener('change', () => {
    if (isActive()) return;
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

  function expectedCell() {
    // Read backward without mutating the highlighted sequence or its prefix.
    const index = session.order === 'reverse' ? sequence.length - 1 - responseIndex : responseIndex;
    return sequence[index];
  }

  function isActive() {
    return ['showing', 'recalling', 'between'].includes(phase);
  }

  function schedule(callback, milliseconds) {
    const expectedGeneration = generation;
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      if (generation === expectedGeneration) callback();
    }, milliseconds);
    pendingTimers.add(timer);
  }

  function cancelScheduled() {
    generation++;
    pendingTimers.forEach(clearTimeout);
    pendingTimers.clear();
    cells.forEach((cell) => cell.classList.remove('lit', 'picked', 'wrong', 'expected'));
  }

  function setPhase(next, label) {
    phase = next;
    I18n.text($('phase-label'), label);
    $('phase-label').dataset.phase = next;
  }

  function lockSettings(locked) {
    scaleSlider.disabled = locked;
    settingsForm.querySelectorAll('fieldset').forEach((fieldset) => {
      fieldset.disabled = locked;
    });
  }

  function enableBoard(enabled) {
    cells.forEach((cell) => {
      cell.disabled = !enabled;
    });
  }

  function drawBoard() {
    board.style.setProperty('--size', String(settings.size));
    board.dataset.size = String(settings.size);
    I18n.attribute(
      board,
      'aria-label',
      m('ui.value-by-value-memory-grid', settings.size, settings.size),
    );
    const fragment = document.createDocumentFragment();
    cells = Array.from({ length: settings.size ** 2 }, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.index = String(index);
      cell.disabled = true;
      I18n.attribute(
        cell,
        'aria-label',
        m(
          'ui.row-value-column-value',
          Math.floor(index / settings.size) + 1,
          (index % settings.size) + 1,
        ),
      );
      fragment.append(cell);
      return cell;
    });
    I18n.replaceChildren(board, fragment);
  }

  function updateProgress() {
    const length = sequence.length || 1;
    I18n.text($('round-length'), String(length));
    I18n.text($('response-count'), `${responseIndex} / ${length}`);
    I18n.attribute($('progress'), 'aria-valuemax', String(length));
    I18n.attribute($('progress'), 'aria-valuenow', String(responseIndex));
    $('progress-fill').style.width = `${(responseIndex / length) * 100}%`;
    I18n.text($('score-value'), String(completedLength));
  }

  function updateRuleDescription() {
    I18n.text(
      $('rule-description'),
      settings.mode === 'prefix'
        ? 'ui.add-one-step-to-the-previous-sequence'
        : 'ui.new-sequence-each-round-one-step-longer',
    );
  }

  function ready(note = '') {
    history.cancel();
    cancelScheduled();
    session = null;
    sequence = [];
    responseIndex = 0;
    completedLength = 0;
    setPhase('idle', 'ui.ready');
    document.body.classList.remove('running');
    lockSettings(false);
    drawBoard();
    updateProgress();
    updateRuleDescription();
    $('board-cover').hidden = false;
    $('cover-icon').removeAttribute('hidden');
    I18n.text($('cover-title'), 'ui.remember-the-sequence');
    I18n.text(
      $('cover-caption'),
      settings.order === 'reverse'
        ? 'ui.after-the-flashes-start-with-the-last-square'
        : 'ui.after-the-flashes-repeat-the-sequence',
    );
    I18n.text($('board-hint'), 'ui.a-square-may-flash-more-than-once');
    I18n.text($('score-label'), 'ui.longest-sequence');
    I18n.text($('action-label'), 'ui.start');
    $('action-icon').removeAttribute('hidden');
    I18n.text($('result-note'), note);
  }

  function randomCell(previous) {
    return Core.pickDifferent(
      Array.from({ length: session.size ** 2 }, (_, i) => i),
      previous,
    );
  }

  function start() {
    if (document.hidden) return;
    cancelScheduled();
    session = { ...settings, startedMono: performance.now() };
    session.meta = history.begin();
    completedLength = 0;
    sequence = [randomCell()];
    responseIndex = 0;
    drawBoard();
    document.body.classList.add('running');
    lockSettings(true);
    $('board-cover').hidden = true;
    I18n.text($('score-label'), 'ui.longest-sequence');
    I18n.text($('action-label'), 'ui.end-save');
    I18n.attribute($('action-icon'), 'hidden', '');
    I18n.text($('result-note'), '');
    presentRound();
  }

  function presentRound() {
    setPhase('showing', 'ui.watch-the-sequence');
    responseIndex = 0;
    enableBoard(false);
    cells.forEach((cell) => cell.classList.remove('lit', 'picked'));
    I18n.text(
      $('board-hint'),
      session.order === 'reverse'
        ? 'ui.watch-then-click-in-reverse-order'
        : 'ui.watch-then-click-in-forward-order',
    );
    updateProgress();
    schedule(() => illuminate(0), 650);
  }

  function illuminate(index) {
    if (phase !== 'showing') return;
    const cell = cells[sequence[index]];
    cell.classList.add('lit');
    schedule(() => {
      cell.classList.remove('lit');
      schedule(() => {
        if (index + 1 < sequence.length) illuminate(index + 1);
        else {
          setPhase(
            'recalling',
            session.order === 'reverse' ? 'ui.reverse-recall' : 'ui.forward-recall',
          );
          I18n.text(
            $('board-hint'),
            session.order === 'reverse'
              ? 'ui.start-with-the-last-flash-and-work-backwards'
              : 'ui.click-in-the-order-you-just-saw',
          );
          enableBoard(true);
        }
      }, GAP_MS);
    }, FLASH_MS);
  }

  function completeRound() {
    completedLength = sequence.length;
    setPhase('between', 'ui.correct');
    enableBoard(false);
    updateProgress();
    I18n.text($('board-hint'), 'ui.one-more-square-next-round');
    schedule(() => {
      const nextLength = completedLength + 1;
      sequence =
        session.mode === 'prefix'
          ? [...sequence, randomCell(sequence.at(-1))]
          : Core.sampleSequence(
              Array.from({ length: settings.size ** 2 }, (_, i) => i),
              nextLength,
            );
      presentRound();
    }, 850);
  }

  function finish(reason, wrongIndex = null) {
    if (!isActive() || !history.checkTiming()) return;
    const expectedIndex = expectedCell();
    const attemptedLength = sequence.length;
    const elapsedMs = Math.max(1, Math.round(Core.elapsed(session.startedMono)));
    cancelScheduled();
    setPhase('finished', 'ui.game-over');
    enableBoard(false);
    lockSettings(false);
    document.body.classList.remove('running');
    I18n.text($('score-label'), 'ui.your-longest-sequence');
    I18n.text($('action-label'), 'ui.play-again');
    $('action-icon').removeAttribute('hidden');
    I18n.text($('board-hint'), '');
    const revealResult = () => {
      I18n.attribute($('cover-icon'), 'hidden', '');
      I18n.text($('cover-title'), m('ui.recalled-value-steps', completedLength));
      I18n.text(
        $('cover-caption'),
        reason === 'mistake' ? m('ui.reached-length-value', attemptedLength) : 'ui.game-ended',
      );
      $('board-cover').hidden = false;
    };
    if (reason === 'mistake') {
      cells[wrongIndex].classList.add('wrong');
      cells[expectedIndex].classList.add('expected');
      schedule(revealResult, 650);
    } else revealResult();

    const previous = Core.previousRecords(records, session.meta);
    const last = previous.at(-1);
    const best = previous.reduce((value, record) => Math.max(value, record.score), 0);
    const id =
      globalThis.crypto?.randomUUID?.() ||
      `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const completedRecord = {
      meta: history.finish(session.meta),
      id,
      endedAt: new Date().toISOString(),
      size: session.size,
      mode: session.mode,
      order: session.order,
      score: completedLength,
      elapsedMs,
      reason,
    };
    records = mergeRecords(records, [completedRecord]);
    Core.commitRecord(completedRecord);
    const saved = persistRecords();
    if (!saved) I18n.text($('result-note'), 'ui.local-result-kept-on-page');
    else if (!last) I18n.text($('result-note'), 'ui.saved');
    else if (completedLength > best)
      I18n.text(
        $('result-note'),
        m('ui.new-best-value-steps-more-than-last-time', completedLength - last.score),
      );
    else {
      const difference = completedLength - last.score;
      I18n.text(
        $('result-note'),
        difference === 0
          ? 'ui.same-score-as-last-attempt'
          : m(
              difference > 0
                ? 'ui.value-steps-more-than-last-time'
                : 'ui.value-steps-fewer-than-last-time',
              Math.abs(difference),
            ),
      );
    }
    history.updateContext();
  }

  board.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const cell =
      event.target instanceof Element ? event.target.closest('button[data-index]') : null;
    pointerAnswer =
      cell && !cell.disabled && phase === 'recalling'
        ? { cell, session, sequence, index: responseIndex, pointerId: event.pointerId }
        : null;
  });
  board.addEventListener('pointercancel', (event) => {
    if (pointerAnswer?.pointerId === event.pointerId) pointerAnswer = null;
  });
  board.addEventListener('click', (event) => {
    if (phase !== 'recalling' || !(event.target instanceof Element) || !history.checkTiming())
      return;
    const cell = event.target.closest('button[data-index]');
    if (!cell || cell.disabled) return;
    if (event.detail > 0 || event.pointerType) {
      const pending = pointerAnswer;
      pointerAnswer = null;
      if (
        !pending ||
        pending.cell !== cell ||
        pending.session !== session ||
        pending.sequence !== sequence ||
        pending.index !== responseIndex ||
        (event.pointerId > 0 && event.pointerId !== pending.pointerId)
      )
        return;
    }
    const index = Number(cell.dataset.index);
    if (index !== expectedCell()) {
      finish('mistake', index);
      return;
    }
    cell.classList.remove('picked');
    void cell.offsetWidth;
    cell.classList.add('picked');
    responseIndex++;
    updateProgress();
    if (responseIndex === sequence.length) completeRound();
  });
  board.addEventListener('animationend', (event) => {
    if (event.target instanceof HTMLElement) event.target.classList.remove('picked');
  });
  $('action').addEventListener('click', () => {
    if (isActive()) finish('stopped');
    else start();
  });
  settingsForm.addEventListener('submit', (event) => event.preventDefault());
  settingsForm.addEventListener('change', () => {
    if (isActive()) return;
    const form = new FormData(settingsForm);
    const next = {
      size: Number(form.get('size')),
      mode: form.get('mode'),
      order: form.get('order'),
    };
    if (!validSettings(next)) return;
    settings = next;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
    ready();
    history.updateContext();
  });

  function interrupt() {
    if (!isActive()) return;
    ready('ui.you-left-the-page-no-score-was-saved');
    I18n.text($('phase-label'), 'ui.interrupted');
    I18n.text($('cover-title'), 'ui.practice-interrupted');
    I18n.text($('cover-caption'), 'ui.press-restart-to-practice-again');
    I18n.text($('action-label'), 'ui.restart');
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

  loadData();
  for (const [name, value] of Object.entries(settings)) {
    const input = settingsForm.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  ready();
  history.updateContext();
}
