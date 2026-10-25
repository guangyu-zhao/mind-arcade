import { errorKey } from './errors.js';
import { conditionKey } from '../../core/conditions.js';
export function createStatistics({ client, game, account, isRunning, onChange = () => {} }) {
  let context = null,
    snapshot = null,
    error = '',
    sequence = 0,
    busy = false,
    again = false,
    afterGame = false,
    timer,
    scheduledAt = Infinity,
    channel,
    realtime = false,
    disposed = false;
  function schedule(delay = 300) {
    if (disposed) return;
    if (isRunning()) {
      clearTimeout(timer);
      timer = undefined;
      scheduledAt = Infinity;
      afterGame = true;
      return;
    }
    const next = performance.now() + delay;
    if (timer !== undefined && scheduledAt <= next) return;
    clearTimeout(timer);
    scheduledAt = next;
    timer = setTimeout(() => {
      timer = undefined;
      scheduledAt = Infinity;
      void refresh();
    }, delay);
  }
  async function refresh() {
    if (disposed || !client || !game || !context || !account.state.ready || document.hidden) return;
    if (isRunning()) {
      afterGame = true;
      return;
    }
    if (busy) {
      again = true;
      return;
    }
    const current = context,
      epoch = account.state.epoch,
      at = ++sequence;
    busy = true;
    try {
      const result = await client
        .rpc('ml_dashboard', {
          p_game_id: game.id,
          p_version: current.rulesVersion,
          p_rules: current.rules,
          p_metric: game.metric.id,
        })
        .abortSignal(AbortSignal.timeout(15000));
      if (disposed || at !== sequence || epoch !== account.state.epoch) return;
      if (result.error) throw result.error;
      const data = result.data;
      if (
        !Array.isArray(data?.population?.histogram) ||
        !Array.isArray(data?.personal?.histogram) ||
        !Array.isArray(data?.history)
      )
        throw Error('statistics');
      snapshot = data;
      error = '';
      onChange();
    } catch (issue) {
      if (!disposed && at === sequence && epoch === account.state.epoch) {
        error = errorKey(issue);
        onChange();
      }
    } finally {
      busy = false;
      if (again && !disposed) {
        again = false;
        schedule();
      }
    }
  }
  function connect() {
    if (disposed || !client || !game) return;
    if (channel) void client.removeChannel(channel);
    realtime = false;
    const epoch = account.state.epoch;
    channel = client
      .channel(`mind-lab:${game.id}:${epoch}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ml_board_revisions',
          filter: `game_id=eq.${game.id}`,
        },
        () => {
          if (!disposed && epoch === account.state.epoch) schedule(350);
        },
      )
      .subscribe((status) => {
        if (!disposed && epoch === account.state.epoch) {
          realtime = status === 'SUBSCRIBED';
          if (realtime) schedule(0);
        }
      });
  }
  const poll = setInterval(() => {
    if (!realtime && !document.hidden) schedule(0);
  }, 30000);
  return {
    get state() {
      return { context, snapshot, error };
    },
    setContext(meta) {
      const changed = conditionKey(context) !== conditionKey(meta);
      context = { rulesVersion: meta.rulesVersion, rules: { ...meta.rules } };
      if (changed) {
        snapshot = null;
        error = '';
        sequence++;
        onChange();
        schedule();
      }
    },
    schedule,
    refresh,
    retry() {
      error = '';
      schedule(0);
    },
    changedAccount() {
      sequence++;
      snapshot = null;
      error = '';
      onChange(true);
      connect();
      schedule(0);
    },
    resume() {
      if (afterGame) {
        afterGame = false;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      sequence++;
      clearTimeout(timer);
      clearInterval(poll);
      if (channel) void client.removeChannel(channel);
    },
  };
}
