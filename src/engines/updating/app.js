import { CognitiveGame } from '../progressive.js';
import { UpdatingMemoryModel } from './model.js';
import { currentGame } from '../../catalog.js';
export function mountGame() {
  const setup = currentGame().config,
    G = CognitiveGame;
  const model = UpdatingMemoryModel.create(setup.kind);
  const spatial = setup.kind === 'spatial',
    running = setup.kind === 'running';
  const VERSION = currentGame().version;
  const SETTINGS_KEY = `${setup.slug}.settings.v1`;
  let tail = 2;
  if (running) {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (Number.isInteger(saved?.tail) && saved.tail >= 1 && saved.tail <= 4) tail = saved.tail;
    } catch {}
    document.querySelectorAll('[name="tail"]').forEach((input) => {
      input.checked = Number(input.value) === tail;
    });
  }
  const rules = () => (running ? { tail } : {});
  const strings = {
    title: setup.title,
    intro: spatial
      ? 'game.remember-the-starting-positions-and-move-them-in-your-mind'
      : running
        ? 'game.remember-the-latest-digits-in-each-stream'
        : 'game.remember-the-numbers-and-update-them-by-1-or-1',
    instructions: spatial
      ? 'game.remember-each-board-s-starting-position-once-the-dots-disappear-m'
      : running
        ? 'game.digits-appear-in-interleaved-streams-keep-only-the-chosen-number-'
        : 'game.remember-the-number-in-each-box-once-hidden-mentally-apply-1-or-1',
    progressionHelp: 'rules.updating-progression',
    rememberChannel: 'game.starting-position-value',
    rememberNumber: 'game.remember-the-number-value',
    updateChannel: 'game.update-mentally-value',
    watchChannel: 'game.keep-the-latest-digits-value',
    recall: spatial
      ? 'game.select-the-final-positions'
      : running
        ? 'game.recall-the-latest-digits-in-each-stream'
        : 'game.enter-the-final-numbers',
    channel: 'game.channel-value',
    channelEmpty: 'game.channel-value-unanswered',
    channelFilled: 'game.channel-value-answered',
    channelCorrect: 'game.channel-value-correct',
    channelWrong: 'game.channel-value-incorrect',
    recallProgress: 'game.value-value-channels-answered',
    previousPage: 'game.previous',
    nextPage: 'game.next',
    pageNumber: 'game.page-value-value',
    inputAnswer: 'game.channel-value-final-number',
    inputTail: 'game.channel-value-last-value-digits-in-order',
    spatialReview: 'game.correct-row-value-column-value-your-choice-row-value-column-value',
    spatialReviewHint: 'game.filled-dot-correct-position-outline-your-choice',
    correctAnswer: 'ui.correct',
    yourAnswer: 'game.yours',
    feedback: 'game.value-value-channels-correct',
    tailCount: 'game.digits-per-stream',
    tailChoice: 'game.last-value',
    toggleSign: 'game.toggle-sign',

    up: 'game.up',
    right: 'game.right',
    down: 'game.down',
    left: 'game.left',
    plusOne: 'game.add-one',
    minusOne: 'game.subtract-one',
  };
  function channelName(index) {
    let result = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
      result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    return result;
  }
  function panelLayout(stage, reservedHeight = 0, answers = false) {
    const style = getComputedStyle(stage);
    const size = (name) => parseFloat(style.getPropertyValue(`--updating-${name}`));
    const scale = answers ? stage.getBoundingClientRect().width / stage.clientWidth : 1,
      inset = size('inset'),
      gap = size('gap'),
      minWidth = answers ? (spatial ? 150 : 136) / scale : size('min-width'),
      minHeight = answers ? (spatial ? 174 : 104) / scale : size('min-height');
    const columns = Math.max(
      1,
      Math.floor((stage.clientWidth - inset * 2 + gap) / (minWidth + gap)),
    );
    const rows = Math.max(
      1,
      Math.floor((stage.clientHeight - inset * 2 - reservedHeight + gap) / (minHeight + gap)),
    );
    return { columns, rows, capacity: columns * rows, reservedHeight };
  }
  function miniGrid(ctx, position = null) {
    const grid = ctx.node('div', null, null, 'updating-mini-grid');
    if (position !== null) {
      grid.setAttribute('role', 'img');
      ctx.I.label(grid, 'cell', { row: Math.floor(position / 3) + 1, col: (position % 3) + 1 });
    } else grid.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 9; i++) {
      const square = ctx.node('span', null, null, 'updating-square');
      if (position === i) square.append(ctx.node('span', null, null, 'updating-dot'));
      grid.append(square);
    }
    return grid;
  }
  function makeBoard(ctx, layout = ctx.session.panelLayout) {
    const board = ctx.node('div', null, null, 'updating-board');
    board.style.setProperty('--updating-columns', layout.columns);
    board.style.setProperty('--updating-rows', layout.rows);
    board.style.setProperty('--updating-bottom', `${layout.reservedHeight}px`);
    return board;
  }
  function makeCard(ctx, index, className = '') {
    const card = ctx.node('div', null, null, `updating-card ${className}`);
    card.setAttribute('role', 'group');
    ctx.I.label(card, 'channel', { name: channelName(index) });
    const name = ctx.node('span', null, null, 'channel-name');
    name.textContent = channelName(index);
    card.append(name);
    return card;
  }
  function showPanel(ctx, count, channel, value, phase) {
    const { capacity } = ctx.session.panelLayout;
    const board = makeBoard(ctx),
      start = Math.floor(channel / capacity) * capacity;
    for (let index = start; index < Math.min(count, start + capacity); index++) {
      const active = index === channel && phase !== 'blank';
      const card = makeCard(ctx, index, active ? 'active' : 'inactive');
      if (spatial && phase !== 'event') card.append(miniGrid(ctx, active ? value : null));
      else {
        const content = ctx.node('div', null, null, 'updating-value');
        if (active) {
          if (spatial) {
            content.textContent = ['↑', '→', '↓', '←'][value];
            content.classList.add('updating-arrow');
            ctx.I.label(content, ['up', 'right', 'down', 'left'][value]);
          } else {
            content.textContent =
              !running && phase === 'event' ? (value === 1 ? '+1' : '−1') : String(value);
            if (!running && phase === 'event')
              ctx.I.label(content, value === 1 ? 'plusOne' : 'minusOne');
          }
        }
        card.append(content);
      }
      board.append(card);
    }
    ctx.stage.replaceChildren(board);
  }
  function pageControls(ctx, pages, change, compact = false) {
    const root = ctx.node('div', null, null, 'updating-pagination');
    const previous = ctx.button('previousPage'),
      next = ctx.button('nextPage'),
      label = ctx.node('span');
    label.setAttribute('role', 'status');
    root.append(previous, label, next);
    if (compact) {
      [previous, next].forEach((button, index) => {
        ctx.I.label(button, index ? 'nextPage' : 'previousPage');
        delete button.dataset.l10n;
        delete button.dataset.values;
        button.textContent = index ? '→' : '←';
      });
    }
    root.hidden = pages <= 1;
    let page = 0;
    previous.addEventListener('click', () => {
      if (page > 0) change(page - 1);
    });
    next.addEventListener('click', () => {
      if (page + 1 < pages) change(page + 1);
    });
    return {
      root,
      update(value) {
        page = value;
        previous.disabled = page === 0;
        next.disabled = page + 1 >= pages;
        if (compact) {
          label.textContent = `${page + 1} / ${pages}`;
          ctx.I.label(label, 'pageNumber', { n: page + 1, total: pages });
        } else ctx.I.text(label, 'pageNumber', { n: page + 1, total: pages });
      },
    };
  }
  async function recall(ctx, plan) {
    ctx.phase('recall');
    const responses = Array.from({ length: plan.channels }, () => []),
      numberText = Array(plan.channels).fill('');
    const layout = panelLayout(ctx.stage, 0, true),
      { capacity } = layout,
      pages = Math.ceil(plan.channels / capacity);
    const visible = new Map(),
      submit = ctx.button('submit', null, true);
    let page = 0,
      revision = 0;
    const pager = pageControls(ctx, pages, drawPage);
    ctx.toolbar.replaceChildren(pager.root, submit);
    function update() {
      const completed = responses.filter((row) => row.length === plan.tail).length;
      ctx.hint('recallProgress', { n: completed, total: plan.channels });
      submit.disabled = completed !== plan.channels;
      for (const [index, entry] of visible) {
        const filled = responses[index].length === plan.tail;
        entry.card.classList.toggle('filled', filled);
        ctx.I.label(entry.card, filled ? 'channelFilled' : 'channelEmpty', {
          name: channelName(index),
        });
        if (spatial)
          entry.buttons.forEach((button, value) => {
            const chosen = responses[index][0] === value;
            button.setAttribute('aria-pressed', String(chosen));
            button.replaceChildren();
            if (chosen) button.append(ctx.node('span', null, null, 'updating-dot'));
          });
        else if (entry.input.value !== numberText[index]) entry.input.value = numberText[index];
      }
    }
    function drawPage(nextPage) {
      page = nextPage;
      revision++;
      visible.clear();
      const board = makeBoard(ctx, layout),
        start = page * capacity;
      for (let index = start; index < Math.min(plan.channels, start + capacity); index++) {
        const card = makeCard(ctx, index, 'updating-answer-card'),
          entry = { card };
        card.classList.toggle('spatial-answer', spatial);
        if (spatial) {
          const grid = ctx.node('div', null, null, 'updating-mini-grid updating-pick-grid');
          entry.buttons = Array.from({ length: 9 }, (_, value) => {
            const button = ctx.node('button');
            button.type = 'button';
            button.dataset.channel = index;
            button.dataset.cell = value;
            ctx.I.label(button, 'cell', { row: Math.floor(value / 3) + 1, col: (value % 3) + 1 });
            grid.append(button);
            return button;
          });
          card.append(grid);
        } else {
          const field = ctx.node('div', null, null, 'updating-input-row'),
            input = ctx.node('input');
          input.type = 'text';
          input.inputMode = 'numeric';
          input.autocomplete = 'off';
          input.spellcheck = false;
          input.dataset.channel = index;
          input.value = numberText[index];
          input.placeholder = running ? '·'.repeat(plan.tail) : '—';
          ctx.I.label(input, running ? 'inputTail' : 'inputAnswer', {
            name: channelName(index),
            n: plan.tail,
          });
          field.append(input);
          entry.input = input;
          if (!running) {
            const sign = ctx.node('button', null, null, 'updating-sign');
            sign.type = 'button';
            sign.textContent = '±';
            sign.dataset.channel = index;
            ctx.I.label(sign, 'toggleSign');
            field.append(sign);
          }
          card.append(field);
        }
        visible.set(index, entry);
        board.append(card);
      }
      ctx.stage.replaceChildren(board);
      pager.update(page);
      update();
    }
    function enterNumber(index, value) {
      const raw = value
        .replace(/−/g, '-')
        .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
      const digits = raw.replace(/\D/g, '').slice(0, running ? plan.tail : 2);
      const text = !running && raw.startsWith('-') ? `-${digits}` : digits;
      numberText[index] = text;
      responses[index] = running
        ? [...text].map(Number)
        : /^-?\d{1,2}$/.test(text)
          ? [Number(text)]
          : [];
      revision++;
      update();
    }
    drawPage(0);
    const result = await ctx.response((done) => {
      const cleanups = [];
      const listen = (target, type, handler) => {
        target.addEventListener(type, handler);
        cleanups.push(() => target.removeEventListener(type, handler));
      };
      let pending = null;
      listen(ctx.stage, 'pointerdown', (event) => {
        const button =
          event.target instanceof Element ? event.target.closest('button[data-channel]') : null;
        pending =
          event.isPrimary && event.button === 0 && button && !button.disabled
            ? { button, revision, id: event.pointerId }
            : null;
      });
      listen(ctx.stage, 'pointercancel', () => {
        pending = null;
      });
      listen(ctx.stage, 'click', (event) => {
        const button =
          event.target instanceof Element ? event.target.closest('button[data-channel]') : null;
        if (!button || !ctx.stage.contains(button)) return;
        if (event.detail > 0 || event.pointerType) {
          const start = pending;
          pending = null;
          if (
            !start ||
            start.button !== button ||
            start.revision !== revision ||
            (event.pointerId > 0 && event.pointerId !== start.id)
          )
            return;
        }
        const index = Number(button.dataset.channel);
        if (spatial) {
          responses[index] = [Number(button.dataset.cell)];
          revision++;
          update();
        } else {
          const value = numberText[index];
          enterNumber(index, value.startsWith('-') ? value.slice(1) : `-${value}`);
          visible.get(index).input.focus({ preventScroll: true });
        }
      });
      const edit = (event) => {
        if (
          event.isComposing ||
          !(event.target instanceof HTMLInputElement) ||
          !event.target.hasAttribute('data-channel')
        )
          return;
        enterNumber(Number(event.target.dataset.channel), event.target.value);
      };
      listen(ctx.stage, 'input', edit);
      listen(ctx.stage, 'compositionend', edit);
      listen(ctx.stage, 'keydown', (event) => {
        if (
          event.key !== 'Enter' ||
          event.repeat ||
          event.isComposing ||
          !(event.target instanceof HTMLInputElement)
        )
          return;
        event.preventDefault();
        const next = Number(event.target.dataset.channel) + 1;
        if (next >= plan.channels) {
          submit.focus();
          return;
        }
        if (Math.floor(next / capacity) !== page) drawPage(Math.floor(next / capacity));
        const input = visible.get(next).input;
        input.focus({ preventScroll: true });
        input.select();
      });
      listen(submit, 'click', () => {
        if (responses.every((row) => row.length === plan.tail))
          done(responses.map((row) => [...row]));
      });
      return () => cleanups.forEach((cleanup) => cleanup());
    });
    ctx.toolbar.replaceChildren();
    return result;
  }
  async function run(ctx, plan) {
    const trial = model.generate(plan),
      initialExposureMs = [];
    for (let channel = 0; channel < trial.initial.length; channel++) {
      ctx.phase(spatial ? 'rememberChannel' : 'rememberNumber', { name: channelName(channel) });
      showPanel(ctx, plan.channels, channel, trial.initial[channel], 'initial');
      initialExposureMs.push(await ctx.hold(plan.initialMs, { critical: true }));
      showPanel(ctx, plan.channels, channel, null, 'blank');
      await ctx.hold(plan.gapMs, { critical: true });
    }
    if (!running) await ctx.blank(500);
    for (const event of trial.events) {
      ctx.phase(running ? 'watchChannel' : 'updateChannel', { name: channelName(event.channel) });
      ctx.hint('');
      showPanel(ctx, plan.channels, event.channel, event.value, 'event');
      event.exposureMs = await ctx.hold(plan.eventMs, { critical: true });
      showPanel(ctx, plan.channels, event.channel, null, 'blank');
      await ctx.hold(plan.gapMs, { critical: true });
    }
    await ctx.blank(350);
    const answer = await recall(ctx, plan);
    return { ...trial, initialExposureMs, responses: answer.value, rtMs: answer.rtMs };
  }
  function feedback(ctx, trial) {
    const expected = model.expected(trial),
      correct = expected.map((row, i) => row.every((value, j) => value === trial.responses[i][j]));
    ctx.phase('feedback', { n: correct.filter(Boolean).length, total: trial.channels });
    ctx.hint(spatial && correct.includes(false) ? 'spatialReviewHint' : '');
    const scale = ctx.stage.getBoundingClientRect().width / ctx.stage.clientWidth;
    const initialLayout = panelLayout(ctx.stage, 0, true);
    const layout =
      trial.channels > initialLayout.capacity
        ? panelLayout(ctx.stage, 56 / scale, true)
        : initialLayout;
    const root = ctx.node('div', null, null, 'updating-review-area'),
      pages = Math.ceil(trial.channels / layout.capacity);
    const pager = pageControls(ctx, pages, drawPage, true);
    pager.root.classList.add('updating-review-pagination');
    let board;
    function drawPage(page) {
      board?.remove();
      board = makeBoard(ctx, layout);
      const start = page * layout.capacity;
      for (let index = start; index < Math.min(trial.channels, start + layout.capacity); index++) {
        const card = makeCard(ctx, index, correct[index] ? 'correct' : 'wrong');
        ctx.I.label(card, correct[index] ? 'channelCorrect' : 'channelWrong', {
          name: channelName(index),
        });
        const mark = ctx.node('span', null, null, 'updating-result-mark');
        mark.textContent = correct[index] ? '✓' : '×';
        mark.setAttribute('aria-hidden', 'true');
        card.querySelector('.channel-name').append(mark);
        if (spatial) {
          const value = expected[index][0],
            answer = trial.responses[index][0],
            grid = miniGrid(ctx, value);
          ctx.I.label(grid, 'spatialReview', {
            row: Math.floor(value / 3) + 1,
            col: (value % 3) + 1,
            answerRow: Math.floor(answer / 3) + 1,
            answerCol: (answer % 3) + 1,
          });
          if (!correct[index])
            grid.children[answer].append(
              ctx.node('span', null, null, 'updating-dot updating-wrong-dot'),
            );
          card.append(grid);
        } else if (correct[index]) {
          const value = ctx.node('div', null, null, 'updating-final-value');
          value.textContent = expected[index].join('').replace('-', '−');
          card.append(value);
        } else {
          const values = ctx.node('div', null, null, 'updating-results');
          [expected[index], trial.responses[index]].forEach((row, i) => {
            const line = ctx.node('div', null, null, 'updating-result-line'),
              label = ctx.node('span'),
              value = ctx.node('strong');
            line.setAttribute('role', 'group');
            ctx.I.label(line, i ? 'yourAnswer' : 'correctAnswer');
            label.textContent = i ? '×' : '✓';
            label.setAttribute('aria-hidden', 'true');
            value.textContent = row.join('').replace('-', '−');
            line.append(label, value);
            values.append(line);
          });
          card.append(values);
        }
        board.append(card);
      }
      root.prepend(board);
      pager.update(page);
    }
    root.append(pager.root);
    ctx.stage.replaceChildren(root);
    const firstWrong = correct.indexOf(false);
    drawPage(Math.floor(Math.max(0, firstWrong) / layout.capacity));
  }
  const config = {
    slug: setup.slug,
    version: VERSION,
    strings,
    ...model,
    run,
    feedback,

    createSession: () => ({ panelLayout: panelLayout(document.getElementById('stage')) }),
    validateSession(_trials, meta) {
      if (
        !meta ||
        meta.rulesVersion !== VERSION ||
        !meta.rules ||
        (running
          ? Object.keys(meta.rules).length !== 1 ||
            !Number.isInteger(meta.rules.tail) ||
            meta.rules.tail < 1 ||
            meta.rules.tail > 4
          : Object.keys(meta.rules).length !== 0)
      )
        throw Error('session rules');
    },

    preview: setup.preview,
  };
  if (running) {
    config.getRules = rules;
    config.changeSettings = () => {
      tail = Number(document.querySelector('[name="tail"]:checked').value);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ tail }));
      } catch {}
    };
  }
  G.init(config);
}
