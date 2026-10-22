import { createClient } from '@supabase/supabase-js';
import { currentGame } from '../../catalog.js';
import { cloudConfig } from './config.js';
import { createAccount } from './account.js';
import { createScoreQueue, pendingPrefix } from './queue.js';
import { createStatistics, contextKey } from './statistics.js';
import { mountCloudView } from '../../ui/cloud/view.js';
import { connectScores } from '../../core/lifecycle.js';

/** Compose account, synchronization and statistics services; tests can inject a client. */
export function mountCloud({
  config = cloudConfig,
  game = currentGame(),
  client = config?.publishableKey
    ? createClient(config.url, config.publishableKey, {
        auth: { storageKey: 'mind-lab.auth.v1', detectSessionInUrl: false },
      })
    : null,
} = {}) {
  const isRunning = () => document.body.classList.contains('running');
  const account = createAccount(client, config);
  let view,
    statistics,
    epoch = -1;
  const queue = createScoreQueue({
    client,
    account,
    isRunning,
    onChange: () => view?.renderStatus(),
    onUpload: () => statistics?.schedule(100),
  });
  statistics = createStatistics({
    client,
    game,
    account,
    isRunning,
    onChange: (force) => view?.renderData(force),
  });
  const retry = () => {
    if (account.state.error) void account.restore();
    queue.retry();
    statistics.retry();
  };
  view = mountCloudView({ game, account, queue, statistics, isRunning, retry });
  const unsubscribe = account.subscribe((state) => {
    if (state.epoch !== epoch) {
      epoch = state.epoch;
      view.closeAccount();
      statistics.changedAccount();
      queue.changedAccount();
    }
    view.renderAccount();
    view.renderStatus();
  });
  const lifecycle = new MutationObserver(() => {
    view.renderAccount();
    if (isRunning()) view.closeAccount();
    else {
      view.resume();
      statistics.resume();
      void queue.flush();
    }
  });
  lifecycle.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const online = () => {
    void queue.flush();
    statistics.schedule(0);
  };
  const visibility = () => {
    if (!document.hidden) online();
  };
  const storage = (event) => {
    if (event.key?.startsWith(pendingPrefix)) {
      view.renderStatus();
      void queue.flush();
    }
  };
  window.addEventListener('online', online);
  window.addEventListener('storage', storage);
  document.addEventListener('visibilitychange', visibility);
  const service = {
    get userId() {
      return account.state.user?.id || null;
    },
    setContext: statistics.setContext,
    begin: queue.begin,
    previousScores(meta) {
      const { context, snapshot, error } = statistics.state;
      if (error || !snapshot || contextKey(context) !== contextKey(meta)) return null;
      return snapshot.history.map((row) => ({ score: row.value, endedAt: row.ended_at }));
    },
    submit(record, owner) {
      if (record?.meta?.rulesVersion === statistics.state.context?.rulesVersion)
        queue.submit(game?.id, record, owner);
    },
    dispose() {
      unsubscribe();
      lifecycle.disconnect();
      window.removeEventListener('online', online);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
      account.dispose();
      queue.dispose();
      statistics.dispose();
      view.dispose();
      connectScores({ userId: null, submit() {}, setContext() {} });
    },
  };
  connectScores(service);
  void account.restore();
  return service;
}
