import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  EXPOSURE_MS,
  VERSION,
  CHANNELS,
  activeChannels,
  choices,
  responseWindow,
  f1Score,
} from '../../src/games/working-memory/mn-back/rules.js';
import {
  generateSequence,
  matchingChannels,
  scoreTrials,
  validateRecords,
} from '../../src/games/working-memory/mn-back/model.js';

let seed = 991;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
const meta = (rules) => ({
  schema: 1,
  rulesVersion: VERSION,
  rules,
  inputTypes: [],
  display: {
    width: 600,
    height: 600,
    viewportWidth: 1280,
    viewportHeight: 900,
    dpr: 1,
    scale: 100,
  },
});
function recordFor(rules = { ...DEFAULTS }) {
  const sequence = generateSequence(rules, random),
    responseMs = responseWindow(rules);
  const trials = sequence.map((stimulus, index) => ({
    stimulus,
    responses: matchingChannels(sequence, index, rules),
    exposureMs: EXPOSURE_MS,
    responseMs,
  }));
  return {
    id: 'test-nback',
    endedAt: '2026-10-25T10:00:00Z',
    meta: meta(rules),
    reason: 'complete',
    elapsedMs: sequence.length * (EXPOSURE_MS + responseMs),
    score: 100,
    trials,
  };
}

test('N-back covers all 240 grid, N and channel combinations with 30 scored trials', () => {
  assert.equal(EXPOSURE_MS, 400);
  for (let size = 3; size <= 7; size++)
    for (let n = 1; n <= 6; n++)
      for (let mask = 0; mask < 8; mask++) {
        const rules = {
            size,
            n,
            sound: Boolean(mask & 1),
            shape: Boolean(mask & 2),
            color: Boolean(mask & 4),
          },
          record = recordFor(rules),
          channels = activeChannels(rules);
        assert.equal(record.trials.length, n + 30);
        assert.equal(responseWindow(rules), Math.round(((channels.length + 1) * 1000) / 3));
        for (const key of CHANNELS) {
          assert.ok(
            record.trials.every(({ stimulus }) =>
              channels.includes(key)
                ? stimulus[key] >= 0 && stimulus[key] < choices(rules, key)
                : stimulus[key] === null,
            ),
          );
          assert.equal(
            record.trials.slice(n).filter((trial) => trial.responses.includes(key)).length,
            channels.includes(key) ? 9 : 0,
          );
        }
        assert.deepEqual(validateRecords([record])[0], record);
      }
});

test('1-back permits necessary consecutive matches and disables warm-up scoring', () => {
  const record = recordFor();
  assert.deepEqual(record.trials[0].responses, []);
  assert.equal(
    record.trials
      .slice(1)
      .filter((trial, i) => trial.stimulus.position === record.trials[i].stimulus.position).length,
    9,
  );
});

test('F1 pools channel decisions, ignores correct rejections, and does not reward no answers', () => {
  assert.equal(f1Score({ hits: 3, falseAlarms: 2, misses: 1 }), 66.67);
  assert.equal(f1Score({ hits: 0, falseAlarms: 0, misses: 0 }), 0);
  const record = recordFor({ ...DEFAULTS, n: 3, shape: true, color: true, sound: true });
  assert.equal(scoreTrials(record.trials, record.meta.rules).score, 100);
  for (const trial of record.trials) trial.responses = [];
  assert.deepEqual(scoreTrials(record.trials, record.meta.rules), {
    hits: 0,
    falseAlarms: 0,
    misses: 36,
    score: 0,
  });
  for (const trial of record.trials.slice(3)) trial.responses = [...CHANNELS];
  assert.deepEqual(scoreTrials(record.trials, record.meta.rules), {
    hits: 36,
    falseAlarms: 84,
    misses: 0,
    score: 46.15,
  });
});

test('record validation rejects incomplete, altered, duplicate and out-of-window responses', () => {
  const mutations = [
    (r) => r.trials.pop(),
    (r) => r.trials[0].responses.push('position'),
    (r) => r.trials[2].responses.push('sound'),
    (r) => r.trials[2].responses.splice(0, 1, 'position', 'position'),
    (r) => {
      r.trials[2].stimulus.position = 9;
    },
    (r) => {
      r.trials[2].stimulus.color = 1;
    },
    (r) => {
      r.trials[2].exposureMs = EXPOSURE_MS - 1;
    },
    (r) => {
      r.trials[2].exposureMs = EXPOSURE_MS + 126;
    },
    (r) => {
      r.trials[2].responseMs = responseWindow(r.meta.rules) - 1;
    },
    (r) => {
      r.trials[2].responseMs = responseWindow(r.meta.rules) + 126;
    },
    (r) => {
      r.trials[2].responseMs = NaN;
    },
    (r) => {
      r.elapsedMs += 100;
    },
    (r) => {
      r.score = 99;
    },
    (r) => {
      r.reason = 'stopped';
    },
    (r) => {
      r.meta.rules.n = 7;
    },
    (r) => {
      r.meta.rules.position = false;
    },
    (r) => {
      r.meta.rules.shape = 'true';
    },
    (r) => {
      r.meta.rulesVersion = 'old-version';
    },
    (r) => {
      for (const trial of r.trials) trial.stimulus.position = 0;
    },
  ];
  for (const mutate of mutations) {
    const record = recordFor();
    mutate(record);
    assert.throws(() => validateRecords([record]), mutate.toString());
  }
});

test('channel schedules allow independent and simultaneous matches', () => {
  const rules = { ...DEFAULTS, shape: true, color: true, sound: true };
  const sequence = generateSequence(rules, random),
    sets = sequence.slice(1).map((_, i) => matchingChannels(sequence, i + 1, rules));
  assert.ok(sets.some((set) => set.length > 1));
  assert.ok(sets.some((set) => set.length === 1));
  assert.ok(sets.some((set) => !set.length));
  assert.ok(
    new Set(CHANNELS.map((channel) => sets.map((set) => set.includes(channel)).join())).size > 1,
  );
});
