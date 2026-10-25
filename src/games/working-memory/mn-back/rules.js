export const CHANNELS = Object.freeze(['position', 'sound', 'shape', 'color']);
export const DEFAULTS = Object.freeze({ size: 3, n: 1, sound: false, shape: false, color: false });
export const SCORED_TRIALS = 30;
export const MATCHES_PER_CHANNEL = 9;
export const EXPOSURE_MS = 1000;
export const VERSION = 'mn-back-20261025';
export const trialCount = (rules) => rules.n + SCORED_TRIALS;

export function readRules(value) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== 5 ||
    !Number.isInteger(value.size) ||
    value.size < 3 ||
    value.size > 7 ||
    !Number.isInteger(value.n) ||
    value.n < 1 ||
    value.n > 6 ||
    !['sound', 'shape', 'color'].every((key) => typeof value[key] === 'boolean')
  )
    throw Error('invalid_rules');
  return {
    size: value.size,
    n: value.n,
    sound: value.sound,
    shape: value.shape,
    color: value.color,
  };
}

export const activeChannels = (rules) => CHANNELS.filter((key) => key === 'position' || rules[key]);
export const responseWindow = (rules) => (activeChannels(rules).length + 0.5) * 1000;
export const choices = (rules, channel) =>
  ({ position: rules.size ** 2, sound: 26, shape: 9, color: 8 })[channel];
export const f1Score = ({ hits, falseAlarms, misses }) => {
  const denominator = 2 * hits + falseAlarms + misses;
  return denominator ? Math.round((20000 * hits) / denominator) / 100 : 0;
};
