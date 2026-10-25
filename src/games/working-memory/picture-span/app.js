import { mountVisualSpan } from '../../../engines/visual-span/app.js';
import { createPictureBank } from './picture-banks.js';
export function mountGame() {
  return mountVisualSpan({ bank: createPictureBank(), startLength: 1, members: 2 });
}
