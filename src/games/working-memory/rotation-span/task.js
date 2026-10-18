import { currentGame } from '../../../catalog.js';
import { Core } from '../../../core/index.js';
import { GameText } from '../../../engines/span/i18n.js';
import { CognitiveGame } from '../../../engines/progressive.js';
export function mountGame() {
  const G = CognitiveGame;
  const VERSION = currentGame().version;
  const CHARACTERS = [...'2457QRPSFGJL@&%?'];
  const RECORDED_CHARACTERS = new Set([...CHARACTERS, ...'3BCDEKNZ']);
  const DEADLINE = 5000,
    EXPOSURE = 1000,
    GAP = 500,
    MIN_RESPONSE = 150;
  const ARROWS = Array.from({ length: 16 }, (_, i) => i);
  const directions = ['up', 'upRight', 'right', 'downRight', 'down', 'downLeft', 'left', 'upLeft'];
  const strings = {
    title: 'catalog.rotation-span',
    intro: 'rules.rotation-intro',
    instructions: 'rules.rotation-instructions',
    progressionHelp: 'game.start-with-1-arrow-and-add-one-per-level-without-a-cap-each-lette',
    judge: 'rules.judge-character',
    normal: 'game.normal',
    mirror: 'game.mirrored',
    judgeHint: 'game.normal-mirrored-5-s',
    rememberArrow: 'game.remember-the-arrow-value-value',
    recallArrows: 'game.select-the-arrows-in-order',
    recallFeedback: 'game.value-value-arrows-recalled-correctly',
    judgmentFeedback: 'game.value-value-letter-judgments-correct',
    correctArrow: 'game.correct-arrow',
    yourArrow: 'game.your-arrow',
    sequenceReview: 'game.selected-sequence',
    reviewCorrect: 'game.item-value-correct',
    reviewWrong: 'game.item-value-incorrect',
    arrowLabel: 'game.value-arrow-value',
    answerLabel: 'game.item-value-value',
    short: 'game.short',
    long: 'game.long',
    up: 'game.up',
    upRight: 'game.up-right',
    right: 'game.right',
    downRight: 'game.down-right',
    down: 'game.down',
    downLeft: 'game.down-left',
    left: 'game.left',
    upLeft: 'game.up-left',
  };
  ARROWS.forEach((id) => {
    const length = id % 2 ? 'long' : 'short',
      direction = directions[Math.floor(id / 2)];
    strings[`arrow${id}`] = () =>
      GameText.tr('arrowLabel', { length: GameText.tr(length), direction: GameText.tr(direction) });
    strings[`answer${id}`] = (values) =>
      GameText.tr('answerLabel', { ...values, arrow: GameText.tr(`arrow${id}`) });
  });
  function levelPlan(level) {
    if (!Number.isSafeInteger(level) || level < 1) throw Error('level');
    return {
      level,
      condition: String(level),
      length: level,
      judgmentDeadlineMs: DEADLINE,
      exposureMs: EXPOSURE,
    };
  }
  function drawArrow(ctx, id) {
    const svg = ctx.svg('svg', { viewBox: '-145 -145 290 290', 'aria-hidden': 'true' });
    const length = id % 2 ? 224 : 112,
      angle = Math.floor(id / 2) * 45 - 90;
    const group = ctx.svg('g', { transform: `rotate(${angle}) translate(${-length / 2} 0)` });
    group.append(
      ctx.svg('path', {
        d: `M0 0H${length}M${length - 26} -26L${length} 0L${length - 26} 26`,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 12,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    svg.append(group);
    return svg;
  }
  function drawLetter(ctx, item) {
    const svg = ctx.picture();
    svg.classList.add('rotation-letter');
    const glyph = ctx.svg('text', {
      x: 0,
      y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-family': 'Arial, sans-serif',
      'font-size': 160,
      'font-weight': 600,
      fill: 'currentColor',
      transform: `translate(320 240) rotate(${item.angle}) scale(${item.mirrored ? -1 : 1} 1)`,
    });
    glyph.textContent = item.letter;
    svg.append(glyph);
  }

  async function judge(ctx, item) {
    ctx.phase('judge');
    ctx.hint('judgeHint');
    drawLetter(ctx, item);
    const normal = ctx.button('normal'),
      mirror = ctx.button('mirror');
    normal.setAttribute('aria-keyshortcuts', 'ArrowLeft');
    mirror.setAttribute('aria-keyshortcuts', 'ArrowRight');
    ctx.toolbar.replaceChildren(normal, mirror);
    const answer = await ctx.response((done) => {
      const began = performance.now();
      const respond = (value) => {
        if (performance.now() - began >= MIN_RESPONSE) done(value);
      };
      const normalClick = () => respond(false),
        mirrorClick = () => respond(true);
      function key(event) {
        if (
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey ||
          event.isComposing
        )
          return;
        if (
          event.target instanceof Element &&
          (event.target.isContentEditable ||
            event.target.closest('input,textarea,select,a,summary,.language-switch,#action,#help'))
        )
          return;
        if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          respond(event.key === 'ArrowRight');
        }
      }
      normal.addEventListener('click', normalClick);
      mirror.addEventListener('click', mirrorClick);
      document.addEventListener('keydown', key);
      return () => {
        normal.removeEventListener('click', normalClick);
        mirror.removeEventListener('click', mirrorClick);
        document.removeEventListener('keydown', key);
      };
    }, DEADLINE);
    ctx.toolbar.replaceChildren();
    return answer;
  }
  async function recall(ctx, count) {
    ctx.phase('recallArrows');
    ctx.hint('selected', { n: 0, total: count });
    const grid = ctx.node('div', null, null, 'rotation-choices');
    ctx.stage.replaceChildren(grid);
    const strip = ctx.node('div', null, null, 'rotation-sequence');
    ctx.I.label(strip, 'sequenceReview');
    const undo = ctx.button('undo'),
      confirm = ctx.button('submit', null, true),
      values = [];
    undo.disabled = true;
    confirm.disabled = true;
    ctx.toolbar.replaceChildren(strip, undo, confirm);
    const buttons = ARROWS.map((id) => {
      const button = ctx.node('button', null, null, 'arrow-choice');
      button.type = 'button';
      button.dataset.arrow = String(id);
      ctx.I.label(button, `arrow${id}`);
      button.append(drawArrow(ctx, id));
      grid.append(button);
      return button;
    });
    const chips = [];
    function update() {
      buttons.forEach((button) => {
        button.disabled = values.length === count;
      });
      undo.disabled = !values.length;
      confirm.disabled = values.length !== count;
      ctx.hint('selected', { n: values.length, total: count });
      strip.scrollLeft = strip.scrollWidth;
    }
    const answer = await ctx.response((done) => {
      let revision = 0,
        pendingPointer = null;
      function pointerDown(event) {
        if (!event.isPrimary || event.button !== 0) return;
        const button =
          event.target instanceof Element ? event.target.closest('.arrow-choice') : null;
        pendingPointer =
          button && !button.disabled ? { button, revision, id: event.pointerId } : null;
      }
      function pointerCancel() {
        pendingPointer = null;
      }
      const handlers = buttons.map((button, id) => {
        const click = (event) => {
          if (event.detail > 0 || event.pointerType) {
            const pending = pendingPointer;
            pendingPointer = null;
            if (
              !pending ||
              pending.button !== button ||
              pending.revision !== revision ||
              (event.pointerId > 0 && event.pointerId !== pending.id)
            )
              return;
          }
          if (values.length >= count) return;
          values.push(id);
          revision++;
          const chip = ctx.node('div', null, null, 'rotation-answer');
          chip.setAttribute('role', 'img');
          ctx.I.label(chip, `answer${id}`, { n: values.length });
          const number = ctx.node('span');
          number.textContent = String(values.length);
          number.setAttribute('aria-hidden', 'true');
          chip.append(number, drawArrow(ctx, id));
          chips.push(chip);
          strip.append(chip);
          update();
        };
        button.addEventListener('click', click);
        return click;
      });
      const back = () => {
        if (!values.length) return;
        values.pop();
        chips.pop().remove();
        revision++;
        update();
      };
      const submit = () => {
        if (values.length === count) done([...values]);
      };
      grid.addEventListener('pointerdown', pointerDown);
      grid.addEventListener('pointercancel', pointerCancel);
      undo.addEventListener('click', back);
      confirm.addEventListener('click', submit);
      return () => {
        grid.removeEventListener('pointerdown', pointerDown);
        grid.removeEventListener('pointercancel', pointerCancel);
        buttons.forEach((button, id) => button.removeEventListener('click', handlers[id]));
        undo.removeEventListener('click', back);
        confirm.removeEventListener('click', submit);
      };
    });
    ctx.toolbar.replaceChildren();
    return answer;
  }
  async function run(ctx, plan) {
    const arrows = Core.sampleSequence(ARROWS, plan.length),
      judgments = [];
    for (let i = 0; i < arrows.length; i++) {
      const item = {
        letter: CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)],
        angle: (1 + Math.floor(Math.random() * 7)) * 45,
        mirrored: Math.random() < 0.5,
      };
      const answer = await judge(ctx, item);
      await ctx.blank(GAP);
      ctx.phase('rememberArrow', { n: i + 1, total: arrows.length });
      const arrow = drawArrow(ctx, arrows[i]);
      arrow.classList.add('rotation-memory');
      ctx.stage.replaceChildren(arrow);
      const exposureMs = await ctx.hold(EXPOSURE, { critical: true });
      judgments.push({
        ...item,
        response: answer.value,
        rtMs: answer.rtMs,
        timedOut: answer.timedOut,
        exposureMs,
      });
      await ctx.blank(GAP);
    }
    const answer = await recall(ctx, arrows.length);
    return {
      condition: plan.condition,
      arrows,
      judgments,
      responses: answer.value,
      rtMs: answer.rtMs,
    };
  }
  const recallCorrect = (trial) =>
    trial.arrows.reduce((sum, id, i) => sum + Number(id === trial.responses[i]), 0);
  const judgmentsCorrect = (trial) =>
    trial.judgments.filter((item) => !item.timedOut && item.response === item.mirrored).length;
  const passes = (trial) =>
    recallCorrect(trial) === trial.arrows.length &&
    judgmentsCorrect(trial) === trial.judgments.length;
  function validateTrial(trial) {
    const count = Number(trial?.condition);
    if (
      typeof trial?.condition !== 'string' ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      ![trial.arrows, trial.responses].every(
        (list) =>
          Array.isArray(list) && list.length === count && list.every((id) => G.integer(id, 0, 15)),
      ) ||
      !Array.isArray(trial.judgments) ||
      trial.judgments.length !== count ||
      !G.finite(trial.rtMs) ||
      trial.rtMs < 0
    )
      throw Error('trial');
    const judgments = trial.judgments.map((item) => {
      if (
        !item ||
        !RECORDED_CHARACTERS.has(item.letter) ||
        !G.integer(item.angle, 45, 315) ||
        item.angle % 45 !== 0 ||
        typeof item.mirrored !== 'boolean' ||
        ![true, false, null].includes(item.response) ||
        typeof item.timedOut !== 'boolean' ||
        item.timedOut !== (item.response === null) ||
        ![item.rtMs, item.exposureMs].every((value) => G.finite(value) && value >= 0) ||
        (item.timedOut ? item.rtMs < DEADLINE : item.rtMs < MIN_RESPONSE || item.rtMs >= DEADLINE)
      )
        throw Error('judgment');
      return {
        letter: item.letter,
        angle: item.angle,
        mirrored: item.mirrored,
        response: item.response,
        rtMs: item.rtMs,
        timedOut: item.timedOut,
        exposureMs: item.exposureMs,
      };
    });
    return {
      condition: trial.condition,
      arrows: [...trial.arrows],
      responses: [...trial.responses],
      rtMs: trial.rtMs,
      judgments,
    };
  }
  function validateContext(trial, plan) {
    if (
      trial.condition !== plan.condition ||
      trial.judgments.some((item) => Math.abs(item.exposureMs - plan.exposureMs) > 125)
    )
      throw Error('level parameters');
  }
  function feedback(ctx, trial) {
    ctx.phase('recallFeedback', { n: recallCorrect(trial), total: trial.arrows.length });
    ctx.hint('judgmentFeedback', { n: judgmentsCorrect(trial), total: trial.judgments.length });
    const root = ctx.node('div', null, null, 'rotation-feedback'),
      comparison = ctx.node('div', null, null, 'rotation-comparison');
    const expected = ctx.node('div', null, null, 'rotation-review'),
      actual = ctx.node('div', null, null, 'rotation-review');
    const steps = ctx.node('div', null, null, 'rotation-steps');
    const expectedLabel = ctx.node('p', 'correctArrow'),
      actualLabel = ctx.node('p', 'yourArrow');
    expected.append(expectedLabel);
    actual.append(actualLabel);
    comparison.append(expected, actual);
    root.append(comparison, steps);
    ctx.stage.replaceChildren(root);
    const buttons = trial.arrows.map((id, i) => {
      const correct = id === trial.responses[i],
        button = ctx.node('button', null, null, `sequence-step ${correct ? 'correct' : 'wrong'}`);
      button.type = 'button';
      button.textContent = String(i + 1);
      ctx.I.label(button, correct ? 'reviewCorrect' : 'reviewWrong', { n: i + 1 });
      button.addEventListener('click', () => select(i));
      steps.append(button);
      return button;
    });
    function select(index) {
      [
        [expected, expectedLabel, trial.arrows[index]],
        [actual, actualLabel, trial.responses[index]],
      ].forEach(([node, label, id]) => {
        const image = drawArrow(ctx, id);
        image.removeAttribute('aria-hidden');
        image.setAttribute('role', 'img');
        ctx.I.label(image, `arrow${id}`);
        node.replaceChildren(label, image);
      });
      actual.classList.toggle('wrong', trial.arrows[index] !== trial.responses[index]);
      buttons.forEach((button, i) => {
        button.classList.toggle('active', i === index);
        button.setAttribute('aria-pressed', String(i === index));
      });
      const button = buttons[index],
        left = button.offsetLeft;
      if (left < steps.scrollLeft) steps.scrollLeft = left;
      else if (left + button.offsetWidth > steps.scrollLeft + steps.clientWidth)
        steps.scrollLeft = left + button.offsetWidth - steps.clientWidth;
    }
    const firstWrong = trial.arrows.findIndex((id, i) => id !== trial.responses[i]);
    select(firstWrong < 0 ? 0 : firstWrong);
  }
  G.init({
    slug: 'rotation-span',
    version: VERSION,
    strings,
    levelPlan,
    run,
    validateTrial,
    validateContext,
    passes,
    feedback,

    validateSession(_trials, meta) {
      if (!meta || meta.rulesVersion !== VERSION) throw Error('session rules');
    },

    preview:
      '<g stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M24 74V25h34M24 47h25" transform="rotate(-25 40 50)"/><path d="M88 78l43-43m-18 0h18v18"/><path d="M99 92l22-22m-13 0h13v13" opacity=".45"/></g>',
  });
}
