import { gamesById } from '../../catalog.js';
import { errorKey } from './errors.js';
import { confirmRecordUploaded } from '../../core/records.js';
export const pendingPrefix = 'mind-arcade.pending:';
export function createScoreQueue({
  client,
  account,
  isRunning,
  onChange = () => {},
  onUpload = () => {},
  storage,
}) {
  const memory = new Map(),
    dirty = new Set(),
    cleanupKeys = new Set(),
    uploadedKeys = new Set();
  let unavailable = false,
    flushing = false,
    error = '',
    timer,
    latest = null,
    disposed = false;
  try {
    storage ??= globalThis.localStorage;
  } catch {
    unavailable = true;
  }
  let channel;
  try {
    if (typeof window !== 'undefined' && typeof BroadcastChannel === 'function')
      channel = new BroadcastChannel('mind-arcade.scores');
  } catch {}
  function acceptUpload(key) {
    if (typeof key !== 'string' || !key.startsWith(pendingPrefix)) return false;
    const [owner, game, id, extra] = key.slice(pendingPrefix.length).split(':');
    if (!owner || !gamesById.has(game) || !/^[\w-]{1,100}$/.test(id || '') || extra !== undefined)
      return false;
    uploadedKeys.add(key);
    cleanupKeys.add(key);
    memory.delete(key);
    dirty.delete(key);
    if (latest?.key === key) latest.status = 'synced';
    try {
      confirmRecordUploaded(game, id, owner, storage);
    } catch {}
    if (owner === account.state.user?.id) error = '';
    return true;
  }
  if (channel)
    channel.onmessage = (event) => {
      if (!disposed && acceptUpload(event.data?.uploaded)) {
        onChange();
        onUpload();
      }
    };
  function entries() {
    const all = new Map(memory);
    try {
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const key of keys) {
        if (!key?.startsWith(pendingPrefix) || uploadedKeys.has(key)) continue;
        try {
          const item = JSON.parse(storage.getItem(key));
          if (item?.uploaded === true) {
            acceptUpload(key);
            all.delete(key);
            continue;
          }
          if (!all.has(key) && item?.owner && item.record && gamesById.has(item.game))
            all.set(key, item);
        } catch {}
      }
    } catch {
      unavailable = true;
    }
    return [...all].filter(
      ([key, item]) => !uploadedKeys.has(key) && item.owner === account.state.user?.id,
    );
  }
  function store(key, item) {
    if (uploadedKeys.has(key)) return;
    memory.set(key, item);
    if (latest?.key === key) latest.status = item.error ? 'failed' : 'pending';
    try {
      storage.setItem(key, JSON.stringify(item));
      dirty.delete(key);
    } catch {
      dirty.add(key);
      unavailable = true;
    }
  }
  function removeUploaded(key) {
    try {
      storage.removeItem(key);
      cleanupKeys.delete(key);
    } catch {
      unavailable = true;
      try {
        storage.setItem(key, JSON.stringify({ uploaded: true }));
      } catch {}
    }
  }
  async function flush() {
    const { user, ready, epoch } = account.state;
    if (disposed || flushing || !client || !user || !ready || !navigator.onLine || isRunning())
      return;
    let uploaded = false;
    flushing = true;
    onChange();
    try {
      for (const key of cleanupKeys) removeUploaded(key);
      for (const [key, item] of entries()) {
        if (account.state.epoch !== epoch || account.state.user?.id !== user.id || isRunning())
          break;
        if (item.error || uploadedKeys.has(key)) continue;
        const result = await client
          .rpc('ml_submit', { p_game_id: item.game, p_record: item.record, p_owner: item.owner })
          .abortSignal(AbortSignal.timeout(15000));
        if (uploadedKeys.has(key)) continue;
        if (result.error) {
          const issue = result.error;
          if (
            (issue.code === 'P0001' && issue.message !== 'rate_limited') ||
            /^(22|23)/.test(issue.code || '')
          )
            store(key, { ...item, error: issue.message });
          else if (account.state.epoch === epoch) error = errorKey(issue);
          break;
        }
        acceptUpload(key);
        try {
          storage.setItem(key, JSON.stringify({ uploaded: true }));
        } catch {}
        try {
          channel?.postMessage({ uploaded: key });
        } catch {}
        removeUploaded(key);
        uploaded = true;
        if (latest?.key === key) latest.status = 'synced';
        if (account.state.epoch === epoch) error = '';
      }
    } catch {
      if (account.state.epoch === epoch) error = 'offline';
    } finally {
      flushing = false;
      if (!disposed) {
        onChange();
        if (account.state.epoch === epoch && uploaded) onUpload();
        clearTimeout(timer);
        if (entries().some(([, item]) => !item.error))
          timer = setTimeout(flush, account.state.epoch === epoch ? 15000 : 0);
      }
    }
  }
  return {
    get state() {
      const all = entries();
      return {
        waiting: all.filter(([, item]) => !item.error).length,
        failed: all.filter(([, item]) => item.error).length,
        flushing,
        error: all.some(([, item]) => item.error === 'unsupported_rules') ? 'rulesUpdate' : error,
        unavailable,
        latest: latest?.owner === account.state.user?.id ? latest : null,
      };
    },
    submit(game, record, owner) {
      if (
        !game ||
        !owner ||
        !record?.meta ||
        record.status === 'interrupted' ||
        (record.status === 'stopped' && !record.trials?.length)
      )
        return;
      const key = `${pendingPrefix}${owner}:${game}:${record.id}`;
      if (uploadedKeys.has(key)) {
        latest = { key, owner, status: 'synced' };
        onChange();
        return;
      }
      latest = { key, owner, status: 'pending' };
      store(key, { owner, game, record });
      onChange();
      void flush();
    },
    flush,
    storageChanged(event) {
      if (disposed || !event.key?.startsWith(pendingPrefix)) return;
      try {
        const value = JSON.parse(event.newValue ?? event.oldValue);
        if (value?.uploaded === true && acceptUpload(event.key)) onUpload();
        else if (
          event.newValue &&
          !dirty.has(event.key) &&
          !uploadedKeys.has(event.key) &&
          value?.owner &&
          value.record &&
          gamesById.has(value.game)
        ) {
          if (memory.has(event.key)) memory.set(event.key, value);
          if (latest?.key === event.key) latest.status = value.error ? 'failed' : 'pending';
        }
      } catch {}
      onChange();
      void flush();
    },
    begin() {
      latest = null;
      onChange();
    },
    retry() {
      for (const [key, item] of entries()) {
        const next = { ...item };
        delete next.error;
        store(key, next);
      }
      error = '';
      void flush();
    },
    changedAccount() {
      error = '';
      onChange();
      void flush();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      channel?.close();
    },
  };
}
