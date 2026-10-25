import { errorKey } from './errors.js';

export function normalizeUsername(value) {
  return value.normalize('NFKC').trim();
}
export async function identity(username) {
  const key = normalizeUsername(username).replace(/[A-Z]/g, (c) => c.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return (
    [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('') +
    '@users.mind-lab.invalid'
  );
}
export function createAccount(client, config) {
  let state = { user: null, profile: null, ready: false, epoch: 0, error: '' },
    revision = 0;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener(state));
  async function apply(session) {
    const user = session?.user || null;
    if (state.ready && state.user?.id === user?.id) {
      state = { ...state, user };
      return;
    }
    const epoch = state.epoch + 1;
    state = { user, profile: null, ready: true, epoch, error: '' };
    emit();
    if (!user) return;
    try {
      const { data, error } = await client
        .from('ml_profiles')
        .select('username')
        .eq('id', user.id)
        .single()
        .abortSignal(AbortSignal.timeout(15000));
      if (state.epoch !== epoch) return;
      if (error) throw error;
      state = { ...state, profile: data };
    } catch (error) {
      if (state.epoch !== epoch) return;
      state = { ...state, error: errorKey(error) };
    }
    emit();
  }
  async function restore() {
    if (state.error) state = { ...state, ready: false, error: '' };
    if (!client) {
      state = { ...state, ready: true, error: 'setup' };
      emit();
      return;
    }
    const at = revision;
    try {
      const { data, error } = await client.auth.getSession();
      if (at !== revision) return;
      await apply(data.session);
      if (error && at === revision) {
        state = { ...state, error: errorKey(error) };
        emit();
      }
    } catch {
      if (at === revision) {
        state = { ...state, ready: true, error: 'offline' };
        emit();
      }
    }
  }
  async function authenticate(mode, username, password) {
    if (!client) throw { code: 'PGRST205' };
    if (mode === 'register') {
      const { error } = await client
        .from('ml_board_revisions')
        .select('game_id')
        .limit(1)
        .abortSignal(AbortSignal.timeout(15000));
      if (error) throw error;
      const response = await fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.publishableKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error('auth_settings');
      const settings = await response.json();
      if (!settings.mailer_autoconfirm || settings.disable_signup || !settings.external?.email)
        throw { code: 'registration_unavailable' };
    }
    const email = await identity(username);
    const { data, error } =
      mode === 'register'
        ? await client.auth.signUp({ email, password, options: { data: { username } } })
        : await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw { code: 'registration_unavailable' };
    return data.session;
  }
  const subscription = client?.auth.onAuthStateChange((_event, session) => {
    const at = ++revision;
    setTimeout(() => {
      if (at === revision) void apply(session);
    }, 0);
  }).data?.subscription;
  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore,
    authenticate,
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    dispose() {
      revision++;
      subscription?.unsubscribe();
      listeners.clear();
    },
  };
}
