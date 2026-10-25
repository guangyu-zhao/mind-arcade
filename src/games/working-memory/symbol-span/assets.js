import { GameI18n } from '../../../i18n/runtime.js';
import { AbstractSymbols } from '../../../core/symbols.js';
const MemoryAssets = Object.freeze({
  symbols: AbstractSymbols.createBank({ prefix: 'symbol-geo-', collection: 'geometric' }).map(
    (item, index) => ({
      ...item,
      label: GameI18n.message('ui.symbol-value', index + 1),
    }),
  ),
});
export { MemoryAssets };
