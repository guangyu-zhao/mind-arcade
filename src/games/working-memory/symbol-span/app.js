import { mountVisualSpan } from '../../../engines/visual-span/app.js';
import { MemoryAssets } from './assets.js';
export function mountGame() {
  return mountVisualSpan({
    bank: MemoryAssets.symbols,
    startLength: 1,
    members: 1,
    outlined: true,
  });
}
