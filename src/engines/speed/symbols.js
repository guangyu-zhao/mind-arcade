import { AbstractSymbols } from '../../core/symbols.js';
import { currentGame } from '../../catalog.js';
const coding = currentGame().config.kind === 'coding';
const SpeedSymbols = Object.freeze({
  search: coding ? [] : AbstractSymbols.createBank({ prefix: 's' }),
  coding: coding ? AbstractSymbols.createBank({ limit: 9, prefix: 'c' }) : [],
});
export { SpeedSymbols };
