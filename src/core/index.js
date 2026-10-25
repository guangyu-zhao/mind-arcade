import * as random from './random.js';
import * as records from './records.js';
import { recordKey } from './storage.js';
import { createHistory } from './session.js';
import { commitRecord } from './lifecycle.js';
export const Core = Object.freeze({
  ...random,
  ...records,
  recordKey,
  createHistory,
  commitRecord,
});
