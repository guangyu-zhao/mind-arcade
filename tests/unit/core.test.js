import test from 'node:test';
import assert from 'node:assert/strict';
import { Core } from '../../src/core/index.js';

const meta = () => ({
  schema: 1,
  rulesVersion: 'span-2',
  rules: { order: 'reverse' },
  display: {
    width: 540,
    height: 400,
    viewportWidth: 1280,
    viewportHeight: 900,
    dpr: 1,
    scale: 100,
  },
  inputTypes: ['keyboard'],
});
test('elapsed time ignores wall-clock changes', () => {
  const original = Date.now;
  try {
    Date.now = () => original() + 3600000;
    assert.equal(Core.elapsed(100, 175), 75);
  } finally {
    Date.now = original;
  }
  assert.equal(Core.elapsed(100, 50), 0);
});
test('visual choice rules stay independent of sequence length and pagination', () => {
  const bank = Array.from({ length: 40 }, (_, family) =>
    Array.from({ length: 20 }, (_, i) => ({ id: `${family}-${i}`, category: `family-${family}` })),
  ).flat();
  for (const [families, members] of [
    [24, 1],
    [12, 2],
    [3, 8],
    [4, 6],
  ]) {
    for (const length of [1, 2, 11, 12, 13, 18, 19, 100, 1001]) {
      const round = Core.visualRound(bank, length, families, members);
      assert.equal(round.candidates.length, 24);
      assert.equal(new Set(round.candidates).size, 24);
      assert.equal(round.sequence.length, length);
      assert.ok(round.sequence.every((id) => round.candidates.includes(id)));
    }
  }
  assert.deepEqual(
    Core.sampleSequence(['a', 'b'], 2, () => 0),
    ['a', 'b'],
  );
  const values = Core.sampleSequence(['a', 'b', 'c'], 13, () => 0.6);
  assert.equal(values.slice().reverse().length, 13);
  assert.throws(() => Core.visualRound([], 2, 4, 6));
});
test('record metadata preserves unknown conditions and rejects invalid imports', () => {
  assert.equal(Core.readMeta(undefined), null);
  assert.deepEqual(Core.readMeta(meta()), meta());
  const invalid = meta();
  invalid.display.scale = NaN;
  assert.throws(() => Core.readMeta(invalid));
  const badInput = meta();
  badInput.inputTypes = ['script'];
  assert.throws(() => Core.readMeta(badInput));
  const badRules = meta();
  badRules.rules = { payload: { nested: true } };
  assert.throws(() => Core.readMeta(badRules));
  const resized = meta();
  resized.display.scale = 60;
  assert.equal(Core.conditionKey(resized), Core.conditionKey(meta()));
  const otherRules = meta();
  otherRules.rules.order = 'forward';
  assert.notEqual(Core.conditionKey(otherRules), Core.conditionKey(meta()));
  const revised = meta();
  revised.rulesVersion = 'span-3';
  assert.notEqual(Core.conditionKey(revised), Core.conditionKey(meta()));
  assert.notEqual(Core.conditionKey(null), Core.conditionKey(meta()));
});
test('damaged records are isolated without blocking valid history or future saves', () => {
  const a = { id: 'a', endedAt: '2026-01-01', score: 1 },
    b = { id: 'b', endedAt: '2026-01-02', score: 2 };
  assert.deepEqual(Core.mergeRecords([b], [a, b]), [a, b]);
  const values = new Map([['records', 'broken']]);
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const validate = (value) => {
    assert.ok(Array.isArray(value));
    assert.ok(
      value.every(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.endedAt === 'string' &&
          Number.isFinite(item.score),
      ),
    );
    return value;
  };
  try {
    assert.deepEqual(Core.saveRecords('records', [a], validate), [a]);
    assert.deepEqual(JSON.parse(values.get('records.quarantine')), ['broken']);
    values.set('records', JSON.stringify([a, { id: 'damaged' }, null]));
    assert.deepEqual(Core.readRecords('records', validate), [a]);
    assert.deepEqual(JSON.parse(values.get('records.quarantine')), [{ id: 'damaged' }, null]);
    assert.deepEqual(Core.saveRecords('records', [b], validate), [a, b]);
    assert.deepEqual(Core.saveRecords('records', [b], validate), [a, b]);
    assert.throws(() => Core.saveRecords('records', [{ id: 'invalid' }], validate));
    assert.deepEqual(JSON.parse(values.get('records')), [a, b]);
  } finally {
    delete global.localStorage;
  }
});
