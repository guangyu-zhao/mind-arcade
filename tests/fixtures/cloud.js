export function createCloudFixture() {
  const state = {
    user: null,
    authCalls: [],
    dashboardCalls: [],
    submitCalls: [],
    dashboards: [],
    submissions: [],
    holdAuth: false,
    holdDashboard: false,
    holdSubmit: false,
    profileError: false,
    logoutError: false,
    data(value = 10) {
      return {
        population: {
          aggregation: 'recent-five-mean',
          histogram: [{ low: value, high: value + 5, count: 3 }],
        },
        personal: { histogram: [{ low: value, high: value + 5, count: 3 }] },
        history: [0, 1, 2].map((i) => ({
          value: value + i,
          ended_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
        })),
      };
    },
    session(id) {
      this.user = id ? { id, user_metadata: { username: id } } : null;
      this.onAuth('SIGNED_IN', this.user ? { user: this.user } : null);
    },
  };
  const request = (run) => ({
    then(resolve, reject) {
      return Promise.resolve().then(run).then(resolve, reject);
    },
    abortSignal() {
      return this;
    },
  });
  const authenticate = (method, params) => {
    state.authCalls.push({ method, params });
    return state.holdAuth
      ? new Promise((resolve) => {
          state.resolveAuth = resolve;
        })
      : Promise.resolve({ error: { code: 'invalid_credentials' } });
  };
  const client = {
    auth: {
      getSession() {
        return new Promise((resolve) => {
          state.resolveSession = resolve;
        });
      },
      onAuthStateChange(fn) {
        state.onAuth = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword(params) {
        return authenticate('login', params);
      },
      signUp(params) {
        return authenticate('register', params);
      },
      async signOut() {
        if (state.logoutError) throw Error('offline');
        state.session(null);
        return {};
      },
    },
    from(_table) {
      let id;
      const builder = {
        select() {
          return this;
        },
        eq(_field, value) {
          id = value;
          return this;
        },
        single() {
          return request(() => {
            if (state.profileError) throw Error('offline');
            return { data: { username: id } };
          });
        },
        limit() {
          return request(() => ({ data: [] }));
        },
      };
      return builder;
    },
    rpc(name, args) {
      return request(() => {
        if (name === 'ml_dashboard') {
          state.dashboardCalls.push({ args, owner: state.user?.id });
          return state.holdDashboard
            ? new Promise((resolve) => state.dashboards.push({ args, resolve }))
            : { data: state.data() };
        }
        state.submitCalls.push(args);
        return state.holdSubmit
          ? new Promise((resolve) => state.submissions.push({ args, resolve }))
          : { data: null };
      });
    },
    channel() {
      return {
        on() {
          return this;
        },
        subscribe(fn) {
          queueMicrotask(() => fn('SUBSCRIBED'));
          return this;
        },
      };
    },
    async removeChannel() {},
  };
  return { state, client };
}
