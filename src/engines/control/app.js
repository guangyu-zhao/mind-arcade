import { Core } from '../../core/index.js';
import { Text } from '../../i18n/runtime.js';
import { GameI18n } from '../../i18n/runtime.js';
import { currentGame } from '../../catalog.js';
export function mountGame() {
  const game = Object.freeze(currentGame().config);
  const I18n = GameI18n;
  const m = I18n.message;
  const $ = (id) => document.getElementById(id);
  const settingsForm = $('settings');
  const DURATION = 30000;
  const RULES = '30s-first-error-v1';
  const RECORDS_KEY = Core.recordKey(currentGame().id);
  const SETTINGS_KEY = `${game.slug}.settings.v1`;
  const isStroop = game.kind === 'stroop';
  const L = Text;

  const colors = [
    { zh: '红', en: 'Red', de: 'Rot', fr: 'Rouge', ja: 'あか', ko: '빨강', ink: '#c52f42' },
    { zh: '蓝', en: 'Blue', de: 'Blau', fr: 'Bleu', ja: 'あお', ko: '파랑', ink: '#2866be' },
    { zh: '绿', en: 'Green', de: 'Grün', fr: 'Vert', ja: 'みどり', ko: '초록', ink: '#248044' },
    { zh: '黄', en: 'Yellow', de: 'Gelb', fr: 'Jaune', ja: 'きいろ', ko: '노랑', ink: '#a47c00' },
  ];

  let stimulusLanguage = isStroop ? L.language : 'symbols';
  let phase = 'idle';
  let session = null;
  let trial = null;
  let pointerAnswer = null;
  let locked = true;
  let frame = 0;
  let nextFrame = 0;
  let timer = 0;
  let generation = 0;
  let lastClock = '';
  let records = [];

  let noticeTimeout;

  const shuffle = Core.shuffle;
  const active = () => ['countdown', 'running'].includes(phase);
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

  const history = Core.createHistory({
    version: currentGame().version,
    rules: () => ({ durationMs: DURATION, stimulusLanguage }),
    display: () => document.querySelector('.board-panel'),

    interrupt: () => interrupt(),
  });

  function validateRecords(value) {
    if (!Array.isArray(value)) throw Error('records');
    return value.map((r) => {
      if (
        !r ||
        r.meta?.rulesVersion !== currentGame().version ||
        typeof r.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
        typeof r.endedAt !== 'string' ||
        !Number.isFinite(Date.parse(r.endedAt)) ||
        r.rules !== RULES ||
        r.durationMs !== DURATION ||
        !(isStroop ? L.languages : ['symbols']).includes(r.stimulusLanguage) ||
        !['error', 'timeout'].includes(r.reason) ||
        !finite(r.elapsedMs, 0, DURATION) ||
        (r.reason === 'timeout' && r.elapsedMs !== DURATION) ||
        !Array.isArray(r.trials)
      )
        throw Error('record');
      let previousEnd = 0;
      const trials = r.trials.map((t, index) => {
        const max = isStroop ? 3 : 1;
        if (
          !t ||
          !integer(t.target, 0, max) ||
          !integer(t.distractor, 0, max) ||
          !integer(t.answer, 0, max) ||
          t.congruent !== (t.target === t.distractor) ||
          !finite(t.onsetMs, 0, DURATION) ||
          t.onsetMs < previousEnd - 0.1 ||
          !finite(t.rtMs, 0, DURATION) ||
          t.onsetMs + t.rtMs > r.elapsedMs + 0.1 ||
          !['keyboard', 'pointer'].includes(t.input) ||
          (t.answer !== t.target && (r.reason !== 'error' || index !== r.trials.length - 1))
        )
          throw Error('trial');
        previousEnd = t.onsetMs + t.rtMs;
        return {
          target: t.target,
          distractor: t.distractor,
          congruent: t.congruent,
          answer: t.answer,
          onsetMs: t.onsetMs,
          rtMs: t.rtMs,
          input: t.input,
        };
      });
      if (r.reason === 'error' && (!trials.length || trials.at(-1).answer === trials.at(-1).target))
        throw Error('reason');
      const score = trials.filter((t) => t.answer === t.target).length;
      if (r.score !== score) throw Error('score');
      return {
        meta: Core.readMeta(r.meta),
        id: r.id,
        endedAt: new Date(r.endedAt).toISOString(),
        rules: RULES,
        durationMs: DURATION,
        stimulusLanguage: r.stimulusLanguage,
        reason: r.reason,
        elapsedMs: r.elapsedMs,
        score,
        trials,
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
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (isStroop && L.languages.includes(saved?.stimulusLanguage))
        stimulusLanguage = saved.stimulusLanguage;
    } catch {}
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
  function cancelScheduled() {
    generation++;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    cancelAnimationFrame(nextFrame);
  }
  function schedule(callback, delay) {
    const token = generation;
    timer = setTimeout(() => {
      if (token === generation) callback();
    }, delay);
  }
  function onNextFrame(callback) {
    const token = generation;
    nextFrame = requestAnimationFrame(() => {
      if (token === generation) callback();
    });
  }
  function setPhase(next, label) {
    phase = next;
    I18n.text($('phase-label'), label);
    document.body.classList.toggle('running', active());
    settingsForm?.querySelectorAll('fieldset').forEach((field) => {
      field.disabled = active();
    });
  }
  function showPanel(name) {
    for (const id of ['idle', 'countdown', 'play', 'result']) $(id + '-panel').hidden = id !== name;
  }
  function disableResponses(disabled) {
    $('answers')
      .querySelectorAll('button')
      .forEach((button) => {
        button.disabled = disabled;
      });
  }
  function updateClock(remaining) {
    const whole = Math.ceil(Math.max(0, remaining) / 1000);
    const value = `00:${String(whole).padStart(2, '0')}`;
    if (value === lastClock) return;
    lastClock = value;
    I18n.text($('timer-main'), value);
    I18n.attribute($('timer-main'), 'aria-label', m('ui.value-seconds-remaining', whole));
    $('progress').setAttribute('aria-valuenow', String(30 - whole));
    $('progress-fill').style.width = `${((30 - whole) / 30) * 100}%`;
  }
  function elapsed() {
    return Core.elapsed(session.startedMono);
  }
  function tick() {
    if (phase !== 'running') return;
    const remaining = DURATION - elapsed();
    updateClock(remaining);
    if (remaining <= 0) {
      finish('timeout');
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function createArrow(direction) {
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawing.setAttribute('viewBox', '0 0 48 48');
    drawing.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(drawing.namespaceURI, 'path');
    path.setAttribute('d', 'M8 24h30M25 10l14 14-14 14');
    if (direction === 0) path.setAttribute('transform', 'translate(48 0) scale(-1 1)');
    drawing.append(path);
    return drawing;
  }
  function drawStimulus(node, item) {
    node.replaceChildren();
    if (isStroop) {
      const word = document.createElement('span');
      word.className = 'color-word';
      word.textContent = colors[item.distractor][stimulusLanguage];
      word.lang = L.locales[stimulusLanguage];
      word.style.color = colors[item.target].ink;
      node.append(word);
    } else {
      const arrows = document.createElement('div');
      arrows.className = 'arrow-row';
      for (let i = 0; i < 5; i++)
        arrows.append(createArrow(i === 2 ? item.target : item.distractor));
      node.append(arrows);
    }
  }
  function drawAnswers() {
    $('answers').replaceChildren();
    for (let index = 0; index < (isStroop ? 4 : 2); index++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.answer = String(index);
      const key = document.createElement('kbd');
      key.textContent = isStroop ? String(index + 1) : index === 0 ? '←' : '→';
      const label = document.createElement('span');
      if (isStroop) {
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.background = colors[index].ink;
        swatch.setAttribute('aria-hidden', 'true');
        label.textContent = colors[index][stimulusLanguage];
        label.lang = L.locales[stimulusLanguage];
        button.append(swatch, label, key);
      } else {
        I18n.text(label, index === 0 ? 'ui.left' : 'ui.right');
        button.append(key, label);
      }
      $('answers').append(button);
    }
  }
  function ready(note = '') {
    history.cancel();
    cancelScheduled();
    locked = true;
    session = null;
    trial = null;
    pointerAnswer = null;
    setPhase('idle', 'ui.ready');
    showPanel('idle');
    I18n.text($('action-label'), 'ui.start');
    I18n.text($('result-note'), note);
    I18n.text($('attempt-count'), '');
    I18n.text($('board-hint'), '');
    $('action-icon').removeAttribute('hidden');
    lastClock = '';
    updateClock(DURATION);
    settingsForm?.querySelectorAll('input').forEach((input) => {
      input.checked = input.value === stimulusLanguage;
    });
    drawStimulus($('idle-sample'), { target: 1, distractor: 0 });
    drawAnswers();
    disableResponses(true);
  }
  function refillBag() {
    const items = [];
    if (isStroop) {
      if (!session.offsets.length) session.offsets = shuffle([1, 2, 3]);
      const offset = session.offsets.pop();
      for (let target = 0; target < 4; target++) {
        items.push({ target, distractor: target });
        items.push({ target, distractor: (target + offset) % 4 });
      }
    } else {
      for (let repeat = 0; repeat < 2; repeat++) {
        for (let target = 0; target < 2; target++) {
          items.push({ target, distractor: target }, { target, distractor: 1 - target });
        }
      }
    }
    const same = (a, b) => a && b && a.target === b.target && a.distractor === b.distractor;
    const hasRepeat = (list) =>
      list.some((item, index) => same(item, index ? list[index - 1] : trial));
    let ordered = shuffle(items);
    for (let attempt = 0; attempt < 20 && hasRepeat(ordered); attempt++) ordered = shuffle(items);
    if (hasRepeat(ordered)) {
      ordered = [...items];
      if (same(ordered[0], trial)) ordered.push(ordered.shift());
    }
    session.bag = ordered.reverse();
  }
  function nextTrial() {
    if (phase !== 'running') return;
    if (phase === 'running' && elapsed() >= DURATION) {
      finish('timeout');
      return;
    }
    if (!session.bag.length) refillBag();
    const item = session.bag.pop();
    drawStimulus($('stimulus'), item);
    trial = { ...item, congruent: item.target === item.distractor, startedMono: performance.now() };
    locked = false;
    disableResponses(false);
    I18n.text(
      $('board-hint'),
      isStroop ? 'ui.press-1-4-or-choose-a-color' : 'ui.press-or-choose-a-direction',
    );
    I18n.text($('attempt-count'), m('ui.value-pts', session.score));
  }
  function start() {
    if (document.hidden) return;
    cancelScheduled();
    session = { score: 0, trials: [], bag: [], offsets: [], stimulusLanguage };
    trial = null;
    pointerAnswer = null;
    locked = true;
    setPhase('countdown', 'ui.ready');
    showPanel('countdown');
    I18n.text($('action-label'), 'ui.cancel-round');
    I18n.text($('result-note'), '');
    I18n.text($('board-hint'), '');
    I18n.text($('attempt-count'), '');
    $('action-icon').setAttribute('hidden', '');
    lastClock = '';
    updateClock(DURATION);
    function countdown(value) {
      I18n.text($('countdown-value'), String(value));
      schedule(() => {
        if (value > 1) countdown(value - 1);
        else
          onNextFrame(() => {
            if (document.hidden) {
              ready('ui.you-left-the-page-no-score-was-saved');
              return;
            }
            setPhase('running', game.playLabel);
            showPanel('play');
            I18n.text($('action-label'), 'ui.cancel-round');
            session.meta = history.begin();
            session.startedMono = performance.now();
            nextTrial();
            $('play-panel').focus({ preventScroll: true });
            tick();
          });
      }, 1000);
    }
    countdown(3);
  }
  function answer(value, input) {
    if (phase !== 'running' || locked || !trial) return;
    if (document.hidden) {
      ready('ui.you-left-the-page-no-score-was-saved');
      return;
    }
    const answeredAt = performance.now();
    if (phase === 'running' && !history.checkTiming(answeredAt)) return;
    if (phase === 'running' && Core.elapsed(session.startedMono, answeredAt) >= DURATION) {
      finish('timeout');
      return;
    }
    locked = true;
    disableResponses(true);
    const correct = value === trial.target;
    session.trials.push({
      target: trial.target,
      distractor: trial.distractor,
      congruent: trial.congruent,
      answer: value,
      onsetMs: trial.startedMono - session.startedMono,
      rtMs: answeredAt - trial.startedMono,
      input,
    });
    if (!correct) {
      finish('error');
      return;
    }
    session.score++;
    I18n.text($('attempt-count'), m('ui.value-pts', session.score));
    onNextFrame(nextTrial);
  }
  function finish(reason) {
    if (phase !== 'running' || !history.checkTiming()) return;
    const elapsedMs = reason === 'timeout' ? DURATION : Math.min(DURATION, elapsed());
    cancelScheduled();
    locked = true;
    disableResponses(true);
    setPhase('finished', 'ui.game-over');
    showPanel('result');
    updateClock(DURATION - elapsedMs);
    I18n.text($('action-label'), 'ui.play-again');
    $('action-icon').removeAttribute('hidden');
    I18n.text(
      $('finish-title'),
      reason === 'error' ? 'ui.wrong-answer-game-over' : 'ui.time-is-up',
    );
    I18n.text($('final-score'), String(session.score));
    I18n.text($('final-time'), m('ui.time-value-s', (elapsedMs / 1000).toFixed(1)));
    I18n.text($('attempt-count'), '');
    I18n.text($('board-hint'), '');
    const previous = Core.previousRecords(records, session.meta);
    const best = previous.reduce((value, r) => Math.max(value, r.score), -Infinity);
    const record = {
      meta: history.finish(session.meta),
      id:
        globalThis.crypto?.randomUUID?.() ||
        `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      endedAt: new Date().toISOString(),
      rules: RULES,
      durationMs: DURATION,
      stimulusLanguage: session.stimulusLanguage,
      reason,
      elapsedMs,
      score: session.score,
      trials: session.trials,
    };
    records = mergeRecords(records, [record]);
    Core.commitRecord(record);
    const saved = persistRecords();
    I18n.text(
      $('result-note'),
      !saved
        ? 'ui.local-result-kept-on-page'
        : previous.length && record.score > best
          ? 'ui.new-best'
          : 'ui.saved',
    );
    history.updateContext();
  }

  $('action').addEventListener('click', () => {
    if (phase === 'running') {
      if (elapsed() >= DURATION) finish('timeout');
      else ready('ui.round-canceled-no-score-was-saved');
    } else if (active()) ready();
    else start();
  });
  $('answers').addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const button = event.target instanceof Element ? event.target.closest('[data-answer]') : null;
    pointerAnswer =
      button && !button.disabled && !locked ? { button, trial, pointerId: event.pointerId } : null;
  });
  $('answers').addEventListener('pointercancel', (event) => {
    if (pointerAnswer?.pointerId === event.pointerId) pointerAnswer = null;
  });
  $('answers').addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-answer]') : null;
    if (!button || button.disabled) return;
    const isPointer = event.detail > 0 || !!event.pointerType;
    if (isPointer) {
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
    answer(Number(button.dataset.answer), isPointer ? 'pointer' : 'keyboard');
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (
      phase !== 'running' ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (
      target instanceof Element &&
      (target.closest('input, textarea, select, summary, a, [data-language-switch], #action') ||
        (target instanceof HTMLElement && target.isContentEditable))
    )
      return;
    const value = isStroop
      ? /^[1-4]$/.test(event.key)
        ? Number(event.key) - 1
        : null
      : event.key === 'ArrowLeft'
        ? 0
        : event.key === 'ArrowRight'
          ? 1
          : null;
    if (value !== null) {
      event.preventDefault();
      answer(value, 'keyboard');
    }
  });
  settingsForm?.addEventListener('submit', (event) => event.preventDefault());
  settingsForm?.addEventListener('change', (event) => {
    if (active() || !isStroop || !L.languages.includes(event.target.value)) return;
    stimulusLanguage = event.target.value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ stimulusLanguage }));
    } catch {}
    ready();
    history.updateContext();
  });
  function interrupt() {
    if (active()) ready('ui.you-left-the-page-no-score-was-saved');
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
  ready();
  history.updateContext();
}
