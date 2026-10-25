function grid(ctx, interactive = false, side = 4) {
  const root = ctx.node('div', null, null, 'span-grid');
  const cells = [];
  root.style.setProperty('--grid-side', String(side));
  for (let i = 0; i < side * side; i++) {
    const cell = ctx.node(interactive ? 'button' : 'div', null, null, 'grid-cell');
    if (interactive) {
      cell.type = 'button';
      ctx.I.label(cell, 'cell', { row: Math.floor(i / side) + 1, col: (i % side) + 1 });
    } else cell.setAttribute('aria-hidden', 'true');
    cells.push(cell);
    root.append(cell);
  }
  ctx.stage.replaceChildren(root);
  return cells;
}
function sequenceStrip(ctx, cells, values, onSelect, responses = null) {
  const side = Math.sqrt(cells.length);
  cells[0].parentElement.classList.add('with-sequence');
  const strip = ctx.node('div', null, null, 'answer-sequence');
  ctx.I.label(strip, 'sequenceReview');
  ctx.stage.append(strip);
  let chosenButton = null;
  function select(index) {
    if (index < 0 || index >= values.length) return;
    chosenButton?.classList.remove('active');
    chosenButton?.setAttribute('aria-pressed', 'false');
    chosenButton = strip.children[index];
    chosenButton.classList.add('active');
    chosenButton.setAttribute('aria-pressed', 'true');
    onSelect(index);
    const left = chosenButton.offsetLeft,
      right = left + chosenButton.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (right > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = right - strip.clientWidth;
  }
  function sync() {
    while (strip.children.length > values.length) strip.lastElementChild.remove();
    for (let i = strip.children.length; i < values.length; i++) {
      const value = values[i],
        b = ctx.node('button', null, null, 'sequence-step');
      b.type = 'button';
      b.textContent = String(i + 1);
      b.setAttribute('aria-pressed', 'false');
      ctx.I.label(b, 'sequenceStep', {
        step: i + 1,
        row: Math.floor(value / side) + 1,
        col: (value % side) + 1,
      });
      if (responses) b.classList.add(responses[i] === value ? 'correct' : 'wrong');
      b.addEventListener('click', () => select(i));
      strip.append(b);
    }
  }
  return { sync, select };
}
async function recall(
  ctx,
  count,
  { side = 4, repeats = count > side * side, phase = 'recallOrder' } = {},
) {
  ctx.phase(phase);
  ctx.hint('selected', { n: 0, total: count });
  const cells = grid(ctx, true, side),
    answers = [];
  const strip = repeats
    ? sequenceStrip(ctx, cells, answers, (index) => {
        cells.forEach((c) => c.classList.remove('review-active'));
        cells[answers[index]].classList.add('review-active');
      })
    : null;
  const undo = ctx.button('undo'),
    confirm = ctx.button('submit', null, true);
  undo.disabled = true;
  confirm.disabled = true;
  ctx.toolbar.replaceChildren(undo, confirm);
  const answer = await ctx.response((done) => {
    let revision = 0,
      pendingPointer = null;
    function update() {
      revision++;
      cells.forEach((cell, i) => {
        const order = answers.lastIndexOf(i);
        cell.textContent = order < 0 ? '' : repeats ? '•' : String(order + 1);
        cell.classList.toggle('chosen', order >= 0);
        cell.classList.remove('review-active');
        cell.disabled = (!repeats && order >= 0) || answers.length >= count;
      });
      if (strip) {
        strip.sync();
        strip.select(answers.length - 1);
      }
      undo.disabled = !answers.length;
      confirm.disabled = answers.length !== count;
      ctx.hint('selected', { n: answers.length, total: count });
    }
    const root = cells[0].parentElement;
    function pointerDown(event) {
      if (!event.isPrimary || event.button !== 0) return;
      const cell = event.target instanceof Element ? event.target.closest('.grid-cell') : null;
      pendingPointer =
        cell && !cell.disabled ? { cell, revision, pointerId: event.pointerId } : null;
    }
    function pointerCancel() {
      pendingPointer = null;
    }
    root.addEventListener('pointerdown', pointerDown);
    root.addEventListener('pointercancel', pointerCancel);
    const handlers = cells.map((cell, i) => {
      const fn = (event) => {
        if (event.detail > 0 || event.pointerType) {
          const pending = pendingPointer;
          pendingPointer = null;
          if (
            !pending ||
            pending.cell !== cell ||
            pending.revision !== revision ||
            (event.pointerId > 0 && event.pointerId !== pending.pointerId)
          )
            return;
        }
        if (answers.length < count && (repeats || !answers.includes(i))) {
          answers.push(i);
          update();
        }
      };
      cell.addEventListener('click', fn);
      return fn;
    });
    const back = () => {
        answers.pop();
        update();
      },
      submit = () => {
        if (answers.length === count) done([...answers]);
      };
    undo.addEventListener('click', back);
    confirm.addEventListener('click', submit);
    return () => {
      root.removeEventListener('pointerdown', pointerDown);
      root.removeEventListener('pointercancel', pointerCancel);
      cells.forEach((c, i) => c.removeEventListener('click', handlers[i]));
      undo.removeEventListener('click', back);
      confirm.removeEventListener('click', submit);
    };
  });
  ctx.toolbar.replaceChildren();
  return answer;
}
const SpanUI = Object.freeze({ grid, sequenceStrip, recall });
export { SpanUI };
