import { Core } from '../../core/index.js';
import { GameI18n as I } from '../../i18n/runtime.js';
import { ReactionModel as M } from './model.js';
import { currentGame } from '../../catalog.js';
export function mountGame() {
  const game = currentGame(),
    kind = game.config.kind,
    p = M.protocol(kind);
  const $ = (id) => document.getElementById(id);
  const RECORDS_KEY = Core.recordKey(game.id);
  const MAX_FRAME_GAP_MS = 150;
  let phase = 'idle',
    session = null,
    trial = null,
    frame = 0,
    records = [],
    noticeTimer = 0;
  const active = () => ['countdown', 'running'].includes(phase);
  const history = Core.createHistory({
    version: game.version,
    rules: () => ({ kind, durationMs: p.durationMs }),
    display: () => document.querySelector('.board-panel'),
    interrupt: () => interrupt(),
  });
  const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;
  function validateRecords(list) {
    if (!Array.isArray(list)) throw Error('records');
    return list.map((r) => {
      if (
        !r ||
        !/^[\w-]{1,100}$/.test(r.id) ||
        !Number.isFinite(Date.parse(r.endedAt)) ||
        r.kind !== kind ||
        r.durationMs !== p.durationMs ||
        !['error', 'timeout'].includes(r.reason) ||
        !finite(r.elapsedMs, 0, p.durationMs) ||
        (r.reason === 'timeout' && r.elapsedMs !== p.durationMs) ||
        !Array.isArray(r.trials) ||
        !Array.isArray(r.early) ||
        r.early.length > 1
      )
        throw Error('record');
      const meta = Core.readMeta(r.meta);
      if (
        !meta ||
        meta.rulesVersion !== game.version ||
        meta.rules.kind !== kind ||
        meta.rules.durationMs !== p.durationMs
      )
        throw Error('conditions');
      let previousEnd = 0,
        errors = 0;
      for (const t of r.trials) {
        if (
          errors ||
          !Number.isInteger(t.target) ||
          t.target < 0 ||
          t.target > (kind === 'pvt' ? 0 : 1) ||
          !(
            t.answer === null ||
            (Number.isInteger(t.answer) && t.answer >= 0 && t.answer <= (kind === 'choice' ? 1 : 0))
          ) ||
          (t.answer === null) !== (t.rtMs === null) ||
          (t.rtMs !== null && !finite(t.rtMs, 0, p.windowMs)) ||
          !finite(t.onsetMs, previousEnd, r.elapsedMs) ||
          !finite(t.endMs, t.onsetMs, r.elapsedMs + 0.1) ||
          !finite(t.waitMs, p.waitMin, p.waitMax) ||
          Math.abs(t.endMs - t.onsetMs - (t.rtMs ?? p.windowMs)) > 0.1
        )
          throw Error('trial');
        if (!M.correct(kind, t)) errors++;
        previousEnd = t.endMs;
      }
      if (r.early.some((at) => !finite(at, previousEnd, r.elapsedMs)))
        throw Error('early response');
      errors += r.early.length;
      if (errors !== (r.reason === 'error' ? 1 : 0)) throw Error('ending');
      const score = M.summarize(kind, r.trials).score;
      if (r.score !== score) throw Error('score');
      return { ...r, meta, score };
    });
  }
  function notify(key) {
    clearTimeout(noticeTimer);
    I.text($('notice'), key);
    $('notice').hidden = false;
    noticeTimer = setTimeout(() => {
      $('notice').hidden = true;
    }, 6500);
  }
  try {
    records = Core.readRecords(RECORDS_KEY, validateRecords);
  } catch {}
  function setPhase(next) {
    phase = next;
    document.body.classList.toggle('running', active());
    I.text(
      $('action-label'),
      active() ? 'ui.cancel-round' : next === 'finished' ? 'ui.try-again' : 'ui.start',
    );
    $('action-icon').toggleAttribute('hidden', active());
    I.text(
      $('phase-label'),
      next === 'running' ? 'ui.in-progress' : next === 'finished' ? 'ui.game-over' : 'ui.ready',
    );
  }
  function panel(name) {
    for (const id of ['idle', 'countdown', 'play', 'result']) $(id + '-panel').hidden = id !== name;
  }
  function clock(ms) {
    const value = Math.max(0, ms),
      seconds = Math.ceil(value / 1000);
    I.text($('timer-main'), `00:${String(seconds).padStart(2, '0')}`);
    const progress = 100 * (1 - value / p.durationMs);
    $('progress').setAttribute('aria-valuenow', String(Math.round(progress)));
    $('progress-fill').style.width = `${progress}%`;
  }
  function hint() {
    return kind === 'choice' ? 'ui.press-or-choose-a-direction' : 'rules.respond-any-device';
  }
  function shape(node, target, example = false) {
    I.replaceChildren(node);
    if (kind === 'pvt') {
      const span = document.createElement('span');
      span.className = 'counter';
      span.textContent = example ? '250' : '000';
      node.append(span);
      return;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    const element = document.createElementNS(
      svg.namespaceURI,
      kind === 'choice' ? 'path' : target === 0 ? 'circle' : 'rect',
    );
    const attrs =
      kind === 'choice'
        ? {
            d: 'M18 50h64M55 23l27 27-27 27',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 7,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            transform: target === 0 ? 'translate(100 0) scale(-1 1)' : '',
          }
        : target === 0
          ? { cx: 50, cy: 50, r: 30, fill: 'currentColor' }
          : { x: 23, y: 23, width: 54, height: 54, fill: 'currentColor' };
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    svg.append(element);
    node.append(svg);
  }
  function waiting() {
    const span = document.createElement('span');
    span.className = 'fixation';
    span.textContent = '+';
    I.replaceChildren($('stimulus'), span);
  }
  function answers() {
    $('answers').replaceChildren();
    $('answers').classList.toggle('single', kind !== 'choice');
    (kind === 'choice' ? ['ui.left', 'ui.right'] : ['ui.respond']).forEach((label, index) => {
      const button = document.createElement('button'),
        text = document.createElement('span'),
        key = document.createElement('kbd');
      button.type = 'button';
      button.dataset.answer = String(index);
      I.text(text, label);
      key.textContent = kind === 'choice' ? ['←', '→'][index] : 'Space';
      button.append(text, key);
      button.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        respond(index);
      });
      button.addEventListener('click', (event) => {
        if (event.detail === 0 && !event.pointerType) respond(index);
      });
      $('answers').append(button);
    });
  }
  function ready(note = '') {
    cancelAnimationFrame(frame);
    history.cancel();
    session = null;
    trial = null;
    setPhase('idle');
    panel('idle');
    clock(p.durationMs);
    I.text($('result-note'), note);
    I.text($('attempt-count'), '');
    I.text($('board-hint'), hint());
    shape($('idle-sample'), 1, true);
    if (kind === 'gonogo') {
      const circle = document.createElement('span'),
        square = document.createElement('span');
      shape(circle, 0);
      shape(square, 1);
      I.replaceChildren($('idle-sample'), circle, square);
    }
    answers();
  }
  function interrupt() {
    if (active()) ready('ui.page-left-or-timing-interrupted-attempt-not-saved');
  }
  function start() {
    if (active() || document.hidden) return;
    const now = performance.now();
    session = {
      trials: [],
      early: [],
      waitBalance: 0,
      started: 0,
      lastFrame: now,
      countdown: now,
      due: 0,
      waitMs: 0,
    };
    trial = null;
    I.text($('result-note'), '');
    I.text($('attempt-count'), '');
    setPhase('countdown');
    panel('countdown');
    clock(p.durationMs);
    I.text($('countdown-value'), '3');
    $('countdown-panel').focus({ preventScroll: true });
    frame = requestAnimationFrame(tick);
  }
  function queue(now) {
    const wait = M.nextWait(kind, session.waitBalance);
    session.waitMs = wait.waitMs;
    session.waitBalance = wait.balance;
    session.due = now + session.waitMs;
    trial = null;
    waiting();
  }
  function showTrial(now) {
    const target = M.nextTarget(kind);
    trial = {
      target,
      answer: null,
      rtMs: null,
      onsetMs: now - session.started,
      onset: now,
      waitMs: session.waitMs,
      hidden: false,
    };
    shape($('stimulus'), target);
  }
  function completeTrial(now) {
    const t = trial,
      s = session;
    const item = {
      target: t.target,
      answer: t.answer,
      rtMs: t.rtMs,
      onsetMs: t.onsetMs,
      waitMs: t.waitMs,
      endMs: t.onsetMs + (t.rtMs ?? p.windowMs),
    };
    s.trials.push(item);
    trial = null;
    if (!M.correct(kind, item)) {
      finish('error', now);
      return;
    }
    I.text($('attempt-count'), I.message('ui.value-pts', s.trials.length));
    queue(now);
  }
  function expired(now) {
    if (trial && trial.onset + p.windowMs <= Math.min(now, session.started + p.durationMs))
      completeTrial(trial.onset + p.windowMs);
    if (phase !== 'running') return true;
    if (now - session.started >= p.durationMs) {
      finish('timeout', session.started + p.durationMs);
      return true;
    }
    return false;
  }
  function tick(now) {
    if (!active() || !session) return;
    if (!checkTiming(now)) return;
    const s = session;
    s.lastFrame = now;
    if (phase === 'countdown') {
      const remaining = 3000 - (now - s.countdown);
      if (remaining > 0) I.text($('countdown-value'), String(Math.ceil(remaining / 1000)));
      else {
        setPhase('running');
        panel('play');
        $('play-panel').focus({ preventScroll: true });
        s.started = now;
        s.meta = history.begin();
        queue(now);
      }
    } else {
      if (expired(now)) return;
      if (!trial && now >= s.due) showTrial(now);
      if (trial) {
        const age = now - trial.onset;
        if (kind === 'pvt')
          $('stimulus').firstElementChild.textContent = String(Math.floor(age)).padStart(3, '0');
        else if (age >= p.visibleMs && !trial.hidden) {
          waiting();
          trial.hidden = true;
        }
      }
      clock(p.durationMs - (now - s.started));
    }
    frame = requestAnimationFrame(tick);
  }
  function checkTiming(now) {
    if (document.hidden || now - session.lastFrame > MAX_FRAME_GAP_MS) {
      interrupt();
      return false;
    }
    return phase === 'countdown' || history.checkTiming(now);
  }
  function respond(answer) {
    if (phase !== 'running' || !session) return;
    const now = performance.now();
    if (!checkTiming(now)) return;
    if (expired(now)) return;
    if (!trial) {
      session.early.push(now - session.started);
      finish('error', now);
      return;
    }
    trial.answer = answer;
    trial.rtMs = now - trial.onset;
    completeTrial(now);
  }
  function finish(reason, now) {
    if (phase !== 'running' || !session) return;
    const s = session;
    cancelAnimationFrame(frame);
    const record = validateRecords([
      {
        id:
          globalThis.crypto?.randomUUID?.() ||
          `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        kind,
        durationMs: p.durationMs,
        elapsedMs: Math.min(p.durationMs, now - s.started),
        reason,
        endedAt: new Date().toISOString(),
        meta: history.finish(s.meta),
        trials: s.trials,
        early: s.early,
        score: M.summarize(kind, s.trials).score,
      },
    ])[0];
    records = Core.mergeRecords(records, [record]);
    Core.commitRecord(record);
    let saved = true;
    try {
      records = Core.saveRecords(RECORDS_KEY, records, validateRecords);
    } catch {
      saved = false;
    }
    session = null;
    trial = null;
    setPhase('finished');
    panel('result');
    clock(p.durationMs - record.elapsedMs);
    I.text($('finish-title'), reason === 'error' ? 'rules.first-error-ended' : 'ui.time-is-up');
    I.text($('final-score'), String(record.score));
    I.text($('final-unit'), 'rules.correct-count');
    I.text($('result-note'), saved ? 'ui.saved' : 'ui.local-result-kept-on-page');
    I.text($('board-hint'), '');
    history.updateContext();
  }
  $('action').addEventListener('click', () =>
    active() ? ready('ui.round-canceled-no-score-was-saved') : start(),
  );
  document.addEventListener('keydown', (event) => {
    const keys = kind === 'choice' ? ['ArrowLeft', 'ArrowRight'] : ['Space'];
    if (
      phase !== 'running' ||
      !keys.includes(event.code) ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing ||
      (event.target instanceof Element &&
        (event.target.isContentEditable ||
          event.target.closest('input,textarea,select,summary,a,[data-language-switch],#action')))
    )
      return;
    event.preventDefault();
    respond(kind === 'choice' ? keys.indexOf(event.code) : 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) interrupt();
  });
  window.addEventListener('blur', interrupt);
  window.addEventListener('pagehide', interrupt);
  window.addEventListener('storage', (event) => {
    if (event.key !== RECORDS_KEY && !event.key?.startsWith(`${RECORDS_KEY}:`)) return;
    try {
      records = Core.mergeRecords(records, Core.readRecords(RECORDS_KEY, validateRecords));
    } catch {
      notify('ui.could-not-save-settings');
    }
  });
  ready();
  history.updateContext();
}
