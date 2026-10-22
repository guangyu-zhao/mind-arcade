import test from 'node:test';
import assert from 'node:assert/strict';
import { Core } from '../../src/core/index.js';
import { beginRecord, finishRecord, connectScores } from '../../src/core/lifecycle.js';
const meta = () => ({
  schema: 1,
  rulesVersion: 'sequence-memory-1',
  rules: { size: 3, mode: 'prefix', order: 'forward' },
  display: {
    width: 500,
    height: 500,
    viewportWidth: 1200,
    viewportHeight: 900,
    dpr: 1,
    scale: 100,
  },
  inputTypes: [],
});
test('score comparisons use the current account and rules plus the cloud baseline captured at start', () => {
  const cloud = [{ score: 7, endedAt: '2026-10-01' }];
  const service = {
    userId: 'alice',
    previousScores: () => [...cloud],
    submit() {},
    setContext() {},
  };
  connectScores(service);
  try {
    const current = meta();
    beginRecord(current);
    const record = (ownerId, score, size = 3) => ({
      score,
      endedAt: '2026-10-02',
      meta: { ...meta(), ownerId, rules: { ...meta().rules, size } },
    });
    const records = [
      record('alice', 8),
      record('bob', 50),
      record(null, 40),
      record('alice', 9, 4),
      { score: 100, endedAt: '2026-10-02', meta: meta() },
    ];
    cloud.push({ score: 10, endedAt: '2026-10-03' });
    assert.deepEqual(
      Core.previousRecords(records, current).map((r) => r.score),
      [7, 8],
    );
    assert.deepEqual(
      Core.previousRecords(records, Core.readMeta(current)).map((r) => r.score),
      [7, 8],
    );
    service.userId = 'bob';
    assert.deepEqual(Core.previousRecords(records, current), []);
    service.previousScores = () => null;
    const pending = meta();
    beginRecord(pending);
    assert.deepEqual(Core.previousRecords(records, pending), []);
    service.userId = null;
    const guest = meta();
    beginRecord(guest);
    assert.deepEqual(
      Core.previousRecords(records, guest).map((r) => r.score),
      [40],
    );
  } finally {
    connectScores({ userId: null, submit() {}, setContext() {} });
  }
});
test('merging and reading records never upload; completing a run submits once to its original owner', () => {
  const calls = [],
    service = { userId: 'alice', submit: (...args) => calls.push(args), setContext() {} };
  connectScores(service);
  const original = meta();
  beginRecord(original);
  service.userId = 'bob';
  const copied = Core.readMeta(original);
  const record = { id: 'run', meta: copied, endedAt: '2026-10-17' };
  Core.mergeRecords([record], [record]);
  Core.commitRecord(record);
  assert.equal(calls.length, 0);
  finishRecord(copied);
  Core.mergeRecords([record]);
  assert.equal(calls.length, 0);
  Core.commitRecord(record);
  Core.commitRecord(record);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'alice');
  service.userId = null;
  const anonymous = meta();
  beginRecord(anonymous);
  service.userId = 'alice';
  finishRecord(anonymous);
  Core.commitRecord({ meta: anonymous });
  assert.equal(calls.length, 1);
  Core.commitRecord({ meta: Core.readMeta(meta()) });
  assert.equal(calls.length, 1);
  connectScores({ userId: null, submit() {}, setContext() {} });
});
