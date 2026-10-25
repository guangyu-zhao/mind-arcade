import test from 'node:test';
import assert from 'node:assert/strict';
import { SymmetryPlusRules as symmetry } from '../../src/games/working-memory/symmetry-span-plus-plus/rules.js';
import { UpdatingMemoryModel as updating } from '../../src/engines/updating/model.js';
import { TrackingPhysics as physics } from '../../src/games/attention/multiple-object-tracking/physics.js';
import { ReactionModel as reaction } from '../../src/engines/reaction/model.js';
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
test('symmetry streams have valid unions, independent distractors and all allowed lengths', () => {
  const random = seeded(47);
  for (const size of [4, 6])
    for (const count of [2, 4, 6, 'random'])
      for (const interference of [false, true]) {
        const lengths = new Set();
        for (let n = 0; n < 150; n++) {
          const { targets, distractors } = symmetry.streams(count, interference, size, random);
          lengths.add(targets.length);
          assert.equal(new Set(targets).size, targets.length);
          assert.ok(targets.every((cell) => symmetry.validCell(cell, size)));
          assert.ok(
            ['left-right', 'top-bottom', 'neither'].some((axis) =>
              symmetry.accepts(targets, axis, size),
            ),
          );
          assert.equal(distractors.length, targets.length);
          if (interference) {
            assert.equal(new Set(distractors).size, distractors.length);
            assert.ok(
              distractors.every((cell, i) => symmetry.validCell(cell, size) && cell !== targets[i]),
            );
          } else assert.ok(distractors.every((cell) => cell === null));
        }
        assert.deepEqual([...lengths].sort(), count === 'random' ? [2, 4, 6] : [count]);
      }
});
test('symmetry answers accept both axes and combine reversal with each rotation', () => {
  for (const size of [4, 6]) {
    const corners = [0, size - 1, size * (size - 1), size * size - 1];
    assert.equal(symmetry.accepts(corners, 'left-right', size), true);
    assert.equal(symmetry.accepts(corners, 'top-bottom', size), true);
    assert.equal(symmetry.accepts(corners, 'neither', size), false);
    for (const order of ['forward', 'reverse'])
      for (const transform of ['original', 'rotated', 'counterclockwise']) {
        const source = [0, 1, size + 2, size * size - 1],
          original = [...source];
        let expected = source.map((cell) => {
          const row = Math.floor(cell / size),
            col = cell % size;
          return transform === 'rotated'
            ? col * size + size - row - 1
            : transform === 'counterclockwise'
              ? (size - col - 1) * size + row
              : cell;
        });
        if (order === 'reverse') expected.reverse();
        assert.deepEqual(
          plain(symmetry.expected(source, { ...symmetry.DEFAULTS, size, order, transform })),
          expected,
        );
        assert.deepEqual(source, original);
      }
  }
});
test('updating tasks generate complete, replayable trials beyond the first screen', () => {
  for (const kind of ['spatial', 'arithmetic', 'running'])
    for (const level of [1, 12, 30])
      for (const tail of kind === 'running' ? [1, 2, 3, 4] : [1]) {
        const model = updating.create(kind),
          plan = model.levelPlan(level, { tail }),
          trial = model.generate(plan);
        trial.initialExposureMs = trial.initial.map(() => plan.initialMs);
        trial.events.forEach((event) => {
          event.exposureMs = plan.eventMs;
        });
        trial.responses = model.expected(trial);
        trial.rtMs = 800;
        const read = model.validateTrial(trial);
        model.validateContext(read, plan);
        assert.equal(model.correct(read), plan.channels);
        assert.equal(model.passes(read), true);
        read.responses[0][0] += 1;
        assert.equal(model.passes(read), false);
        assert.equal(model.correct(read), plan.channels - 1);
      }
});
test('spatial wrap, arithmetic updates and running tails replay independently per channel', () => {
  assert.deepEqual(
    plain(
      updating.create('spatial').expected({
        initial: [0, 8],
        events: [
          { channel: 0, value: 0 },
          { channel: 1, value: 1 },
        ],
      }),
    ),
    [[6], [6]],
  );
  assert.deepEqual(
    plain(
      updating.create('arithmetic').expected({
        initial: [0, 9],
        events: [
          { channel: 0, value: -1 },
          { channel: 1, value: 1 },
          { channel: 0, value: 1 },
        ],
      }),
    ),
    [[0], [10]],
  );
  assert.deepEqual(
    plain(
      updating.create('running').expected({
        channels: 2,
        tail: 2,
        events: [
          { channel: 0, value: 1 },
          { channel: 1, value: 4 },
          { channel: 0, value: 2 },
          { channel: 0, value: 3 },
          { channel: 1, value: 5 },
        ],
      }),
    ),
    [
      [2, 3],
      [4, 5],
    ],
  );
});
test('tracking discs bounce at contact and conserve energy over repeated collisions', () => {
  const pair = [
    { x: 200, y: 240, vx: 100, vy: 0 },
    { x: 300, y: 240, vx: -100, vy: 0 },
  ];
  physics.advance(pair, 0.25);
  assert.equal(pair[0].vx, 100);
  assert.equal(pair[1].vx, -100);
  physics.advance(pair, 0.02);
  assert.equal(pair[0].vx, -100);
  assert.equal(pair[1].vx, 100);
  assert.ok(Math.abs(pair[1].x - pair[0].x - 50) < 1e-8);
  const random = seeded(9),
    balls = Array.from({ length: 12 }, (_, i) => ({
      x: 80 + (i % 4) * 150,
      y: 80 + Math.floor(i / 4) * 150,
      vx: (random() - 0.5) * 900,
      vy: (random() - 0.5) * 900,
    }));
  const energy = () => balls.reduce((sum, b) => sum + b.vx * b.vx + b.vy * b.vy, 0),
    initialEnergy = energy();
  for (let step = 0; step < 600; step++) {
    physics.advance(balls, 1 / 60);
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      assert.ok(b.x >= physics.radius - 1e-6 && b.x <= physics.width - physics.radius + 1e-6);
      assert.ok(b.y >= physics.radius - 1e-6 && b.y <= physics.height - physics.radius + 1e-6);
      for (let j = i + 1; j < balls.length; j++)
        assert.ok(Math.hypot(b.x - balls[j].x, b.y - balls[j].y) >= 2 * physics.radius - 1e-6);
    }
  }
  assert.ok(Math.abs(energy() - initialEnergy) < initialEnergy * 1e-10);
});
test('reaction scoring excludes premature responses and retains omissions and no-go errors', () => {
  for (const kind of ['pvt', 'choice', 'gonogo'])
    assert.equal(reaction.protocol(kind).durationMs, 30000);
  const trials = [
    { target: 0, answer: 0, rtMs: 50 },
    { target: 0, answer: 0, rtMs: 250 },
    { target: 0, answer: null, rtMs: null },
  ];
  const pvt = reaction.summarize('pvt', trials);
  assert.equal(pvt.score, 1);
  const go = reaction.summarize('gonogo', [
    { target: 0, answer: null, rtMs: null },
    { target: 1, answer: 0, rtMs: 200 },
    { target: 1, answer: null, rtMs: null },
  ]);
  assert.equal(go.score, 1);
});
test('reaction targets remain independent and PVT waiting budgets stay balanced', () => {
  const random = seeded(23);
  for (const kind of ['choice', 'gonogo']) {
    const values = Array.from({ length: 10000 }, () => reaction.nextTarget(kind, random));
    const fraction = values.reduce((a, b) => a + b, 0) / values.length;
    assert.ok(Math.abs(fraction - (kind === 'choice' ? 0.5 : 0.25)) < 0.02);
    assert.ok(
      values.some((value, i) => i > 3 && values.slice(i - 3, i + 1).every((v) => v === value)),
    );
  }
  const scores = new Set();
  for (let game = 0; game < 1000; game++) {
    let balance = 0,
      elapsed = 0,
      score = 0;
    while (elapsed < 30000) {
      const next = reaction.nextWait('pvt', balance, random);
      assert.ok(next.waitMs >= 1000 && next.waitMs <= 3000);
      assert.ok(Math.abs(next.balance) <= 750.000001);
      balance = next.balance;
      elapsed += next.waitMs + 200;
      if (elapsed < 30000) score++;
    }
    scores.add(score);
  }
  assert.deepEqual([...scores].sort(), [13]);
});

