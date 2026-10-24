import { currentGame } from '../../../catalog.js';
import { CognitiveGame } from '../../../engines/progressive.js';
import { SpanUI } from '../../../engines/span/ui.js';
import { SymmetryPlusRules } from './rules.js';
export function mountGame() {
  const G = CognitiveGame,
    R = SymmetryPlusRules,
    UI = SpanUI;
  const VERSION = currentGame().version;
  const SETTINGS_KEY = 'symmetry-span-plus-plus.settings.v1';
  const form = document.getElementById('settings');
  const colors = Object.freeze({
    blue: '#3977ad',
    green: '#4d8b63',
    orange: '#c98643',
    red: '#ac514e',
    gray: '#747b84',
    purple: '#7b62a6',
    yellow: '#d1b84b',
    pink: '#ce91b0',
  });
  const colorNames = Object.keys(colors);
  let settings = { ...R.DEFAULTS };
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) settings = R.readRules(JSON.parse(saved));
  } catch {}
  for (const [name, value] of Object.entries(settings)) {
    const input = form.elements.namedItem(name);
    if (typeof value === 'boolean') input.checked = value;
    else input.value = String(value);
  }
  const strings = {
    title: 'catalog.symmetry-span',
    intro: 'game.combine-flashes-judge-symmetry-remember-locations',
    instructions: 'game.combine-the-target-color-flashes-and-judge-top-bottom-or-left-rig',
    progressionHelp: 'game.each-session-picks-two-of-eight-colors-and-cues-the-target-color-',
    challengeRules: 'game.start-with-1-memory-location-and-add-one-each-level-without-a-cap',
    flashCount: 'game.squares-per-pattern',
    gridSize: 'game.grid-size',
    random: 'game.random',
    symmetryInterference: 'game.symmetry-interference',
    sequenceInterference: 'game.sequence-interference',
    recallDirection: 'ui.recall-order',
    recallTransform: 'game.recall-positions',
    forward: 'ui.forward',
    reverse: 'ui.reverse',
    original: 'game.original',
    rotated: 'settings.clockwise',
    counterclockwise: 'settings.counterclockwise',
    rotateClockwise: 'game.rotate-90-clockwise',
    rotateCounterclockwise: 'game.rotate-90-counterclockwise',
    cueTitle: 'game.color-to-attend-to',
    blue: 'game.blue',
    green: 'game.green',
    orange: 'game.orange',
    red: 'game.red',
    gray: 'game.gray',
    purple: 'game.purple',
    yellow: 'game.yellow',
    pink: 'game.pink',
    cueReady: 'game.ready-start',
    watchUnion: 'game.symmetry-value-value',
    watchUnionRandom: 'game.symmetry',
    groupProgress: 'game.group-value-value',
    judge: 'game.which-symmetry-fits-the-pattern',
    topBottom: 'game.top-bottom',
    leftRight: 'game.left-right',
    asymmetric: 'game.neither',
    judgeHint: 'game.top-bottom-left-right-neither',
    rememberSquare: 'game.remember-location-value-value',
    recallForward: 'game.forward-recall-original-positions',
    recallReverse: 'game.reverse-recall-original-positions',
    recallRotated: 'game.forward-recall-rotate-90-clockwise',
    recallReverseRotated: 'game.reverse-recall-rotate-90-clockwise',
    recallCounterclockwise: 'game.forward-recall-rotate-90-counterclockwise',
    recallReverseCounterclockwise: 'game.reverse-recall-rotate-90-counterclockwise',
    recallFeedback: 'game.value-value-locations-in-the-correct-order',
    judgmentFeedback: 'game.value-value-symmetry-decisions-correct-2',
    sequenceStep: 'game.step-value-row-value-column-value',
    sequenceReview: 'game.sequence-review',
  };
  function changeSettings() {
    const value = (name) => form.elements.namedItem(name).value;
    settings = R.readRules({
      size: Number(value('size')),
      flashCount: value('flashCount') === 'random' ? 'random' : Number(value('flashCount')),
      symmetryInterference: form.elements.namedItem('symmetryInterference').checked,
      sequenceInterference: form.elements.namedItem('sequenceInterference').checked,
      order: value('order'),
      transform: value('transform'),
    });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }
  function illuminate(cells, target, distractor, session) {
    cells[target].style.backgroundColor = colors[session.targetColor];
    cells[target].style.borderColor = colors[session.targetColor];
    if (distractor !== null) {
      cells[distractor].style.backgroundColor = colors[session.distractorColor];
      cells[distractor].style.borderColor = colors[session.distractorColor];
    }
  }
  function clear(cells) {
    cells.forEach((cell) => {
      cell.style.backgroundColor = '';
      cell.style.borderColor = '';
    });
  }
  async function beforeRun(ctx) {
    ctx.phase('ready');
    ctx.hint('');
    const box = ctx.center('cueTitle'),
      swatch = ctx.node('div', null, null, 'color-cue');
    swatch.style.backgroundColor = colors[ctx.session.targetColor];
    swatch.setAttribute('aria-hidden', 'true');
    box.append(swatch, ctx.node('strong', ctx.session.targetColor, {}, 'color-name'));
    await ctx.advance('cueReady');
  }
  async function showPattern(ctx, plan, group) {
    const { targets, distractors } = R.streams(
      plan.rules.flashCount,
      plan.rules.symmetryInterference,
      plan.rules.size,
    );
    const cells = UI.grid(ctx, false, plan.rules.size),
      frames = [];
    ctx.hint('groupProgress', { n: group + 1, total: plan.length });
    if (plan.rules.flashCount === 'random') ctx.phase('watchUnionRandom');
    for (let i = 0; i < targets.length; i++) {
      if (plan.rules.flashCount !== 'random')
        ctx.phase('watchUnion', { n: i + 1, total: targets.length });
      illuminate(cells, targets[i], distractors[i], ctx.session);
      const exposureMs = await ctx.hold(plan.flashMs, { critical: true });
      clear(cells);
      const gapMs = await ctx.hold(plan.gapMs, { critical: true });
      frames.push({ target: targets[i], distractor: distractors[i], exposureMs, gapMs });
    }
    return frames;
  }
  async function showMemory(ctx, plan, target, distractor) {
    const cells = UI.grid(ctx, false, plan.rules.size),
      highlighted = [target, distractor].filter((index) => index !== null);
    let visible = false;
    function display(on) {
      if (on === visible) return;
      visible = on;
      if (on) illuminate(cells, target, distractor, ctx.session);
      else clear(cells);
      highlighted.forEach((index) => cells[index].classList.toggle('memory-cue', on));
    }
    display(true);
    try {
      return await ctx.hold(plan.memoryMs, {
        critical: true,
        frame(elapsed) {
          display(elapsed < plan.memoryFlashMs || elapsed >= plan.memoryFlashMs + plan.memoryGapMs);
        },
      });
    } finally {
      display(false);
    }
  }
  async function judge(ctx, deadline) {
    ctx.phase('judge');
    ctx.hint('judgeHint');
    const choices = [
      { value: 'top-bottom', label: 'topBottom', key: 'ArrowUp' },
      { value: 'left-right', label: 'leftRight', key: 'ArrowLeft' },
      { value: 'neither', label: 'asymmetric', key: 'ArrowRight' },
    ];
    const buttons = choices.map((choice) => {
      const button = ctx.button(choice.label);
      button.classList.add('symmetry-answer');
      button.setAttribute('aria-keyshortcuts', choice.key);
      return button;
    });
    ctx.toolbar.replaceChildren(...buttons);
    const answer = await ctx.response((done) => {
      const began = performance.now();
      const respond = (value) => {
        if (performance.now() - began >= 150) done(value);
      };
      const clicks = choices.map((choice) => () => respond(choice.value));
      function key(event) {
        if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.isComposing)
          return;
        if (
          event.target instanceof Element &&
          (event.target.closest(
            'input, textarea, select, summary, a, .language-switch, #action, #help, #settings',
          ) ||
            (event.target instanceof HTMLElement && event.target.isContentEditable))
        )
          return;
        const choice = choices.find((item) => item.key === event.key);
        if (choice) {
          event.preventDefault();
          respond(choice.value);
        }
      }
      buttons.forEach((button, index) => button.addEventListener('click', clicks[index]));
      document.addEventListener('keydown', key);
      return () => {
        buttons.forEach((button, index) => button.removeEventListener('click', clicks[index]));
        document.removeEventListener('keydown', key);
      };
    }, deadline);
    ctx.toolbar.replaceChildren();
    return answer;
  }
  function recallPhase(rules) {
    const phases = {
      original: ['recallForward', 'recallReverse'],
      rotated: ['recallRotated', 'recallReverseRotated'],
      counterclockwise: ['recallCounterclockwise', 'recallReverseCounterclockwise'],
    };
    return phases[rules.transform][rules.order === 'reverse' ? 1 : 0];
  }
  async function run(ctx, plan) {
    const positions = [],
      memoryDistractors = [],
      memoryExposureMs = [],
      judgments = [];
    for (let i = 0; i < plan.length; i++) {
      const frames = await showPattern(ctx, plan, i);
      const answer = await judge(ctx, plan.decisionMs);
      judgments.push({
        frames,
        response: answer.timedOut ? null : answer.value,
        rtMs: answer.rtMs,
        timedOut: answer.timedOut,
      });
      await ctx.blank(plan.blankMs);
      const target = positions.length
        ? R.otherCell(positions.at(-1), plan.rules.size)
        : Math.floor(Math.random() * plan.rules.size ** 2);
      const distractor = plan.rules.sequenceInterference
        ? R.otherCell(target, plan.rules.size)
        : null;
      positions.push(target);
      memoryDistractors.push(distractor);
      ctx.phase('rememberSquare', { n: i + 1, total: plan.length });
      ctx.hint('');
      memoryExposureMs.push(await showMemory(ctx, plan, target, distractor));
      await ctx.blank(plan.blankMs);
    }
    const answer = await UI.recall(ctx, plan.length, {
      side: plan.rules.size,
      repeats: true,
      phase: recallPhase(plan.rules),
    });
    return {
      condition: plan.condition,
      rules: { ...plan.rules },
      targetColor: ctx.session.targetColor,
      distractorColor: ctx.session.distractorColor,
      positions,
      memoryDistractors,
      memoryExposureMs,
      judgments,
      responses: answer.value,
      rtMs: answer.rtMs,
    };
  }
  const validTime = (value) => G.finite(value) && value >= 0;
  function validateTrial(trial) {
    const length = Number(trial?.condition),
      rules = R.readRules(trial?.rules);
    const validCell = (value) => R.validCell(value, rules.size);
    const responses = ['top-bottom', 'left-right', 'neither', null];
    if (
      typeof trial.condition !== 'string' ||
      !Number.isSafeInteger(length) ||
      length < 1 ||
      !colorNames.includes(trial.targetColor) ||
      !colorNames.includes(trial.distractorColor) ||
      trial.targetColor === trial.distractorColor ||
      ![trial.positions, trial.responses].every(
        (values) => Array.isArray(values) && values.length === length && values.every(validCell),
      ) ||
      !Array.isArray(trial.memoryDistractors) ||
      trial.memoryDistractors.length !== length ||
      !Array.isArray(trial.memoryExposureMs) ||
      trial.memoryExposureMs.length !== length ||
      !trial.memoryExposureMs.every(validTime) ||
      !Array.isArray(trial.judgments) ||
      trial.judgments.length !== length ||
      !validTime(trial.rtMs)
    )
      throw Error('trial');
    if (
      !trial.memoryDistractors.every((value, i) =>
        rules.sequenceInterference
          ? validCell(value) && value !== trial.positions[i]
          : value === null,
      )
    )
      throw Error('memory distractors');
    const judgments = trial.judgments.map((judgment) => {
      if (
        !judgment ||
        !Array.isArray(judgment.frames) ||
        !(rules.flashCount === 'random'
          ? R.COUNTS.includes(judgment.frames.length)
          : judgment.frames.length === rules.flashCount) ||
        !responses.includes(judgment.response) ||
        typeof judgment.timedOut !== 'boolean' ||
        judgment.timedOut !== (judgment.response === null) ||
        !validTime(judgment.rtMs)
      )
        throw Error('judgment');
      const frames = judgment.frames.map((frame) => {
        if (
          !frame ||
          !validCell(frame.target) ||
          !validTime(frame.exposureMs) ||
          !validTime(frame.gapMs) ||
          (rules.symmetryInterference
            ? !validCell(frame.distractor) || frame.distractor === frame.target
            : frame.distractor !== null)
        )
          throw Error('flash');
        return {
          target: frame.target,
          distractor: frame.distractor,
          exposureMs: frame.exposureMs,
          gapMs: frame.gapMs,
        };
      });
      if (
        new Set(frames.map((frame) => frame.target)).size !== frames.length ||
        (rules.symmetryInterference &&
          new Set(frames.map((frame) => frame.distractor)).size !== frames.length)
      )
        throw Error('pattern union');
      return {
        frames,
        response: judgment.response,
        rtMs: judgment.rtMs,
        timedOut: judgment.timedOut,
      };
    });
    return {
      condition: trial.condition,
      rules,
      targetColor: trial.targetColor,
      distractorColor: trial.distractorColor,
      positions: [...trial.positions],
      responses: [...trial.responses],
      memoryDistractors: [...trial.memoryDistractors],
      memoryExposureMs: [...trial.memoryExposureMs],
      judgments,
      rtMs: trial.rtMs,
    };
  }
  function validateContext(trial, plan) {
    const close = (actual, expected) => Math.abs(actual - expected) <= 125;
    if (
      trial.condition !== plan.condition ||
      !R.sameRules(trial.rules, plan.rules) ||
      trial.memoryExposureMs.some((ms) => !close(ms, plan.memoryMs)) ||
      trial.judgments.some(
        (j) =>
          (j.timedOut ? j.rtMs < plan.decisionMs : j.rtMs >= plan.decisionMs) ||
          j.frames.some(
            (frame) => !close(frame.exposureMs, plan.flashMs) || !close(frame.gapMs, plan.gapMs),
          ),
      )
    )
      throw Error('level parameters');
  }
  const recallCorrect = (trial) =>
    R.expected(trial.positions, trial.rules).reduce(
      (count, position, i) => count + (position === trial.responses[i] ? 1 : 0),
      0,
    );
  const judgmentsCorrect = (trial) =>
    trial.judgments.filter((j) =>
      R.accepts(
        j.frames.map((frame) => frame.target),
        j.response,
        trial.rules.size,
      ),
    ).length;
  const passes = (trial) =>
    recallCorrect(trial) === trial.positions.length &&
    judgmentsCorrect(trial) === trial.judgments.length;
  function feedback(ctx, trial) {
    ctx.phase('recallFeedback', { n: recallCorrect(trial), total: trial.positions.length });
    ctx.hint('judgmentFeedback', { n: judgmentsCorrect(trial), total: trial.judgments.length });
    const cells = UI.grid(ctx, false, trial.rules.size),
      expected = R.expected(trial.positions, trial.rules);
    const strip = UI.sequenceStrip(
      ctx,
      cells,
      expected,
      (index) => {
        cells.forEach((cell) => {
          cell.textContent = '';
          cell.classList.remove('chosen', 'correct', 'wrong');
        });
        const correct = cells[expected[index]];
        correct.textContent = '●';
        correct.classList.add('chosen', 'correct');
        if (trial.responses[index] !== expected[index]) {
          const wrong = cells[trial.responses[index]];
          wrong.textContent = '×';
          wrong.classList.add('wrong');
        }
      },
      trial.responses,
    );
    strip.sync();
    const firstWrong = expected.findIndex((position, i) => trial.responses[i] !== position);
    strip.select(firstWrong < 0 ? 0 : firstWrong);
  }
  G.init({
    slug: 'symmetry-span-plus-plus',
    strings,
    getRules: () => ({ ...settings }),
    changeSettings,
    createSession() {
      const [targetColor, distractorColor] = G.shuffle(colorNames);
      return Object.freeze({ targetColor, distractorColor });
    },
    beforeRun,
    levelPlan: R.levelPlan,
    run,
    validateTrial,
    validateContext,
    feedback,
    describeJudgment(ctx, item, trial) {
      const size = trial.rules.size,
        positions = item.frames.map((frame) => frame.target),
        expected = ['top-bottom', 'left-right', 'neither'].filter((axis) =>
          R.accepts(positions, axis, size),
        ),
        label = (axis) =>
          ({ 'top-bottom': 'topBottom', 'left-right': 'leftRight', neither: 'asymmetric' })[axis];
      return {
        correct: expected.includes(item.response),
        answer: item.timedOut ? 'reviewTimeout' : label(item.response),
        expected: expected.map(label),
        drawing() {
          const drawing = ctx.svg('svg', { viewBox: '0 0 320 320', 'aria-hidden': 'true' });
          for (let index = 0; index < size * size; index++) {
            const step = positions.indexOf(index),
              cellSize = 288 / size,
              x = 16 + (index % size) * cellSize,
              y = 16 + Math.floor(index / size) * cellSize;
            drawing.append(
              ctx.svg('rect', {
                x,
                y,
                width: cellSize - 3,
                height: cellSize - 3,
                rx: 4,
                fill: step < 0 ? '#eeecf3' : colors[trial.targetColor],
              }),
            );
            if (step >= 0) {
              const number = ctx.svg('text', {
                x: x + (cellSize - 3) / 2,
                y: y + cellSize / 2,
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
                'font-size': 24,
                fill: ['yellow', 'pink'].includes(trial.targetColor) ? '#30313b' : '#fff',
              });
              number.textContent = String(step + 1);
              drawing.append(number);
            }
          }
          return drawing;
        },
      };
    },

    validateSession(trials, meta) {
      if (!meta || meta.rulesVersion !== VERSION) throw Error('session rules');
      R.readRules(meta.rules);
      if (
        trials.some(
          (trial) =>
            !R.sameRules(trial.rules, meta.rules) ||
            trial.targetColor !== trials[0].targetColor ||
            trial.distractorColor !== trials[0].distractorColor,
        )
      )
        throw Error('session color');
    },
    passes,

    preview(rules) {
      const size = rules.size,
        step = 96 / size;
      const lines = Array.from(
        { length: size - 1 },
        (_, i) => `M${32 + (i + 1) * step} 7v96M32 ${7 + (i + 1) * step}h96`,
      ).join('');
      const highlights = [0, size - 1, (size - 1) * size + size / 2 - 1]
        .map(
          (cell, i) =>
            `<rect x="${35 + (cell % size) * step}" y="${10 + Math.floor(cell / size) * step}" width="${step - 6}" height="${step - 6}" rx="2" opacity="${[1, 0.35, 0.65][i]}"/>`,
        )
        .join('');
      return `<g fill="none" stroke="currentColor" opacity=".3"><rect x="32" y="7" width="96" height="96" rx="8"/><path d="${lines}"/></g><g fill="currentColor">${highlights}</g>`;
    },
  });
}
