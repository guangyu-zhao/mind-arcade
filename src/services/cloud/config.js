const enabled = import.meta.env?.VITE_CLOUD_ENABLED !== 'false';
export const cloudConfig = Object.freeze({
  url: enabled
    ? import.meta.env?.VITE_SUPABASE_URL || 'https://yjzdcjiuiddhvwmcwmms.supabase.co'
    : '',
  publishableKey: enabled
    ? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_mq5B8uDh_icmElxeMK3r5w_xnYnNbgr'
    : '',
});
