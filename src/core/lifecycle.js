const owners = new WeakMap();
let service = { userId: null, submit() {}, setContext() {} };
/** @param {import('./types.js').ScoreService} next */
export function connectScores(next) {
  service = next;
}
/** Capture ownership once, before the game begins. @param {import('./types.js').ScoreMeta} meta */
export function beginRecord(meta) {
  meta.ownerId = service.userId;
  owners.set(meta, {
    owner: service.userId,
    previous: service.userId ? (service.previousScores?.(meta) ?? null) : [],
    finished: false,
    sent: false,
  });
  service.begin?.();
}
export function comparisonHistory(meta) {
  const state = owners.get(meta);
  return state && state.owner === service.userId ? state.previous : null;
}
export function copyOwnership(source, target) {
  if (owners.has(source)) owners.set(target, owners.get(source));
}
export function finishRecord(meta) {
  const state = owners.get(meta);
  if (state) state.finished = true;
}
/** Explicit completion boundary; record merges never submit results. @param {import('./types.js').ScoreRecord} record */
export function commitRecord(record) {
  const state = owners.get(record.meta);
  if (!state?.finished || state.sent) return;
  state.sent = true;
  if (state.owner) service.submit(record, state.owner);
}
export function updateScoreContext(meta) {
  service.setContext(meta);
}
