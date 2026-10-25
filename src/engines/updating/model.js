import { Core } from '../../core/index.js';
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const timing = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const random = (max) => Math.floor(Math.random() * max);
const shuffle = (values) => Core.shuffle(values);
function create(kind) {
  if (!['spatial', 'arithmetic', 'running'].includes(kind)) throw Error('task');
  const running = kind === 'running';
  function levelPlan(level, rules = {}) {
    const channels = level,
      tail = running ? (rules.tail ?? 2) : 1;
    if (!integer(level, 1, Number.MAX_SAFE_INTEGER - 1) || !integer(tail, 1, 4))
      throw Error('level');
    return {
      level,
      condition: `${channels}:${tail}`,
      channels,
      tail,
      initialMs: kind === 'spatial' ? 1800 : 1300,
      eventMs: kind === 'spatial' ? 1500 : running ? 1000 : 1300,
      gapMs: 250,
    };
  }
  function move(position, direction) {
    const row = Math.floor(position / 3),
      col = position % 3;
    const [dr, dc] = [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ][direction];
    return ((row + dr + 3) % 3) * 3 + ((col + dc + 3) % 3);
  }
  function expected(trial) {
    const state = running ? Array.from({ length: trial.channels }, () => []) : [...trial.initial];
    trial.events.forEach(({ channel, value }) => {
      if (kind === 'spatial') state[channel] = move(state[channel], value);
      else if (kind === 'arithmetic') state[channel] += value;
      else {
        state[channel].push(value);
        if (state[channel].length > trial.tail) state[channel].shift();
      }
    });
    return running ? state : state.map((value) => [value]);
  }
  function generate(plan) {
    const initial = running
      ? []
      : Array.from({ length: plan.channels }, () => random(kind === 'spatial' ? 9 : 10));
    let order;
    if (running) {
      order = shuffle(
        Array.from({ length: plan.channels }, (_, channel) => {
          // A geometric tail has no predictable final count or fixed upper bound.
          const extra = Math.floor(Math.log1p(-Math.random()) / Math.log(0.82));
          return Array(plan.tail + 1 + extra).fill(channel);
        }).flat(),
      );
    } else {
      order = Array.from({ length: 3 }, () =>
        shuffle(Array.from({ length: plan.channels }, (_, i) => i)),
      ).flat();
    }
    const events = order.map((channel) => ({
      channel,
      value: kind === 'spatial' ? random(4) : running ? random(10) : random(2) ? 1 : -1,
    }));
    return { condition: plan.condition, channels: plan.channels, tail: plan.tail, initial, events };
  }
  function correct(trial) {
    return expected(trial).reduce(
      (sum, row, i) => sum + Number(row.every((value, j) => value === trial.responses[i][j])),
      0,
    );
  }
  function validateTrial(raw) {
    if (
      !raw ||
      !integer(raw.channels, 1, Number.MAX_SAFE_INTEGER) ||
      !integer(raw.tail, 1, running ? 4 : 1) ||
      raw.condition !== `${raw.channels}:${raw.tail}` ||
      !Array.isArray(raw.initial) ||
      raw.initial.length !== (running ? 0 : raw.channels) ||
      !raw.initial.every((value) => integer(value, 0, kind === 'spatial' ? 8 : 9)) ||
      !Array.isArray(raw.events) ||
      !Array.isArray(raw.initialExposureMs) ||
      raw.initialExposureMs.length !== raw.initial.length ||
      !raw.initialExposureMs.every(timing) ||
      !Array.isArray(raw.responses) ||
      raw.responses.length !== raw.channels ||
      !raw.responses.every(
        (row) =>
          Array.isArray(row) &&
          row.length === raw.tail &&
          row.every((value) =>
            integer(
              value,
              kind === 'arithmetic' ? -99 : 0,
              kind === 'spatial' ? 8 : running ? 9 : 99,
            ),
          ),
      ) ||
      !timing(raw.rtMs)
    )
      throw Error('trial');
    const counts = Array(raw.channels).fill(0);
    const events = raw.events.map((event) => {
      if (
        !event ||
        !integer(event.channel, 0, raw.channels - 1) ||
        !timing(event.exposureMs) ||
        (kind === 'arithmetic'
          ? ![-1, 1].includes(event.value)
          : !integer(event.value, 0, running ? 9 : 3))
      )
        throw Error('event');
      counts[event.channel]++;
      return { channel: event.channel, value: event.value, exposureMs: event.exposureMs };
    });
    if (counts.some((count) => (running ? count < raw.tail + 1 : count !== 3)))
      throw Error('event count');
    if (!running) {
      for (let offset = 0; offset < events.length; offset += raw.channels) {
        if (
          new Set(events.slice(offset, offset + raw.channels).map((event) => event.channel))
            .size !== raw.channels
        )
          throw Error('update sweep');
      }
    }
    return {
      condition: raw.condition,
      channels: raw.channels,
      tail: raw.tail,
      initial: [...raw.initial],
      events,
      initialExposureMs: [...raw.initialExposureMs],
      responses: raw.responses.map((row) => [...row]),
      rtMs: raw.rtMs,
    };
  }
  function validateContext(trial, plan) {
    if (
      trial.condition !== plan.condition ||
      trial.channels !== plan.channels ||
      trial.tail !== plan.tail ||
      trial.initialExposureMs.some((ms) => Math.abs(ms - plan.initialMs) > 125) ||
      trial.events.some((event) => Math.abs(event.exposureMs - plan.eventMs) > 125)
    )
      throw Error('parameters');
  }
  return {
    kind,
    levelPlan,
    generate,
    expected,
    correct,
    validateTrial,
    validateContext,
    passes: (trial) => correct(trial) === trial.channels,
  };
}
const UpdatingMemoryModel = { create };
export { UpdatingMemoryModel };
