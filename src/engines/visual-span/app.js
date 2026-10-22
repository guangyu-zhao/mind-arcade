import { Core } from '../../core/index.js';
import { GameI18n } from '../../i18n/runtime.js';
import { currentGame } from '../../catalog.js';
export function mountVisualSpan({
  bank,
  startLength = 1,
  members = 2,
  outlined = false,
  random = Math.random,
}) {
  const I18n = GameI18n;
  const m = I18n.message;

  const game = Object.freeze(currentGame().config);
  const PAGE_SIZE = 12;
  const itemsById = new Map(bank.map((item) => [item.id, item]));
  const RECORDS_KEY = Core.recordKey(currentGame().id);
  const SCALE_KEY = `${game.slug}.display-scale.v1`;
  const ORDER_KEY = `${game.slug}.recall-order.v1`;
  const $ = (id) => document.getElementById(id);

  const scaleSlider = $('display-scale');
  const memoryFrame = $('memory-frame');
  const memoryStage = $('memory-stage');
  const settings = $('settings');
  const tasks = new Set();
  let recallOrder = 'forward';

  let records = [];

  let phase = 'idle';
  let session = null;
  let currentLength = startLength;
  let completedLength = 0;
  let sequence = [];
  let expected = [];
  let candidates = [];
  let answers = [];
  let answerPage = 0;
  let reviewPage = 0;
  let pointerAnswer = null;
  let generation = 0;
  let noticeTimeout;

  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => ({ order: recallOrder }),
    display: () => $('memory-stage'),

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
        !Number.isSafeInteger(record.score) ||
        record.score < 0 ||
        !Number.isFinite(record.elapsedMs) ||
        record.elapsedMs < 1 ||
        record.elapsedMs > 31536000000 ||
        !['mistake', 'stopped', 'complete'].includes(record.reason) ||
        !['forward', 'reverse'].includes(record.order)
      )
        throw new Error('Invalid record');
      return {
        meta: Core.readMeta(record.meta),
        id: record.id,
        endedAt: new Date(record.endedAt).toISOString(),
        score: record.score,
        elapsedMs: Math.round(record.elapsedMs),
        reason: record.reason,
        order: record.order,
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
      const savedOrder = localStorage.getItem(ORDER_KEY);
      if (['forward', 'reverse'].includes(savedOrder)) recallOrder = savedOrder;
    } catch {}
    try {
      records = mergeRecords(Core.readRecords(RECORDS_KEY, validateRecords));
    } catch {
      storageFailed();
    }
    let scale = 100;
    try {
      const raw = localStorage.getItem(SCALE_KEY);
      if (raw !== null && raw.trim() !== '') scale = Number(raw);
    } catch {}
    applyScale(scale);
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

  function syncMemoryFrame() {
    const height = `${memoryStage.getBoundingClientRect().height}px`;
    if (memoryFrame.style.height !== height) memoryFrame.style.height = height;
  }

  function applyScale(value) {
    const clamped = Number.isFinite(value) ? Math.max(40, Math.min(100, value)) : 100;
    const scale = Math.round(clamped / 5) * 5;
    scaleSlider.value = String(scale);
    I18n.attribute(scaleSlider, 'aria-valuetext', `${scale}%`);
    $('display-scale-value').value = `${scale}%`;
    memoryFrame.style.setProperty('--display-scale', String(scale / 100));
    syncMemoryFrame();
  }
  scaleSlider.addEventListener('input', () => {
    if (!isActive()) applyScale(Number(scaleSlider.value));
  });
  scaleSlider.addEventListener('change', () => {
    if (isActive()) return;
    try {
      localStorage.setItem(SCALE_KEY, scaleSlider.value);
    } catch {}
  });

  function isActive() {
    return ['showing', 'recalling', 'between'].includes(phase);
  }
  function orderLabel(order = recallOrder) {
    return order === 'reverse' ? 'ui.reverse' : 'ui.forward';
  }

  function schedule(callback, milliseconds) {
    const token = generation;
    const timer = setTimeout(() => {
      tasks.delete(timer);
      if (generation === token) callback();
    }, milliseconds);
    tasks.add(timer);
  }
  function cancelTasks() {
    generation++;
    pointerAnswer = null;
    tasks.forEach(clearTimeout);
    tasks.clear();
  }
  function setPhase(next, label) {
    phase = next;
    scaleSlider.disabled = isActive();
    settings.querySelectorAll('fieldset').forEach((fieldset) => {
      fieldset.disabled = isActive();
    });
    I18n.text($('phase-label'), label);
    $('phase-label').dataset.phase = next;
  }
  function showPanel(name) {
    for (const id of ['idle', 'study', 'recall', 'result']) $(id + '-panel').hidden = id !== name;
  }

  function visual(id) {
    const asset = itemsById.get(id);
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    I18n.attribute(drawing, 'viewBox', '0 0 96 96');
    I18n.attribute(drawing, 'aria-hidden', 'true');
    I18n.attribute(drawing, 'focusable', 'false');
    drawing.classList.add('illustration');
    if (outlined)
      for (const [name, value] of Object.entries({
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '3.8',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }))
        drawing.setAttribute(name, value);
    // Drawings come from local artwork or the local generator, never record imports.
    drawing.innerHTML = asset.drawing;
    return drawing;
  }

  function orderedTiles(parent, values, className, offset = 0) {
    I18n.replaceChildren(parent);
    values.forEach((id, index) => {
      const tile = document.createElement('div');
      tile.className = className;
      if (className === 'study-card') {
        const marker = document.createElement('small');
        marker.className = 'item-number';
        I18n.text(marker, String(offset + index + 1));
        tile.append(marker);
      }
      tile.append(visual(id));
      I18n.attribute(
        tile,
        'aria-label',
        m('ui.item-value-value', offset + index + 1, itemsById.get(id).label),
      );
      parent.append(tile);
    });
  }

  function drawPreview() {
    const sample = bank.slice(0, 3).map((item) => item.id);
    const group = $('idle-samples');
    I18n.replaceChildren(group);
    for (const id of sample) {
      const tile = document.createElement('div');
      tile.className = 'preview-tile';
      tile.append(visual(id));
      group.append(tile);
    }
  }

  function updatePagination(id, page, length) {
    const pager = $(id);
    const pages = Math.max(1, Math.ceil(length / PAGE_SIZE));
    pager.hidden = pages === 1;
    pager.querySelector('[data-page-step="-1"]').disabled = page === 0;
    pager.querySelector('[data-page-step="1"]').disabled = page >= pages - 1;
    const label = pager.querySelector('[data-page-label]');
    I18n.text(label, `${page + 1} / ${pages}`);
    I18n.attribute(label, 'aria-label', m('ui.page-value-of-value', page + 1, pages));
  }

  function drawReview() {
    const start = reviewPage * PAGE_SIZE;
    const values = expected.slice(start, start + PAGE_SIZE);
    const strip = $('correct-answer');
    orderedTiles(strip, values, 'review-card', start);
    strip.style.setProperty('--answer-columns', String(Math.min(4, expected.length)));
    if (expected.length > PAGE_SIZE) {
      while (strip.children.length < PAGE_SIZE) {
        const placeholder = document.createElement('div');
        placeholder.className = 'review-card page-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        strip.append(placeholder);
      }
    }
    updatePagination('review-pagination', reviewPage, expected.length);
  }

  $('answer-pagination').addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-page-step]') : null;
    if (!button || button.disabled) return;
    answerPage = Math.max(
      0,
      Math.min(
        Math.ceil(currentLength / PAGE_SIZE) - 1,
        answerPage + Number(button.dataset.pageStep),
      ),
    );
    drawAnswers(false);
  });
  $('review-pagination').addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('[data-page-step]') : null;
    if (!button || button.disabled) return;
    reviewPage = Math.max(
      0,
      Math.min(
        Math.ceil(expected.length / PAGE_SIZE) - 1,
        reviewPage + Number(button.dataset.pageStep),
      ),
    );
    drawReview();
  });

  function updateProgress() {
    I18n.text($('round-length'), String(currentLength));
    I18n.text($('response-count'), `${answers.length} / ${currentLength}`);
    I18n.attribute($('progress'), 'aria-valuemax', String(currentLength));
    I18n.attribute($('progress'), 'aria-valuenow', String(answers.length));
    $('progress-fill').style.width = `${(answers.length / currentLength) * 100}%`;
    I18n.text($('score-value'), String(completedLength));
  }

  function ready(note = '') {
    history.cancel();
    cancelTasks();
    session = null;
    currentLength = startLength;
    completedLength = 0;
    sequence = [];
    expected = [];
    candidates = [];
    answers = [];
    setPhase('idle', 'ui.ready');
    showPanel('idle');
    document.body.classList.remove('running');
    settings.querySelectorAll('input[name="order"]').forEach((input) => {
      input.checked = input.value === recallOrder;
    });
    drawPreview();

    I18n.text($('idle-title'), game.intro);
    I18n.text(
      $('idle-caption'),
      m('ui.read-left-to-right-then-recall-in-value-order', orderLabel()),
    );
    I18n.text($('board-hint'), '');
    I18n.text($('score-label'), game.scoreLabel);
    I18n.text($('action-label'), 'ui.start');
    $('action-icon').removeAttribute('hidden');
    I18n.text($('result-note'), note);
    I18n.replaceChildren($('study-content'));
    I18n.replaceChildren($('choices'));
    I18n.replaceChildren($('answer-slots'));
    I18n.replaceChildren($('correct-answer'));
    answerPage = 0;
    reviewPage = 0;
    updatePagination('answer-pagination', 0, 0);
    updatePagination('review-pagination', 0, 0);
    updateProgress();
  }

  function start() {
    if (document.hidden) return;
    cancelTasks();
    session = {
      startedMono: performance.now(),
      order: recallOrder,
    };
    session.meta = history.begin();

    history.updateContext();
    completedLength = 0;
    currentLength = startLength;
    document.body.classList.add('running');
    I18n.text($('score-label'), game.scoreLabel);
    I18n.text($('action-label'), 'ui.end-save');
    I18n.attribute($('action-icon'), 'hidden', '');
    I18n.text($('result-note'), '');
    beginRound();
  }

  function prepareVisualRound() {
    ({ candidates, sequence } = Core.visualRound(bank, currentLength, 12, members, random));
    expected = session.order === 'reverse' ? [...sequence].reverse() : [...sequence];
  }

  function beginRound() {
    answers = [];
    answerPage = 0;
    pointerAnswer = null;
    prepareVisualRound();
    setPhase('showing', 'ui.remember');
    showPanel('study');
    I18n.replaceChildren($('study-content'));
    I18n.text(
      $('board-hint'),
      m('ui.read-left-to-right-row-by-row-value-recall', orderLabel(session.order)),
    );
    updateProgress();
    $('study-content').classList.add('paged');
    schedule(() => showStudyPage(0), 650);
  }

  function showStudyPage(offset) {
    if (phase !== 'showing') return;
    const values = sequence.slice(offset, offset + PAGE_SIZE);
    const paged = sequence.length > PAGE_SIZE;
    const length = values.length;
    const columns = 4;
    $('study-content').style.setProperty('--columns', String(columns));
    orderedTiles($('study-content'), values, 'study-card', offset);
    if (paged)
      I18n.text(
        $('board-hint'),
        m(
          'ui.screen-value-value-value-recall',
          offset / PAGE_SIZE + 1,
          Math.ceil(sequence.length / PAGE_SIZE),
          orderLabel(session.order),
        ),
      );
    schedule(
      () => {
        I18n.replaceChildren($('study-content'));
        if (offset + length < sequence.length) schedule(() => showStudyPage(offset + length), 300);
        else beginRecall();
      },
      Math.max(2000, length * 1000),
    );
  }

  function drawAnswers(followProgress = true) {
    if (followProgress)
      answerPage = Math.floor(Math.min(answers.length, currentLength - 1) / PAGE_SIZE);
    const start = answerPage * PAGE_SIZE;
    const count = Math.min(PAGE_SIZE, currentLength);
    const strip = $('answer-slots');
    I18n.replaceChildren(strip);
    strip.style.setProperty('--answer-columns', String(Math.min(4, currentLength)));
    strip.parentElement.classList.toggle('paged', currentLength > PAGE_SIZE);
    updatePagination('answer-pagination', answerPage, currentLength);
    for (let index = start; index < start + count; index++) {
      const slot = document.createElement('div');
      slot.className = 'answer-slot';
      if (index >= currentLength) {
        slot.classList.add('page-placeholder');
        slot.setAttribute('aria-hidden', 'true');
      } else if (index < answers.length) {
        slot.classList.add('answered');
        slot.append(visual(answers[index]));
        I18n.attribute(slot, 'aria-label', m('ui.item-value-answered', index + 1));
      } else {
        I18n.attribute(slot, 'aria-label', m('ui.item-value-awaiting-answer', index + 1));
        const empty = document.createElement('span');
        empty.className = 'empty-slot';
        I18n.text(empty, '·');
        slot.append(empty);
      }
      strip.append(slot);
    }
  }

  function choiceButton(id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-card';
    button.dataset.item = id;
    I18n.attribute(button, 'aria-label', itemsById.get(id).label);
    button.append(visual(id));
    return button;
  }

  function beginRecall() {
    if (phase !== 'showing') return;
    I18n.replaceChildren($('study-content'));
    setPhase('recalling', m('ui.value-recall', orderLabel(session.order)));
    showPanel('recall');
    I18n.text(
      $('board-hint'),
      session.order === 'reverse'
        ? 'ui.reverse-the-entire-sequence-choices-may-repeat'
        : 'ui.select-forwards-choices-may-repeat',
    );
    drawAnswers();
    const choices = $('choices');
    I18n.replaceChildren(choices);
    candidates.forEach((id) => choices.append(choiceButton(id)));
  }

  function choose(id, button) {
    if (phase !== 'recalling' || button?.disabled || !history.checkTiming()) return;
    if (id !== expected[answers.length]) {
      if (button) button.classList.add('wrong-choice');
      finish('mistake');
      return;
    }
    answers.push(id);
    if (button) {
      button.classList.remove('picked');
      void button.offsetWidth;
      button.classList.add('picked');
    }
    drawAnswers();
    updateProgress();
    if (answers.length === expected.length) {
      completedLength = currentLength;
      updateProgress();
      setPhase('between', 'ui.correct');
      $('choices')
        .querySelectorAll('button')
        .forEach((item) => {
          item.disabled = true;
        });
      I18n.text($('board-hint'), 'ui.one-more-item-next-round');
      schedule(() => {
        currentLength++;
        beginRound();
      }, 1000);
    }
  }

  function finish(reason) {
    if (!isActive() || !history.checkTiming()) return;
    const elapsedMs = Math.max(1, Math.round(Core.elapsed(session.startedMono)));
    cancelTasks();
    setPhase('finished', 'ui.game-over');
    $('choices')
      .querySelectorAll('button')
      .forEach((button) => {
        button.disabled = true;
      });
    document.body.classList.remove('running');
    I18n.text($('action-label'), 'ui.play-again');
    $('action-icon').removeAttribute('hidden');
    I18n.text($('board-hint'), '');
    const revealResult = () => {
      I18n.text($('finish-title'), m('ui.value-value-items', game.resultVerb, completedLength));
      I18n.text(
        $('finish-caption'),
        reason === 'mistake' ? m('ui.reached-length-value', currentLength) : 'ui.game-ended',
      );
      I18n.text(
        $('correct-answer-label'),
        m('ui.correct-answer-value-2', orderLabel(session.order)),
      );
      reviewPage = Math.floor(Math.min(answers.length, expected.length - 1) / PAGE_SIZE);
      drawReview();
      showPanel('result');
      I18n.replaceChildren($('study-content'));
    };
    if (reason === 'mistake') schedule(revealResult, 450);
    else revealResult();

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
      score: completedLength,
      elapsedMs,
      reason,
      order: session.order,
    };
    records = mergeRecords(records, [completedRecord]);
    Core.commitRecord(completedRecord);

    const saved = persistRecords();
    if (!saved) I18n.text($('result-note'), 'ui.local-result-kept-on-page');
    else if (!last) I18n.text($('result-note'), 'ui.saved');
    else if (completedLength > best)
      I18n.text(
        $('result-note'),
        m('ui.new-best-value-items-more-than-last-time', completedLength - last.score),
      );
    else {
      const difference = completedLength - last.score;
      I18n.text(
        $('result-note'),
        difference === 0
          ? 'ui.same-score-as-last-attempt'
          : m(
              difference > 0
                ? 'ui.value-items-more-than-last-time'
                : 'ui.value-items-fewer-than-last-time',
              Math.abs(difference),
            ),
      );
    }
    history.updateContext();
  }

  $('choices').addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const button =
      event.target instanceof Element ? event.target.closest('button[data-item]') : null;
    pointerAnswer =
      button && !button.disabled && phase === 'recalling'
        ? { button, session, sequence, index: answers.length, pointerId: event.pointerId }
        : null;
  });
  $('choices').addEventListener('pointercancel', (event) => {
    if (pointerAnswer?.pointerId === event.pointerId) pointerAnswer = null;
  });
  $('choices').addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest('button[data-item]') : null;
    if (!button || button.disabled) return;
    if (event.detail > 0 || event.pointerType) {
      const pending = pointerAnswer;
      pointerAnswer = null;
      if (
        !pending ||
        pending.button !== button ||
        pending.session !== session ||
        pending.sequence !== sequence ||
        pending.index !== answers.length ||
        (event.pointerId > 0 && event.pointerId !== pending.pointerId)
      )
        return;
    }
    choose(button.dataset.item, button);
  });
  $('choices').addEventListener('animationend', (event) => {
    if (event.target instanceof HTMLElement) event.target.classList.remove('picked');
  });
  $('action').addEventListener('click', () => {
    if (isActive()) finish('stopped');
    else start();
  });
  settings.addEventListener('submit', (event) => event.preventDefault());
  settings.addEventListener('change', (event) => {
    const input = event.target;
    if (isActive() || !(input instanceof HTMLInputElement)) return;
    if (input.name === 'order' && ['forward', 'reverse'].includes(input.value)) {
      recallOrder = input.value;

      try {
        localStorage.setItem(ORDER_KEY, recallOrder);
      } catch {}
    } else return;
    ready();
    history.updateContext();
  });
  function interrupt() {
    if (!isActive()) return;
    ready('ui.you-left-the-page-no-score-was-saved');
    I18n.text($('phase-label'), 'ui.interrupted');
    I18n.text($('idle-title'), 'ui.practice-interrupted');
    I18n.text($('idle-caption'), 'ui.press-restart-to-practice-again');
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
  window.addEventListener('languagechange', syncMemoryFrame);
  window.addEventListener('resize', syncMemoryFrame);

  if (typeof ResizeObserver === 'function')
    new ResizeObserver(syncMemoryFrame).observe(memoryStage);
  else
    new MutationObserver(syncMemoryFrame).observe(memoryStage, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

  loadData();
  ready();
  syncMemoryFrame();
  history.updateContext();
}
