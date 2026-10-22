import { copyOwnership, comparisonHistory } from './lifecycle.js';
import { conditionKey } from './conditions.js';
import { recordKey } from './storage.js';
/** @param {...Array<import('./types.js').ScoreRecord>} groups */
function mergeRecords(...groups) {
  const unique = new Map();
  for (const records of groups)
    for (const record of records) {
      if (!unique.has(record.id)) unique.set(record.id, record);
    }
  return [...unique.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
}

const stores = new WeakMap();
const uploadedCacheLimit = 100;
function cacheFor(storage) {
  if (!stores.has(storage)) stores.set(storage, { entries: new Map(), persisted: new WeakMap() });
  return stores.get(storage);
}
const entryKey = (key, id) => `${key}:${id}`;
function recordKeys(storage, key) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((name) =>
    name?.startsWith(`${key}:`),
  );
}
function readEntry(storage, name) {
  const cache = cacheFor(storage),
    raw = storage.getItem(name);
  if (raw === null) {
    cache.entries.delete(name);
    return null;
  }
  const old = cache.entries.get(name);
  if (old?.raw === raw) return old;
  const value = JSON.parse(raw);
  if (
    value?.schema !== 1 ||
    !value.record ||
    typeof value.record.id !== 'string' ||
    !/^[\w-]{1,100}$/.test(value.record.id) ||
    !name.endsWith(`:${value.record.id}`) ||
    typeof value.uploaded !== 'boolean'
  )
    throw Error('record');
  const entry = { raw, ...value, validated: new Map() };
  cache.entries.set(name, entry);
  return entry;
}
function writeEntry(storage, name, record, uploaded = false, validated = new Map()) {
  const raw = JSON.stringify({ schema: 1, record, uploaded });
  storage.setItem(name, raw);
  const cache = cacheFor(storage);
  cache.entries.set(name, { raw, record, uploaded, validated });
  cache.persisted.set(record, name);
}
function quarantine(storage, key, rejected) {
  if (!rejected.length) return;
  try {
    const backup = JSON.stringify(rejected.slice(-20));
    storage.setItem(
      `${key}.quarantine`,
      backup.length <= 200000 ? backup : JSON.stringify({ truncated: backup.slice(0, 200000) }),
    );
  } catch {}
}
function readRecords(key, validate, storage = globalThis.localStorage) {
  const cache = cacheFor(storage),
    clean = [],
    rejected = [];
  const legacy = storage.getItem(key);
  if (legacy !== null) {
    let values;
    try {
      values = JSON.parse(legacy);
    } catch {
      values = legacy;
    }
    let migrated = true;
    const created = [];
    for (const value of Array.isArray(values) ? values : [values]) {
      let record;
      try {
        [record] = validate([value]);
      } catch {
        rejected.push(value);
        continue;
      }
      clean.push(record);
      try {
        const name = entryKey(key, record.id);
        if (storage.getItem(name) === null) {
          writeEntry(storage, name, record, false, new Map([[validate, record]]));
          created.push({ name, record, raw: cache.entries.get(name).raw });
        }
      } catch {
        migrated = false;
      }
    }
    quarantine(storage, key, rejected);
    if (migrated) {
      try {
        storage.removeItem(key);
      } catch {}
    } else if (storage.getItem(key) === legacy) {
      for (const item of created) {
        try {
          if (storage.getItem(item.name) !== item.raw) continue;
          storage.removeItem(item.name);
          cache.entries.delete(item.name);
          cache.persisted.delete(item.record);
        } catch {}
      }
    }
  }
  const keys = recordKeys(storage, key),
    present = new Set(keys);
  for (const name of cache.entries.keys())
    if (name.startsWith(`${key}:`) && !present.has(name)) cache.entries.delete(name);
  for (const name of keys) {
    try {
      const entry = readEntry(storage, name);
      if (!entry) continue;
      let record = entry.validated.get(validate);
      if (!record) {
        [record] = validate([entry.record]);
        entry.validated.set(validate, record);
      }
      cache.persisted.set(record, name);
      clean.push(record);
    } catch {
      rejected.push(storage.getItem(name));
      try {
        storage.removeItem(name);
        cache.entries.delete(name);
      } catch {}
    }
  }
  quarantine(storage, key, rejected);
  return mergeRecords(clean);
}

function saveRecords(key, records, validate) {
  const storage = globalThis.localStorage,
    cache = cacheFor(storage);
  readRecords(key, validate, storage);
  // Finished records are immutable; previously persisted objects need no replay or rewrite.
  for (const record of records) {
    if (cache.persisted.get(record) === entryKey(key, record?.id)) continue;
    const [clean] = validate([record]),
      name = entryKey(key, clean.id);
    if (!readEntry(storage, name))
      writeEntry(storage, name, clean, false, new Map([[validate, clean]]));
    cache.persisted.set(record, name);
  }
  return readRecords(key, validate, storage);
}

export function confirmRecordUploaded(game, id, owner, storage = globalThis.localStorage) {
  const key = recordKey(game),
    name = entryKey(key, id),
    entry = readEntry(storage, name);
  if (!entry || entry.record.meta?.ownerId !== owner) return;
  if (!entry.uploaded) writeEntry(storage, name, entry.record, true, entry.validated);
  const uploaded = [];
  for (const candidate of recordKeys(storage, key)) {
    try {
      const value = readEntry(storage, candidate);
      if (value?.uploaded && value.record.meta?.ownerId === owner)
        uploaded.push({ name: candidate, endedAt: value.record.endedAt });
    } catch {}
  }
  uploaded.sort((a, b) => b.endedAt.localeCompare(a.endedAt) || b.name.localeCompare(a.name));
  for (const old of uploaded.slice(uploadedCacheLimit)) {
    storage.removeItem(old.name);
    cacheFor(storage).entries.delete(old.name);
  }
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
