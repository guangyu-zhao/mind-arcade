import { Core } from '../../../core/index.js';
import { GameI18n } from '../../../i18n/runtime.js';
import { currentGame } from '../../../catalog.js';
export function mountGame() {
  const I18n = GameI18n;
  const m = I18n.message;

  const game = Object.freeze(currentGame().config);
  const PAGE_SIZE = 12;
  const digits = [...'123456789'];
  const letters = [...'ABCDEFGH'];
  const alphabet = [...digits, ...letters];
  const RECORDS_KEY = Core.recordKey(currentGame().id);
  const $ = (id) => document.getElementById(id);

  const tasks = new Set();
  let records = [];

  let phase = 'idle';
  let session = null;
  let currentLength = 1;
  let completedLength = 0;
  let sequence = [];
  let expected = [];
  let answers = [];
  let answerPage = 0;
  let reviewPage = 0;
  let pointerAnswer = null;
  let generation = 0;
  let noticeTimeout;

  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => ({}),
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
        !Number.isSafeInteger(record.score) ||
        record.score < 0 ||
        !Number.isFinite(record.elapsedMs) ||
        record.elapsedMs < 1 ||
        record.elapsedMs > 31536000000 ||
        !['mistake', 'stopped', 'complete'].includes(record.reason)
      )
        throw new Error('Invalid record');
      return {
        meta: Core.readMeta(record.meta),
        id: record.id,
        endedAt: new Date(record.endedAt).toISOString(),
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

  function isActive() {
    return ['showing', 'recalling', 'between'].includes(phase);
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
    I18n.text($('phase-label'), label);
    $('phase-label').dataset.phase = next;
  }
  function showPanel(name) {
    for (const id of ['idle', 'study', 'recall', 'result']) $(id + '-panel').hidden = id !== name;
  }

  function visual(id) {
    const glyph = document.createElement('span');
    glyph.className = 'character-glyph';
    I18n.text(glyph, id);
    return glyph;
  }

  function orderedTiles(parent, values, className, offset = 0) {
    I18n.replaceChildren(parent);
    values.forEach((id, index) => {
      const tile = document.createElement('div');
      tile.className = className;
      tile.append(visual(id));
      I18n.attribute(tile, 'aria-label', m('ui.item-value-value', offset + index + 1, id));
      parent.append(tile);
    });
  }

  function drawPreview() {
    const sample = ['B', '3', 'A', '1'];
    const group = $('idle-samples');
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
    strip.style.setProperty('--answer-columns', String(Math.min(6, expected.length)));
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
    currentLength = 1;
    completedLength = 0;
    sequence = [];
    expected = [];
    answers = [];
    setPhase('idle', 'ui.ready');
    showPanel('idle');
    document.body.classList.remove('running');
    I18n.text($('idle-title'), game.intro);
    I18n.text($('idle-caption'), game.caption);
    I18n.text($('board-hint'), 'ui.you-can-use-your-keyboard');
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
    document.activeElement?.blur();
    cancelTasks();
    session = { startedMono: performance.now() };
    session.meta = history.begin();
    completedLength = 0;
    currentLength = 1;
    document.body.classList.add('running');
    I18n.text($('score-label'), game.scoreLabel);
    I18n.text($('action-label'), 'ui.end-save');
    I18n.attribute($('action-icon'), 'hidden', '');
    I18n.text($('result-note'), '');
    beginRound();
  }

  function beginRound() {
    answers = [];
    answerPage = 0;
    pointerAnswer = null;
    sequence = Core.sampleSequence(alphabet, currentLength);
    if (
      currentLength > 1 &&
      (sequence.every((item) => digits.includes(item)) ||
        sequence.every((item) => letters.includes(item)))
    ) {
      const other = digits.includes(sequence[0]) ? letters : digits;
      sequence[Math.floor(Math.random() * sequence.length)] = Core.pickDifferent(other);
    }
    expected = [
      ...sequence.filter((item) => digits.includes(item)).sort((a, b) => Number(a) - Number(b)),
      ...sequence.filter((item) => letters.includes(item)).sort(),
    ];
    setPhase('showing', 'ui.remember');
    showPanel('study');
    I18n.replaceChildren($('study-content'));
    I18n.text($('board-hint'), 'ui.remember-the-numbers-and-letters');
    updateProgress();
    schedule(() => {
      showCharacter(0);
    }, 650);
  }

  function showCharacter(index) {
    if (phase !== 'showing') return;
    I18n.replaceChildren($('study-content'), visual(sequence[index]));
    I18n.text($('board-hint'), m('ui.item-value-remember', index + 1));
    schedule(() => {
      I18n.replaceChildren($('study-content'));
      schedule(() => {
        if (index + 1 < sequence.length) showCharacter(index + 1);
        else beginRecall();
      }, 200);
    }, 800);
  }

  function drawAnswers(followProgress = true) {
    if (followProgress)
      answerPage = Math.floor(Math.min(answers.length, currentLength - 1) / PAGE_SIZE);
    const start = answerPage * PAGE_SIZE;
    const count = Math.min(PAGE_SIZE, currentLength);
    const strip = $('answer-slots');
    I18n.replaceChildren(strip);
    strip.style.setProperty('--answer-columns', String(Math.min(6, currentLength)));
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
    button.className = 'character-key';
    button.dataset.item = id;
    I18n.attribute(button, 'aria-label', id);
    button.append(visual(id));
    return button;
  }

  function beginRecall() {
    if (phase !== 'showing') return;
    I18n.replaceChildren($('study-content'));
    setPhase('recalling', 'ui.enter-in-sorted-order');
    showPanel('recall');
    I18n.text($('board-hint'), 'ui.numbers-ascending-then-letters-a-z');
    drawAnswers();
    const choices = $('choices');
    I18n.replaceChildren(choices);
    for (const group of [digits, letters]) {
      const row = document.createElement('div');
      row.className = 'keyboard-row';
      group.forEach((id) => row.append(choiceButton(id)));
      choices.append(row);
    }
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
      I18n.text($('correct-answer-label'), 'ui.correct-answer-for-this-round');
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
        ? { button, session, index: answers.length, pointerId: event.pointerId }
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
  document.addEventListener('keydown', (event) => {
    if (
      phase !== 'recalling' ||
      event.repeat ||
      event.isComposing ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('input, textarea, select, [data-language-switch], #action') ||
        (target instanceof HTMLElement && target.isContentEditable))
    )
      return;
    const id = event.key.toUpperCase();
    if (!alphabet.includes(id)) return;
    event.preventDefault();
    choose(id, $('choices').querySelector(`button[data-item="${id}"]`));
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
    if (event.key !== RECORDS_KEY && !event.key?.startsWith(`${RECORDS_KEY}:`)) return;
    try {
      records = mergeRecords(records, Core.readRecords(RECORDS_KEY, validateRecords));
      history.updateContext();
    } catch {}
  });

  loadData();
  drawPreview();
  ready();
  history.updateContext();
}
