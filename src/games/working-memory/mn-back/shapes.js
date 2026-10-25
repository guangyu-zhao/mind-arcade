import { svg } from '../../../ui/dom.js';

const paths = [
  'M18 18H82V82H18Z',
  'M50 10 91 85H9Z',
  null,
  'M50 8 90 37 75 84H25L10 37Z',
  'm24 12 26 26 26-26 12 12-26 26 26 26-12 12-26-26-26 26-12-12 26-26-26-26Z',
  'M12 27H88V42H12ZM12 58H88V73H12Z',
  'M43 7H57V36L82 21 89 34 64 49 89 64 82 77 57 62V91H43V62L18 77 11 64 36 49 11 34 18 21 43 36Z',
];

export function shapeDrawing(index) {
  const drawing = svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  if (index === 2) drawing.append(svg('circle', { cx: 50, cy: 50, r: 36 }));
  else if (index >= 7) {
    const letter = svg('text', { x: 50, y: 78, 'text-anchor': 'middle' });
    letter.textContent = index === 7 ? 'A' : 'B';
    drawing.append(letter);
  } else drawing.append(svg('path', { d: paths[index] }));
  return drawing;
}
