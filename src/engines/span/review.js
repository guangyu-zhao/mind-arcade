import { GameText as I } from './i18n.js';

export function judgmentReview(ctx, trials, describe) {
  const errors = trials.flatMap((trial) =>
    trial.judgments.flatMap((judgment, index) => {
      const item = describe(ctx, judgment, trial);
      return item.correct ? [] : [{ ...item, level: trial.level, number: index + 1 }];
    }),
  );
  if (!errors.length) return null;
  const root = ctx.node('details', null, null, 'judgment-review');
  const summary = ctx.node('summary', 'reviewTitle', { n: errors.length }),
    body = ctx.node('div', null, null, 'judgment-review-body'),
    heading = ctx.node('p'),
    drawing = ctx.node('div', null, null, 'judgment-review-drawing'),
    actual = ctx.node('p'),
    expected = ctx.node('p'),
    navigation = ctx.node('div', null, null, 'judgment-review-navigation'),
    previous = ctx.button('reviewPrevious'),
    next = ctx.button('reviewNext'),
    count = ctx.node('span');
  let index = 0,
    renderedIndex = -1;
  function show(value) {
    if (!root.open || value < 0 || value >= errors.length) return;
    index = value;
    const item = errors[index];
    I.text(heading, 'reviewItem', { level: item.level, n: item.number });
    if (renderedIndex !== index) {
      drawing.replaceChildren(item.drawing());
      renderedIndex = index;
    }
    I.text(actual, 'reviewYourAnswer', { answer: I.tr(item.answer) });
    I.text(expected, 'reviewExpected', {
      answer: item.expected.map((key) => I.tr(key)).join(' / '),
    });
    count.textContent = `${index + 1} / ${errors.length}`;
    previous.disabled = index === 0;
    next.disabled = index === errors.length - 1;
  }
  previous.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  root.addEventListener('toggle', () => {
    if (root.open) show(index);
  });
  navigation.append(previous, count, next);
  navigation.hidden = errors.length === 1;
  body.append(heading, drawing, actual, expected, navigation);
  root.append(summary, body);
  // Resolve composed answer labels again after a language change without retaining old reviews.
  root.refreshLanguage = () => show(index);
  return root;
}
