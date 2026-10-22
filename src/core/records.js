import { copyOwnership, comparisonHistory } from './lifecycle.js';
/** @param {...Array<import('./types.js').ScoreRecord>} groups */
function mergeRecords(...groups) {
  const unique = new Map();
  for (const records of groups)
    for (const record of records) {
      if (!unique.has(record.id)) unique.set(record.id, record);
    }
  return [...unique.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
}

function readRecords(key, validate, storage = globalThis.localStorage) {
  const raw = storage.getItem(key);
  if (!raw) return [];
  let values;
  try {
    values = JSON.parse(raw);
  } catch {
    values = raw;
  }
  const clean = [],
    rejected = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    try {
      clean.push(...validate([value]));
    } catch {
      rejected.push(value);
    }
  }
  if (rejected.length) {
    try {
      const backup = JSON.stringify(rejected.slice(-20));
      storage.setItem(
        `${key}.quarantine`,
        backup.length <= 200000 ? backup : JSON.stringify({ truncated: backup.slice(0, 200000) }),
      );
    } catch {}
    try {
      storage.setItem(key, JSON.stringify(clean));
    } catch {}
  }
  return mergeRecords(clean);
}

function saveRecords(key, records, validate) {
  const incoming = validate(records);
  const existing = readRecords(key, validate);
  const merged = mergeRecords(incoming, existing);
  localStorage.setItem(key, JSON.stringify(merged));
  return merged;
}

function readMeta(meta) {
  if (meta == null) return null;
  const d = meta.display;
  if (
    meta.schema !== 1 ||
    typeof meta.rulesVersion !== 'string' ||
    !/^[a-z0-9.-]{1,80}$/.test(meta.rulesVersion) ||
    !meta.rules ||
    Object.getPrototypeOf(meta.rules) !== Object.prototype ||
    Object.keys(meta.rules).length > 20 ||
    !Object.entries(meta.rules).every(
      ([k, v]) =>
        /^[a-zA-Z0-9_-]{1,40}$/.test(k) &&
        ((typeof v === 'string' && v.length <= 100) ||
          typeof v === 'boolean' ||
          (typeof v === 'number' && Number.isFinite(v))),
    ) ||
    !d ||
    !['width', 'height', 'viewportWidth', 'viewportHeight', 'dpr', 'scale'].every(
      (k) => Number.isFinite(d[k]) && d[k] > 0 && d[k] <= 20000,
    ) ||
    !Array.isArray(meta.inputTypes) ||
    !meta.inputTypes.every((v) => ['mouse', 'touch', 'pen', 'keyboard'].includes(v))
  )
    throw Error('record conditions');
  const clean = {
    schema: 1,
    rulesVersion: meta.rulesVersion,
    rules: { ...meta.rules },
    display: Object.fromEntries(
      ['width', 'height', 'viewportWidth', 'viewportHeight', 'dpr', 'scale'].map((k) => [k, d[k]]),
    ),
    inputTypes: [...new Set(meta.inputTypes)].sort(),
    ...(Object.hasOwn(meta, 'ownerId') &&
    (meta.ownerId === null || (typeof meta.ownerId === 'string' && meta.ownerId.length <= 128))
      ? { ownerId: meta.ownerId }
      : {}),
  };
  copyOwnership(meta, clean);
  return clean;
}

function conditionKey(meta) {
  if (!meta) return 'unknown';
  return JSON.stringify([
    meta.rulesVersion,
    Object.entries(meta.rules).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
function previousRecords(records, meta) {
  const remote = comparisonHistory(meta);
  if (remote === null) return [];
  const own = records.filter(
    (record) =>
      Object.hasOwn(record.meta || {}, 'ownerId') &&
      record.meta.ownerId === meta.ownerId &&
      conditionKey(record.meta) === conditionKey(meta),
  );
  return [...own, ...remote].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
}
export { mergeRecords, readRecords, saveRecords, readMeta, conditionKey, previousRecords };
