export function conditionKey(meta) {
  return meta
    ? JSON.stringify([
        meta.rulesVersion,
        Object.entries(meta.rules).sort(([a], [b]) => a.localeCompare(b)),
      ])
    : '';
}
