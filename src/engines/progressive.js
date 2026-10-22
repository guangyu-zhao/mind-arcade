import { GameText } from './span/i18n.js';
import { Core } from '../core/index.js';
import { currentGame } from '../catalog.js';
import { judgmentReview } from './span/review.js';

const I = GameText;

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const abortError = () => new DOMException('Aborted', 'AbortError');
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const shuffle = Core.shuffle;

function node(tag, key, values, className) {
  const n = document.createElement(tag);
  if (key) I.text(n, key, values);
  if (className) n.className = className;
  return n;
}
function svg(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  return n;
}
function picture() {
  const s = svg('svg', { viewBox: '0 0 640 480', 'aria-hidden': 'true' });
  $('stage').replaceChildren(s);
  return s;
}
function button(key, fn, primary = false, values) {
  const b = node('button', key, values, `button${primary ? ' primary' : ''}`);
  b.type = 'button';
  if (fn) b.addEventListener('click', fn);
  return b;
}
function center(key, values, caption) {
  const box = node('div', null, null, 'stage-center');
  box.append(node('h2', key, values));
  if (caption) box.append(node('p', caption));
  $('stage').replaceChildren(box);
  return box;
}
const CognitiveGame = {
  init(config) {
    config = { ...config, version: currentGame().version };
    I.add(config.strings);
    const RECORDS_KEY = Core.recordKey(currentGame().id);
    const SCALE_KEY = `${config.slug}.display-scale.v1`;
    const scaleSlider = $('display-scale');
    const settingsForm = $('settings');
    const currentRules = () => config.getRules?.() || {};
    const LIVES = 3;
    let records = [],
      active = null,
      memoryOnly = false,
      noticeTimer;
    let displayScale = 100;
    function applyScale(value) {
      const clamped = finite(value) ? Math.max(40, Math.min(100, value)) : 100;
      displayScale = Math.round(clamped / 5) * 5;
      scaleSlider.value = String(displayScale);
      scaleSlider.setAttribute('aria-valuetext', `${displayScale}%`);
      $('display-scale-value').value = `${displayScale}%`;
      $('stage-frame').style.setProperty('--display-scale', String(displayScale / 100));
      $('stage-frame').toggleAttribute('data-compact', displayScale < 70);
    }
    try {
      const saved = localStorage.getItem(SCALE_KEY);
      if (saved !== null && saved.trim() !== '') displayScale = Number(saved);
    } catch {}
    applyScale(displayScale);
    function notice(key, values) {
      clearTimeout(noticeTimer);
      I.text($('notice'), key, values);
      $('notice').hidden = false;
      noticeTimer = setTimeout(() => {
        $('notice').hidden = true;
      }, 6500);
    }
    function storageFailed() {
      memoryOnly = true;
      notice('storageFailed');
    }
    const merge = Core.mergeRecords;
    const history = Core.createHistory({
      version: config.version,
      rules: currentRules,
      display: () => $('stage'),

      interrupt: () => {
        if (active) {
          finish('timing');
          notice('timingStop');
        }
      },
    });
    function validHeader(r) {
      return (
        r &&
        typeof r.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(r.id) &&
        typeof r.startedAt === 'string' &&
        finite(Date.parse(r.startedAt)) &&
        typeof r.endedAt === 'string' &&
        finite(Date.parse(r.endedAt)) &&
        finite(r.elapsedMs) &&
        r.elapsedMs >= 0
      );
    }
    function replay(rawTrials, rules) {
      if (!Array.isArray(rawTrials)) throw Error('trial count');
      let level = 1,
        lives = LIVES,
        highest = 0,
        ended = false;
      const trials = rawTrials.map((raw) => {
        if (ended || !raw || raw.level !== level) throw Error('level sequence');
        const plan = config.levelPlan(level, rules),
          clean = config.validateTrial(raw);
        config.validateContext(clean, plan);
        const passed = config.passes(clean, plan);
        const result = { ...clean, level, passed };
        if (passed) {
          highest = level;
          level++;
        } else {
          lives--;
          if (lives === 0) ended = true;
        }
        return result;
      });
      return { trials, level, lives, highest, ended };
    }
    function validateRecord(r) {
      if (
        !validHeader(r) ||
        !['lives', 'user', 'hidden', 'resize', 'timing', 'error'].includes(r.reason) ||
        !['complete', 'stopped', 'interrupted'].includes(r.status)
      )
        throw Error('record');
      const meta = Core.readMeta(r.meta);
      if (!meta || meta.rulesVersion !== config.version) throw Error('rules version');
      const state = replay(r.trials, meta.rules);
      config.validateSession?.(state.trials, meta);
      const expectedStatus =
        r.reason === 'lives' ? 'complete' : r.reason === 'user' ? 'stopped' : 'interrupted';
      if (
        r.status !== expectedStatus ||
        (r.reason === 'lives' && state.lives !== 0) ||
        (r.reason !== 'lives' && state.ended)
      )
        throw Error('ending');
      return {
        meta,
        id: r.id,
        startedAt: new Date(r.startedAt).toISOString(),
        endedAt: new Date(r.endedAt).toISOString(),
        elapsedMs: Math.round(r.elapsedMs),
        status: expectedStatus,
        reason: r.reason,
        score: state.highest,
        lives: state.lives,
        maxFrameGapMs: finite(r.maxFrameGapMs)
          ? Math.max(0, Math.min(86400000, r.maxFrameGapMs))
          : 0,
        trials: state.trials,
      };
    }
    function validateRecords(value) {
      if (!Array.isArray(value)) throw Error('records');
      return value.map(validateRecord);
    }
    try {
      records = merge(Core.readRecords(RECORDS_KEY, validateRecords));
    } catch {
      storageFailed();
    }
    function persist() {
      try {
        records = Core.saveRecords(RECORDS_KEY, records, validateRecords);
        memoryOnly = false;
        return true;
      } catch {
        storageFailed();
        return false;
      }
    }
    function updateScore(value) {
      $('score').textContent = String(value);
      I.text($('score-unit'), 'levelUnit');
    }
    function setPhase(key, values) {
      I.text($('phase'), key, values);
    }
    function setHint(key, values) {
      if (key) I.text($('hint'), key, values);
      else {
        delete $('hint').dataset.l10n;
        $('hint').textContent = '';
      }
    }
    function updateControls() {
      document.body.classList.toggle('running', !!active);
      scaleSlider.disabled = !!active;
      settingsForm?.querySelectorAll('fieldset').forEach((field) => {
        field.disabled = !!active;
      });
      $('action-icon').toggleAttribute('hidden', !!active);
      I.text($('action-label'), active ? 'stop' : 'start');
      $('action').classList.toggle('primary', !active);
    }
    function updateLives(lives) {
      const group = $('lives');
      group.replaceChildren();
      I.label(group, 'livesLeft', { n: lives });
      for (let i = 0; i < LIVES; i++) {
        const dot = node('span', null, null, `life${i < lives ? ' available' : ''}`);
        dot.setAttribute('aria-hidden', 'true');
        group.append(dot);
      }
    }
    function updateLevel(level) {
      I.text($('counter'), 'levelValue', { n: level });
    }
    function idle() {
      document.querySelector('.judgment-review')?.remove();
      setPhase('ready');
      setHint('');
      $('toolbar').replaceChildren();
      updateScore(0);
      updateLives(LIVES);
      updateLevel(1);
      const box = node('div', null, null, 'stage-center'),
        preview = svg('svg', { viewBox: '0 0 160 110', class: 'preview', 'aria-hidden': 'true' });
      preview.innerHTML =
        typeof config.preview === 'function' ? config.preview(currentRules()) : config.preview;
      box.append(preview, node('p', 'intro'));
      $('stage').replaceChildren(box);
      I.text($('result-note'), 'startNote');
      updateControls();
    }

    function context(s) {
      const signal = s.controller.signal;
      function check() {
        if (signal.aborted || active !== s) throw abortError();
      }
      function hold(ms, options = {}) {
        check();
        return new Promise((resolve, reject) => {
          let raf,
            first = null,
            previous = performance.now();
          function cancel() {
            cancelAnimationFrame(raf);
            signal.removeEventListener('abort', onAbort);
          }
          function onAbort() {
            cancel();
            reject(abortError());
          }
          function frame(now) {
            if (signal.aborted) {
              onAbort();
              return;
            }
            if (first === null) first = now;
            const gap = Math.max(0, now - previous);
            previous = now;
            if (options.critical) {
              s.maxFrameGapMs = Math.max(s.maxFrameGapMs, gap);
              if (gap > 120) {
                finish('timing');
                notice('timingStop');
                return;
              }
            }
            const elapsed = Math.min(ms, now - first);
            try {
              options.frame?.(elapsed, gap);
            } catch (error) {
              cancel();
              reject(error);
              return;
            }
            if (elapsed >= ms) {
              cancel();
              resolve(now - first);
            } else raf = requestAnimationFrame(frame);
          }
          signal.addEventListener('abort', onAbort, { once: true });
          raf = requestAnimationFrame(frame);
        });
      }
      function response(register, timeout = 0) {
        check();
        return new Promise((resolve, reject) => {
          let finished = false,
            cleanup = () => {},
            timer;
          const began = performance.now();
          function dispose() {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            cleanup();
          }
          function done(value, timedOut = false) {
            if (finished || !history.checkTiming()) return;
            const rtMs = performance.now() - began;
            timedOut = timedOut || (timeout > 0 && rtMs >= timeout);
            finished = true;
            dispose();
            resolve({ value: timedOut ? null : value, rtMs, timedOut });
          }
          function onAbort() {
            if (finished) return;
            finished = true;
            dispose();
            reject(abortError());
          }
          function expire() {
            if (finished) return;
            const remaining = timeout - (performance.now() - began);
            if (remaining > 0) timer = setTimeout(expire, Math.max(1, remaining));
            else done(null, true);
          }
          signal.addEventListener('abort', onAbort, { once: true });
          try {
            cleanup = register((value) => done(value)) || (() => {});
          } catch (error) {
            finished = true;
            dispose();
            reject(error);
            return;
          }
          if (finished) cleanup();
          else if (timeout) timer = setTimeout(expire, timeout);
        });
      }
      async function advance(key = 'next') {
        await response((done) => {
          const b = button(key, () => done(true), true);
          $('toolbar').replaceChildren(b);
          return () => b.remove();
        });
      }
      return {
        signal,
        rules: s.meta.rules,
        session: s.taskSession,
        shuffle,
        node,
        svg,
        picture,
        button,
        center,
        I,
        stage: $('stage'),
        toolbar: $('toolbar'),
        hold,
        response,
        advance,
        phase: setPhase,
        hint: setHint,
        check,
        async blank(ms = 500) {
          $('stage').replaceChildren();
          $('toolbar').replaceChildren();
          setHint('');
          await hold(ms);
        },
      };
    }

    function showResult(r, s) {
      $('toolbar').replaceChildren();
      updateScore(r.score);
      updateLives(r.lives);
      if (r.reason === 'lives' && r.trials.length) {
        config.feedback(s.ctx, r.trials.at(-1));
        I.text($('result-note'), r.score ? 'gameOverLevel' : 'noLevelFinished', { n: r.score });
      } else {
        const key = r.status === 'interrupted' ? 'interrupted' : 'stopped';
        setPhase(key);
        setHint('');
        const box = center(key);
        box.append(node('p', r.score ? 'finalLevel' : 'noLevel', { n: r.score }));
        I.text(
          $('result-note'),
          r.status === 'interrupted' ? 'notInTrend' : memoryOnly ? 'lost' : 'saved',
        );
      }
      if (memoryOnly) I.text($('result-note'), 'lost');
      I.text($('action-label'), 'again');
    }
    function finish(reason = 'user') {
      if (active && ['user', 'lives'].includes(reason) && !history.checkTiming()) return;
      if (!active) return;
      const s = active;
      active = null;
      s.controller.abort();
      const record = {
        meta: history.finish(s.meta),
        id: s.id,
        startedAt: s.startedAt,
        endedAt: new Date().toISOString(),
        elapsedMs: Core.elapsed(s.started),
        status: reason === 'lives' ? 'complete' : reason === 'user' ? 'stopped' : 'interrupted',
        reason,
        score: s.highest,
        lives: s.lives,
        maxFrameGapMs: s.maxFrameGapMs,
        trials: s.trials,
      };
      records = merge(records, [record]);
      Core.commitRecord(record);
      persist();

      updateControls();
      showResult(record, s);
      if (config.describeJudgment && record.status !== 'interrupted') {
        const review = judgmentReview(s.ctx, s.trials, config.describeJudgment);
        if (review) document.querySelector('.board-panel').append(review);
      }
      history.updateContext();
    }
    async function start() {
      if (active || document.hidden) return;
      document.querySelector('.judgment-review')?.remove();
      document.activeElement?.blur();
      $('help').open = false;
      const s = {
        id:
          typeof window.crypto?.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        controller: new AbortController(),
        startedAt: new Date().toISOString(),
        started: performance.now(),
        level: 1,
        highest: 0,
        lives: LIVES,
        trials: [],
        maxFrameGapMs: 0,
      };
      active = s;
      updateControls();
      s.meta = history.begin();
      s.taskSession = config.createSession?.(s.meta.rules);
      s.ctx = context(s);
      updateScore(0);
      updateLives(LIVES);
      updateLevel(1);
      I.text($('result-note'), 'startNote');
      const ctx = s.ctx;
      try {
        if (config.beforeRun) {
          await config.beforeRun(ctx);
          ctx.check();
        }
        while (s.lives > 0) {
          ctx.check();
          const level = s.level,
            plan = config.levelPlan(level, s.meta.rules);
          updateLevel(level);
          setPhase('ready');
          await ctx.blank(500);
          const raw = await config.run(ctx, plan);
          ctx.check();
          const trial = { ...raw, level, passed: config.passes(raw, plan) };
          s.trials.push(trial);
          if (trial.passed) {
            s.highest = level;
            s.level++;
          } else s.lives--;
          updateScore(s.highest);
          updateLives(s.lives);
          if (s.lives === 0) {
            finish('lives');
            return;
          }
          config.feedback(ctx, trial);
          I.text($('result-note'), trial.passed ? 'levelPassed' : 'levelMissed', {
            n: level,
            lives: s.lives,
          });
          await ctx.advance(trial.passed ? 'nextLevel' : 'retryLevel');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          finish('error');
          notice('errorStop');
        }
      }
    }
    $('help-content').append(
      node('p', 'instructions'),
      node('p', 'progressionHelp'),
      node('p', 'challengeRules'),
    );
    $('action').addEventListener('click', () => (active ? finish() : start()));
    settingsForm?.addEventListener('submit', (event) => event.preventDefault());
    settingsForm?.addEventListener('change', () => {
      if (active || !config.changeSettings) return;
      config.changeSettings();
      idle();
      history.updateContext();
    });
    scaleSlider.addEventListener('input', () => {
      if (active) return;
      applyScale(Number(scaleSlider.value));
      history.updateContext();
    });
    scaleSlider.addEventListener('change', () => {
      if (active) return;
      try {
        localStorage.setItem(SCALE_KEY, String(displayScale));
      } catch {}
    });

    window.addEventListener('storage', (e) => {
      if (e.key === RECORDS_KEY || e.key?.startsWith(`${RECORDS_KEY}:`)) {
        try {
          records = merge(records, Core.readRecords(RECORDS_KEY, validateRecords));
          history.updateContext();
        } catch {}
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && active) {
        finish('hidden');
        notice('hiddenStop');
      }
    });
    window.addEventListener('pagehide', () => {
      if (active) finish('hidden');
    });
    let resizeTimer;
    function resized() {
      if (active) {
        const d = $('stage').getBoundingClientRect();
        if (
          Math.abs(d.width - active.meta.display.width) > 2 ||
          Math.abs(d.height - active.meta.display.height) > 2
        ) {
          finish('resize');
          notice('resizeStop');
        }
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(history.updateContext, 150);
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(resized).observe($('stage'));
    else window.addEventListener('resize', resized);
    idle();
    window.addEventListener('mindlab-language-change', () =>
      document.querySelector('.judgment-review')?.refreshLanguage(),
    );
    I.update();
    history.updateContext();
  },
  shuffle,
  finite,
  integer,
};
export { CognitiveGame };
