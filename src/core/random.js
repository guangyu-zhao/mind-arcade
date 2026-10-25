export const elapsed = (started, now = performance.now()) => Math.max(0, now - started);
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sampleSequence(options, length, random = Math.random) {
  if (!options.length || !Number.isSafeInteger(length) || length < 1) throw Error('sequence');
  if (length > 1 && new Set(options).size < 2) throw Error('distinct sequence options required');
  const sequence = [];
  for (let i = 0; i < length; i++) sequence.push(pickDifferent(options, sequence.at(-1), random));
  return sequence;
}

export function pickDifferent(options, previous, random = Math.random) {
  const choices = options.filter((item) => item !== previous);
  if (!choices.length) throw Error('no distinct option');
  return choices[Math.floor(random() * choices.length)];
}

export function visualRound(bank, length, categories, members, random = Math.random) {
  const groups = new Map();
  for (const item of bank) {
    const family = item.category || item.family || item.id;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(item.id);
  }
  const available = [...groups.values()].filter((group) => group.length >= members);
  if (available.length < categories) throw Error('insufficient visual choices');
  const candidates = shuffle(
    shuffle(available, random)
      .slice(0, categories)
      .flatMap((group) => shuffle(group, random).slice(0, members)),
    random,
  );
  return { candidates, sequence: sampleSequence(candidates, length, random) };
}
