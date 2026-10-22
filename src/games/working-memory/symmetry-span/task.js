import { CognitiveGame } from '../../../engines/progressive.js';
import { SpanUI } from '../../../engines/span/ui.js';
export function mountGame() {
  const G = CognitiveGame;
  const { grid, sequenceStrip, recall } = SpanUI;
  const DEADLINE = 4000,
    EXPOSURE = 700;
  const strings = {
    title: 'catalog.symmetry-span-2',
    intro: 'game.judge-symmetry-while-remembering-highlighted-locations',
    instructions: 'game.judge-symmetry-then-remember-each-highlighted-square-recall-the-s',
    progressionHelp: 'game.start-with-1-square-and-add-one-each-level-without-a-cap-beyond-1',
    judge: 'game.symmetric-left-to-right',
    symmetric: 'game.symmetric',
    asymmetric: 'game.not-symmetric',
    judgeHint: 'game.symmetric-not-symmetric',
    rememberSquare: 'game.remember-the-location-value-value',
    recallOrder: 'game.recall-the-highlighted-sequence',
    recallFeedback: 'game.value-value-in-the-correct-position',
    judgmentFeedback: 'game.value-value-symmetry-decisions-correct',
    sequenceStep: 'game.step-value-row-value-column-value',
    sequenceReview: 'game.sequence-review',
  };
  function levelPlan(level) {
    return {
      level,
      condition: String(level),
      length: level,
      judgmentDeadlineMs: DEADLINE,
      exposureMs: EXPOSURE,
    };
  }
  function pattern(symmetric) {
    const half = G.shuffle(Array.from({ length: 8 }, (_, i) => i < 4));
    const cells = Array(16).fill(false);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 2; col++) {
        const value = half[row * 2 + col];
        cells[row * 4 + col] = value;
        cells[row * 4 + 3 - col] = value;
      }
    if (!symmetric) {
      const right = Array.from({ length: 8 }, (_, i) => Math.floor(i / 2) * 4 + 2 + (i % 2));
      const black = G.shuffle(right.filter((i) => cells[i]))[0],
        white = G.shuffle(right.filter((i) => !cells[i]))[0];
      cells[black] = false;
      cells[white] = true;
    }
    return cells;
  }
  function isSymmetric(cells) {
    const side = Math.sqrt(cells.length);
    return cells.every((v, i) => v === cells[Math.floor(i / side) * side + side - 1 - (i % side)]);
  }
  function drawPattern(ctx, cells) {
    const s = ctx.svg('svg', { viewBox: '0 0 640 480', 'aria-hidden': 'true' });
    cells.forEach((filled, i) =>
      s.append(
        ctx.svg('rect', {
          x: 170 + (i % 4) * 75,
          y: 90 + Math.floor(i / 4) * 75,
          width: 75,
          height: 75,
          fill: filled ? '#45404f' : '#fff',
          stroke: '#dcd8e4',
          'stroke-width': 1,
        }),
      ),
    );
    return s;
  }
  async function judge(ctx, cells) {
    ctx.phase('judge');
    ctx.hint('judgeHint');
    ctx.stage.replaceChildren(drawPattern(ctx, cells));
    const yes = ctx.button('symmetric'),
      no = ctx.button('asymmetric');
    ctx.toolbar.replaceChildren(yes, no);
    const answer = await ctx.response((done) => {
      const start = performance.now();
      const respond = (value) => {
        if (performance.now() - start >= 150) done(value);
      };
      const yesClick = () => respond(true),
        noClick = () => respond(false);
      function key(e) {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
        if (
          e.target instanceof Element &&
          (e.target.closest('input, textarea, select, [data-language-switch], #action, #help') ||
            (e.target instanceof HTMLElement && e.target.isContentEditable))
        )
          return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          respond(e.key === 'ArrowLeft');
        }
      }
      yes.addEventListener('click', yesClick);
      no.addEventListener('click', noClick);
      document.addEventListener('keydown', key);
      return () => {
        yes.removeEventListener('click', yesClick);
        no.removeEventListener('click', noClick);
        document.removeEventListener('keydown', key);
      };
    }, DEADLINE);
    ctx.toolbar.replaceChildren();
    return answer;
  }
  const recallCorrect = (t) =>
    t.positions.reduce((sum, p, i) => sum + (t.responses[i] === p ? 1 : 0), 0);
  const judgmentsCorrect = (t) =>
    t.judgments.filter((j) => j.response === isSymmetric(j.cells)).length;
  async function run(ctx, plan) {
    const length = plan.length,
      firstPositions = ctx.shuffle(Array.from({ length: 16 }, (_, i) => i)),
      positions = [],
      judgments = [];
    for (let i = 0; i < length; i++) {
      if (i < 16) positions.push(firstPositions[i]);
      else {
        let position = Math.floor(Math.random() * 15);
        if (position >= positions.at(-1)) position++;
        positions.push(position);
      }
      const cells = pattern(Math.random() < 0.5);
      const answer = await judge(ctx, cells);
      await ctx.blank(250);
      ctx.phase('rememberSquare', { n: i + 1, total: length });
      const squares = grid(ctx);
      squares[positions[i]].classList.add('lit');
      const exposureMs = await ctx.hold(EXPOSURE, { critical: true });
      judgments.push({
        cells,
        response: answer.timedOut ? null : answer.value,
        rtMs: answer.rtMs,
        timedOut: answer.timedOut,
        exposureMs,
      });
      await ctx.blank(250);
    }
    const answer = await recall(ctx, length);
    return {
      condition: plan.condition,
      positions,
      judgments,
      responses: answer.value,
      rtMs: answer.rtMs,
    };
  }
  function validateTrial(t) {
    const n = Number(t?.condition);
    if (
      typeof t?.condition !== 'string' ||
      !Number.isSafeInteger(n) ||
      n < 1 ||
      !Array.isArray(t.positions) ||
      t.positions.length !== n ||
      !t.positions.every((v) => G.integer(v, 0, 15)) ||
      !Array.isArray(t.responses) ||
      t.responses.length !== n ||
      !t.responses.every((v) => G.integer(v, 0, 15)) ||
      (n <= 16 && (new Set(t.positions).size !== n || new Set(t.responses).size !== n)) ||
      !Array.isArray(t.judgments) ||
      t.judgments.length !== n ||
      !G.finite(t.rtMs) ||
      t.rtMs < 0
    )
      throw Error('trial');
    const judgments = t.judgments.map((j) => {
      if (
        !j ||
        !Array.isArray(j.cells) ||
        j.cells.length !== 16 ||
        !j.cells.every((c) => typeof c === 'boolean') ||
        j.cells.filter(Boolean).length !== j.cells.length / 2 ||
        ![true, false, null].includes(j.response) ||
        typeof j.timedOut !== 'boolean' ||
        j.timedOut !== (j.response === null) ||
        ![j.rtMs, j.exposureMs].every((v) => G.finite(v) && v >= 0)
      )
        throw Error('judgment');
      return {
        cells: [...j.cells],
        response: j.response,
        rtMs: j.rtMs,
        timedOut: j.timedOut,
        exposureMs: j.exposureMs,
      };
    });
    return {
      condition: t.condition,
      positions: [...t.positions],
      responses: [...t.responses],
      rtMs: t.rtMs,
      judgments,
    };
  }
  const passes = (t) =>
    recallCorrect(t) === t.positions.length && judgmentsCorrect(t) === t.judgments.length;
  function validateContext(t, p) {
    if (
      t.condition !== p.condition ||
      t.judgments.some((j) => j.cells.length !== 16 || Math.abs(j.exposureMs - p.exposureMs) > 125)
    )
      throw Error('level parameters');
  }
  G.init({
    slug: 'symmetry-span',

    strings,

    preview:
      '<g fill="currentColor"><path d="M10 15h18v18H10zm36 0h18v18H46zM28 33h18v18H28zM10 51h18v18H10zm36 0h18v18H46z"/><rect x="106" y="66" width="22" height="22" rx="3"/></g><g stroke="currentColor" fill="none" opacity=".3"><rect x="83" y="19" width="70" height="70" rx="3"/><path d="M106 19v70m23-70v70M83 42h70M83 65h70"/></g>',
    levelPlan,
    run,
    validateTrial,
    passes,
    validateContext,
    describeJudgment(ctx, item) {
      const symmetric = isSymmetric(item.cells);
      return {
        correct: !item.timedOut && item.response === symmetric,
        answer: item.timedOut ? 'reviewTimeout' : item.response ? 'symmetric' : 'asymmetric',
        expected: [symmetric ? 'symmetric' : 'asymmetric'],
        drawing: drawPattern(ctx, item.cells),
      };
    },
    feedback(ctx, t) {
      ctx.phase('recallFeedback', { n: recallCorrect(t), total: t.positions.length });
      ctx.hint('judgmentFeedback', { n: judgmentsCorrect(t), total: t.judgments.length });
      const cells = grid(ctx);
      if (t.positions.length <= 16)
        t.positions.forEach((p, i) => {
          cells[p].textContent = String(i + 1);
          cells[p].classList.add('chosen', t.responses[i] === p ? 'correct' : 'wrong');
        });
      else {
        const strip = sequenceStrip(
          ctx,
          cells,
          t.positions,
          (index) => {
            cells.forEach((c) => {
              c.textContent = '';
              c.classList.remove('chosen', 'correct', 'wrong');
            });
            const correct = cells[t.positions[index]];
            correct.textContent = '●';
            correct.classList.add('chosen', 'correct');
            if (t.responses[index] !== t.positions[index]) {
              const wrong = cells[t.responses[index]];
              wrong.textContent = '×';
              wrong.classList.add('wrong');
            }
          },
          t.responses,
        );
        strip.sync();
        const firstWrong = t.positions.findIndex((p, i) => t.responses[i] !== p);
        strip.select(firstWrong < 0 ? 0 : firstWrong);
      }
    },
  });
}