test('picture bank retains every original object and unique drawing after module loading', async () => {
  const { createPictureBank } =
    await import('../../src/games/working-memory/picture-span/picture-banks.js');
  const { translate } = await import('../../src/i18n/translate.js');
  const bank = createPictureBank();
  const { createHash } = await import('node:crypto');
  const { default: snapshot } = await import('../fixtures/picture-bank.snapshot.json', {
    with: { type: 'json' },
  });
  assert.equal(bank.length, snapshot.count);
  assert.equal(
    createHash('sha256')
      .update(
        JSON.stringify(
          bank.map(({ id, category, form, drawing }) => ({ id, category, form, drawing })),
        ),
      )
      .digest('hex'),
    snapshot.sha256,
  );
  assert.equal(new Set(bank.map((item) => item.category)).size, 200);
  assert.equal(new Set(bank.map((item) => item.drawing)).size, bank.length);
  for (const category of new Set(bank.map((item) => item.category)))
    assert.equal(
      new Set(bank.filter((item) => item.category === category).map((item) => item.drawing)).size,
      bank.filter((item) => item.category === category).length,
    );
  for (const language of ['zh', 'en', 'de', 'fr', 'ja', 'ko'])
    for (const item of bank)
      assert.doesNotMatch(translate(item.label, {}, language), /\b(?:ui|object|game)\./);
  assert.equal(createPictureBank().length, snapshot.count);
});
