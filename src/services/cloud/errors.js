export function errorKey(error) {
  const code = error?.code || '',
    message = error?.message || '';
  if (code === 'invalid_credentials') return 'badLogin';
  if (['user_already_exists', 'email_exists'].includes(code)) return 'exists';
  if (/rate|429/.test(code + message)) return 'tooMany';
  if (['PGRST202', 'PGRST205', '42P01'].includes(code)) return 'setup';
  if (message === 'unsupported_rules') return 'rulesUpdate';
  if (code === 'statistics_update') return 'statisticsUpdate';
  if (
    ['email_not_confirmed', 'registration_unavailable', 'unexpected_failure'].includes(code) ||
    /confirmation/i.test(message)
  )
    return 'authSetup';
  if (code === 'weak_password') return 'passwordHint';
  if (code === 'PGRST301' || code === '28000') return 'sessionExpired';
  return 'offline';
}
