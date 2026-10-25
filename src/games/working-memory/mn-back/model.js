import { shuffle } from '../../../core/random.js';
import { readMeta } from '../../../core/records.js';
import {
  CHANNELS,
  SCORED_TRIALS,
  MATCHES_PER_CHANNEL,
  EXPOSURE_MS,
  VERSION,
  readRules,
  activeChannels,
  choices,
  responseWindow,
  trialCount,
  f1Score,
} from './rules.js';

export function generateSequence(value, random = Math.random) {
  const rules = readRules(value),
    channels = activeChannels(rules);
  const sequence = Array.from({ length: trialCount(rules) }, () =>
    Object.fromEntries(CHANNELS.map((key) => [key, null])),
  );
  for (const channel of channels) {
    const targets = new Set(
      shuffle(
        Array.from({ length: SCORED_TRIALS }, (_, i) => i + rules.n),
        random,
      ).slice(0, MATCHES_PER_CHANNEL),
    );
    for (let i = 0; i < sequence.length; i++) {
      const previous = sequence[i - rules.n]?.[channel];
      if (targets.has(i)) sequence[i][channel] = previous;
      else {
        const pool = Array.from({ length: choices(rules, channel) }, (_, j) => j).filter(
          (item) => item !== previous,
        );
        sequence[i][channel] = pool[Math.floor(random() * pool.length)];
      }
    }
  }
  return sequence;
}

export function matchingChannels(sequence, index, rules) {
  if (index < rules.n) return [];
  return activeChannels(rules).filter(
    (key) => sequence[index][key] === sequence[index - rules.n][key],
  );
}

export function scoreTrials(trials, rules) {
  const counts = { hits: 0, falseAlarms: 0, misses: 0 },
    sequence = trials.map((trial) => trial.stimulus);
  for (let i = rules.n; i < trials.length; i++) {
    const matches = matchingChannels(sequence, i, rules);
    for (const channel of activeChannels(rules)) {
      const selected = trials[i].responses.includes(channel),
        match = matches.includes(channel);
      if (match) counts[selected ? 'hits' : 'misses']++;
      else if (selected) counts.falseAlarms++;
    }
  }
  return { ...counts, score: f1Score(counts) };
}

export function validateRecords(records) {
  if (!Array.isArray(records)) throw Error('invalid_record');
  return records.map((record) => {
    const meta = readMeta(record?.meta),
      rules = readRules(meta?.rules);
    if (
      meta.rulesVersion !== VERSION ||
      !/^[\w-]{1,100}$/.test(record.id) ||
      typeof record.id !== 'string' ||
      typeof record.endedAt !== 'string' ||
      !Number.isFinite(Date.parse(record.endedAt)) ||
      record.reason !== 'complete' ||
      !Array.isArray(record.trials) ||
      record.trials.length !== trialCount(rules)
    )
      throw Error('invalid_record');
    const channels = activeChannels(rules),
      counts = Object.fromEntries(channels.map((key) => [key, 0]));
    let duration = 0;
    const trials = record.trials.map((trial, i) => {
      if (
        !trial ||
        !trial.stimulus ||
        Object.keys(trial.stimulus).length !== CHANNELS.length ||
        !CHANNELS.every((key) =>
          channels.includes(key)
            ? Number.isInteger(trial.stimulus[key]) &&
              trial.stimulus[key] >= 0 &&
              trial.stimulus[key] < choices(rules, key)
            : trial.stimulus[key] === null,
        ) ||
        !Array.isArray(trial.responses) ||
        trial.responses.length !== new Set(trial.responses).size ||
        !trial.responses.every((key) => channels.includes(key)) ||
        (i < rules.n && trial.responses.length) ||
        !Number.isFinite(trial.exposureMs) ||
        trial.exposureMs < EXPOSURE_MS ||
        trial.exposureMs > EXPOSURE_MS + 125 ||
        !Number.isFinite(trial.responseMs) ||
        trial.responseMs < responseWindow(rules) ||
        trial.responseMs > responseWindow(rules) + 125
      )
        throw Error('invalid_trial');
      if (i >= rules.n)
        for (const key of channels)
          if (trial.stimulus[key] === record.trials[i - rules.n].stimulus[key]) counts[key]++;
      duration += trial.exposureMs + trial.responseMs;
      return {
        stimulus: { ...trial.stimulus },
        responses: [...trial.responses],
        exposureMs: trial.exposureMs,
        responseMs: trial.responseMs,
      };
    });
    const result = scoreTrials(trials, rules);
    if (
      !Object.values(counts).every((count) => count === MATCHES_PER_CHANNEL) ||
      record.score !== result.score ||
      !Number.isFinite(record.elapsedMs) ||
      Math.abs(record.elapsedMs - duration) > 1
    )
      throw Error('invalid_score');
    return {
      id: record.id,
      endedAt: record.endedAt,
      meta,
      reason: 'complete',
      elapsedMs: record.elapsedMs,
      score: result.score,
      trials,
    };
  });
}
