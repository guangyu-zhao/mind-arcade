function protocol(kind) {
  return {
    durationMs: 30000,
    waitMin: kind === 'pvt' ? 1000 : 500,
    waitMax: kind === 'pvt' ? 3000 : 500,
    windowMs: kind === 'pvt' ? 10000 : 1500,
    visibleMs: kind === 'pvt' ? 10000 : kind === 'gonogo' ? 500 : 1500,
  };
}
function outcome(kind, trial) {
  if (kind === 'gonogo' && trial.target === 1)
    return trial.answer === null ? 'withheld' : 'commission';
  if (trial.answer === null) return 'omission';
  if (trial.rtMs < 100) return 'premature';
  return trial.answer === trial.target ? 'hit' : 'wrong';
}
function nextTarget(kind, random = Math.random) {
  return kind === 'pvt'
    ? 0
    : kind === 'gonogo'
      ? Number(random() < 0.25)
      : Math.floor(random() * 2);
}
function nextWait(kind, balance = 0, random = Math.random) {
  if (kind !== 'pvt') return { waitMs: 500, balance: 0 };
  // Keep cumulative waiting time within 750 ms of the same per-trial budget.
  const low = Math.max(-1000, -750 - balance),
    high = Math.min(1000, 750 - balance),
    delta = low + random() * (high - low);
  return { waitMs: 2000 + delta, balance: balance + delta };
}
const correct = (kind, trial) => ['hit', 'withheld'].includes(outcome(kind, trial));
const summarize = (kind, trials) => ({
  score: trials.filter((trial) => correct(kind, trial)).length,
});
export const ReactionModel = Object.freeze({
  protocol,
  outcome,
  correct,
  summarize,
  nextTarget,
  nextWait,
});
