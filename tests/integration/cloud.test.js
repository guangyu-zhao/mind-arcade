import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudFixture } from '../fixtures/cloud.js';
import { createAccount, identity, normalizeUsername } from '../../src/services/cloud/account.js';
import { createScoreQueue, pendingPrefix } from '../../src/services/cloud/queue.js';
import { createStatistics, contextKey } from '../../src/services/cloud/statistics.js';
import { gamesById } from '../../src/catalog.js';
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const store = () => {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
const context = (size = 3) => ({
  rulesVersion: 'sequence-memory-1',
  rules: { mode: 'prefix', order: 'forward', size },
});
test('username identity remains compatible with existing accounts', async () => {
  assert.equal(normalizeUsername(' Ａlice '), 'Alice');
  assert.equal(await identity('Alice'), await identity('alice'));
  assert.equal(
    await identity('Alice'),
    '2bd806c97f0e00af1a1fc3328fa763a9269723c8db8fac4f93af71db186d6e90@users.mind-lab.invalid',
  );
});
test('a late initial session cannot replace a newer auth event', async () => {
  const { state, client } = createCloudFixture(),
    account = createAccount(client, {});
  const restoring = account.restore();
  state.session('alice');
  await tick();
  state.resolveSession({ data: { session: null } });
  await restoring;
  assert.equal(account.state.user.id, 'alice');
  assert.equal(account.state.profile.username, 'alice');
  state.profileError = true;
  state.session('bob');
  await tick();
  assert.equal(account.state.user.id, 'bob');
  assert.equal(account.state.error, 'offline');
  state.profileError = false;
  const retry = account.restore();
  state.resolveSession({ data: { session: { user: state.user } } });
  await retry;
  assert.equal(account.state.profile.username, 'bob');
  account.dispose();
});
test('queue is owner-scoped, deduplicates pending runs and survives storage failures', async () => {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: { id: 'alice' }, epoch: 1 } },
    storage = store();
  let running = true;
  const queue = createScoreQueue({ client, account, storage, isRunning: () => running });
  const record = { id: 'a', meta: context(), score: 1 };
  queue.submit('sequence-memory', record, 'alice');
  queue.submit('sequence-memory', record, 'alice');
  assert.equal(queue.state.waiting, 1);
  assert.equal(state.submitCalls.length, 0);
  account.state = { ...account.state, user: { id: 'bob' }, epoch: 2 };
  queue.changedAccount();
  assert.equal(queue.state.waiting, 0);
  assert.equal(storage.length, 1);
  account.state = { ...account.state, user: { id: 'alice' }, epoch: 3 };
  running = false;
  await queue.flush();
  assert.equal(state.submitCalls.length, 1);
  assert.equal(storage.length, 0);
  queue.submit('sequence-memory', { ...record, status: 'interrupted' }, 'alice');
  assert.equal(queue.state.waiting, 0);
  queue.dispose();
  const broken = {
    get length() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  running = true;
  const volatile = createScoreQueue({ client, account, storage: broken, isRunning: () => running });
  volatile.submit('sequence-memory', record, 'alice');
  assert.equal(volatile.state.unavailable, true);
  assert.equal(volatile.state.waiting, 1);
  running = false;
  await volatile.flush();
  assert.equal(volatile.state.waiting, 0);
  volatile.dispose();
});
test('queue retains failures and retries without sending another account records', async () => {
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: { id: 'alice' }, epoch: 1 } },
    storage = store();
  state.holdSubmit = true;
  const queue = createScoreQueue({ client, account, storage, isRunning: () => false });
  queue.submit('sequence-memory', { id: 'a', meta: context() }, 'alice');
  assert.equal(queue.state.latest.status, 'pending');
  await tick();
  state.submissions[0].resolve({ error: { code: 'P0001', message: 'invalid_record' } });
  await tick();
  assert.equal(queue.state.failed, 1);
  assert.equal(queue.state.latest.status, 'failed');
  assert.equal(storage.length, 1);
  state.holdSubmit = false;
  queue.retry();
  await tick();
  assert.equal(queue.state.failed, 0);
  assert.equal(storage.length, 0);
  assert.equal(queue.state.latest.status, 'synced');
  account.state.user = { id: 'bob' };
  assert.equal(queue.state.latest, null);
  account.state.user = { id: 'alice' };
  assert.equal(queue.state.latest.status, 'synced');
  queue.begin();
  assert.equal(queue.state.latest, null);
  queue.dispose();
  assert.equal(pendingPrefix, 'mind-arcade.pending:');
});
test('blocked access to localStorage keeps the score queue usable in memory', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage blocked', 'SecurityError');
    },
  });
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: { id: 'alice' }, epoch: 1 } };
  let running = true;
  const queue = createScoreQueue({ client, account, isRunning: () => running });
  try {
    queue.submit('sequence-memory', { id: 'blocked-storage', meta: context() }, 'alice');
    assert.equal(queue.state.waiting, 1);
    assert.equal(queue.state.unavailable, true);
    running = false;
    await queue.flush();
    assert.equal(state.submitCalls.length, 1);
    assert.equal(queue.state.waiting, 0);
  } finally {
    queue.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
test('statistics resume when a scheduled refresh encounters a game that just started', async () => {
  globalThis.document = { hidden: false };
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: null, epoch: 1 } };
  let running = false;
  const stats = createStatistics({
    client,
    game: gamesById.get('sequence-memory'),
    account,
    isRunning: () => running,
  });
  try {
    stats.setContext(context());
    stats.schedule(0);
    running = true;
    await tick();
    assert.equal(state.dashboardCalls.length, 0);
    running = false;
    stats.resume();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(state.dashboardCalls.length, 1);
    assert.ok(stats.state.snapshot);
  } finally {
    stats.dispose();
    delete globalThis.document;
  }
});
test('switching statistics variants clears an error from the previous variant', async () => {
  globalThis.document = { hidden: false };
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: null, epoch: 1 } };
  state.holdDashboard = true;
  const stats = createStatistics({
    client,
    game: gamesById.get('sequence-memory'),
    account,
    isRunning: () => false,
  });
  try {
    stats.setContext(context());
    const request = stats.refresh();
    await tick();
    state.dashboards[0].resolve({ error: { code: 'PGRST205' } });
    await request;
    assert.equal(stats.state.error, 'setup');
    stats.setContext(context(4));
    assert.equal(stats.state.error, '');
    assert.equal(stats.state.snapshot, null);
  } finally {
    stats.dispose();
    delete globalThis.document;
  }
});
test('frequent score updates do not postpone statistics indefinitely', async () => {
  globalThis.document = { hidden: false };
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: null, epoch: 1 } };
  const stats = createStatistics({
    client,
    game: gamesById.get('sequence-memory'),
    account,
    isRunning: () => false,
  });
  let updates;
  try {
    stats.setContext(context());
    stats.schedule(40);
    updates = setInterval(() => stats.schedule(40), 5);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(state.dashboardCalls.length > 0);
    clearInterval(updates);
    const before = state.dashboardCalls.length;
    stats.schedule(0);
    await tick();
    assert.ok(state.dashboardCalls.length > before);
  } finally {
    clearInterval(updates);
    stats.dispose();
    delete globalThis.document;
  }
});
test('statistics discard stale settings and accounts, clear personal data immediately, defer during play', async () => {
  globalThis.document = { hidden: false };
  const { state, client } = createCloudFixture(),
    account = { state: { ready: true, user: { id: 'alice' }, epoch: 1 } };
  let running = false;
  state.holdDashboard = true;
  const stats = createStatistics({
    client,
    game: gamesById.get('sequence-memory'),
    account,
    isRunning: () => running,
  });
  try {
    stats.setContext(context());
    const old = stats.refresh();
    await tick();
    stats.setContext(context(4));
    state.dashboards[0].resolve({ data: state.data(1) });
    await old;
    assert.equal(stats.state.snapshot, null);
    const next = stats.refresh();
    await tick();
    state.dashboards[1].resolve({ data: state.data(20) });
    await next;
    assert.equal(stats.state.snapshot.history[0].value, 20);
    account.state = { ...account.state, user: { id: 'bob' }, epoch: 2 };
    stats.changedAccount();
    assert.equal(stats.state.snapshot, null);
    running = true;
    stats.schedule(0);
    await tick();
    assert.equal(state.dashboardCalls.length, 2);
    running = false;
    state.holdDashboard = false;
    stats.resume();
    await stats.refresh();
    assert.equal(stats.state.snapshot.history[0].value, 10);
    assert.equal(
      contextKey(context()),
      contextKey({ ...context(), rules: { size: 3, order: 'forward', mode: 'prefix' } }),
    );
  } finally {
    stats.dispose();
    delete globalThis.document;
  }
});
