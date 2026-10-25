import { Core } from '../../../core/index.js';
const shuffle = Core.shuffle;
const SIZES = Object.freeze([4, 6]);
const COUNTS = Object.freeze([2, 4, 6]);
const DEFAULTS = Object.freeze({
  size: 4,
  flashCount: 2,
  symmetryInterference: false,
  sequenceInterference: false,
  order: 'forward',
  transform: 'original',
});
const MEMORY_FLASH_MS = 350,
  MEMORY_GAP_MS = 150;
const TIMING = Object.freeze({
  flashMs: 550,
  gapMs: 200,
  blankMs: 250,
  decisionMs: 4000,
  memoryMs: MEMORY_FLASH_MS * 2 + MEMORY_GAP_MS,
  memoryFlashMs: MEMORY_FLASH_MS,
  memoryGapMs: MEMORY_GAP_MS,
});
const allCells = (size) => Array.from({ length: size * size }, (_, index) => index);
const validCell = (value, size) => Number.isInteger(value) && value >= 0 && value < size * size;
const mirror = (index, size, axis) =>
  axis === 'top-bottom'
    ? (size - 1 - Math.floor(index / size)) * size + (index % size)
    : Math.floor(index / size) * size + size - 1 - (index % size);

function readRules(value) {
  const size = value?.size;
  if (
    !value ||
    !SIZES.includes(size) ||
    !(COUNTS.includes(value.flashCount) || value.flashCount === 'random') ||
    typeof value.symmetryInterference !== 'boolean' ||
    typeof value.sequenceInterference !== 'boolean' ||
    !['forward', 'reverse'].includes(value.order) ||
    !['original', 'rotated', 'counterclockwise'].includes(value.transform)
  )
    throw Error('rules');
  return {
    size,
    flashCount: value.flashCount,
    symmetryInterference: value.symmetryInterference,
    sequenceInterference: value.sequenceInterference,
    order: value.order,
    transform: value.transform,
  };
}
const sameRules = (a, b) => JSON.stringify(readRules(a)) === JSON.stringify(readRules(b));
function isSymmetric(positions, size = 4, axis = 'left-right') {
  const union = new Set(positions);
  return [...union].every((index) => union.has(mirror(index, size, axis)));
}
function accepts(positions, response, size) {
  const leftRight = isSymmetric(positions, size, 'left-right');
  const topBottom = isSymmetric(positions, size, 'top-bottom');
  return response === 'left-right'
    ? leftRight
    : response === 'top-bottom'
      ? topBottom
      : response === 'neither' && !leftRight && !topBottom;
}
function pattern(count, size, random) {
  if (!COUNTS.includes(count) || !SIZES.includes(size)) throw Error('pattern size');
  const kinds =
    count === 4
      ? ['left-right', 'top-bottom', 'neither', 'both']
      : ['left-right', 'top-bottom', 'neither'];
  const kind = kinds[Math.floor(random() * kinds.length)],
    cells = allCells(size);
  if (kind === 'both') {
    const corner = shuffle(
      cells.filter((index) => index % size < size / 2 && Math.floor(index / size) < size / 2),
      random,
    )[0];
    const leftRight = mirror(corner, size, 'left-right');
    return shuffle(
      [
        corner,
        leftRight,
        mirror(corner, size, 'top-bottom'),
        mirror(leftRight, size, 'top-bottom'),
      ],
      random,
    );
  }
  const axis = kind === 'neither' ? (random() < 0.5 ? 'left-right' : 'top-bottom') : kind;
  const half = shuffle(
    cells.filter((index) => index < mirror(index, size, axis)),
    random,
  );
  const paired = (values) => values.flatMap((index) => [index, mirror(index, size, axis)]);
  const selected = half.slice(0, count / 2);
  let positions = paired(selected);
  if (kind === 'neither') {
    const unused = shuffle(
      cells.filter((index) => !positions.includes(index)),
      random,
    );
    const candidates = shuffle(
      positions.map((_, index) => index),
      random,
    ).flatMap((index) =>
      unused.map((cell) => positions.map((value, i) => (i === index ? cell : value))),
    );
    positions = candidates.find((values) => accepts(values, 'neither', size));
  } else {
    const otherAxis = axis === 'left-right' ? 'top-bottom' : 'left-right';
    if (isSymmetric(positions, size, otherAxis)) {
      positions = half
        .slice(count / 2)
        .map((cell) => paired([...selected.slice(1), cell]))
        .find((values) => !isSymmetric(values, size, otherAxis));
    }
  }
  if (!positions) throw Error('pattern generation');
  return shuffle(positions, random);
}
function streams(count, interference, size, random = Math.random) {
  if (count === 'random') count = COUNTS[Math.floor(random() * COUNTS.length)];
  const targets = pattern(count, size, random);
  if (!interference) return { targets, distractors: Array(count).fill(null) };
  const other = pattern(count, size, random);
  // Each color has its own pattern; simultaneous flashes must occupy different cells.
  function match(index, remaining) {
    if (index === count) return [];
    for (const cell of remaining) {
      if (cell === targets[index]) continue;
      const rest = match(
        index + 1,
        remaining.filter((value) => value !== cell),
      );
      if (rest) return [cell, ...rest];
    }
    return null;
  }
  return { targets, distractors: match(0, other) };
}
function otherCell(target, size, random = Math.random) {
  const value = Math.floor(random() * (size * size - 1));
  return value >= target ? value + 1 : value;
}
function expected(positions, rules) {
  const size = readRules(rules).size;
  const rotate = (index) => (index % size) * size + size - 1 - Math.floor(index / size);
  const rotateCounterclockwise = (index) =>
    (size - 1 - (index % size)) * size + Math.floor(index / size);
  const values =
    rules.transform === 'rotated'
      ? positions.map(rotate)
      : rules.transform === 'counterclockwise'
        ? positions.map(rotateCounterclockwise)
        : [...positions];
  return rules.order === 'reverse' ? values.reverse() : values;
}
function plan(level, options, timing) {
  if (!Number.isSafeInteger(level) || level < 1) throw Error('level');
  return { level, condition: String(level), length: level, rules: readRules(options), ...timing };
}
const levelPlan = (level, options = DEFAULTS) => plan(level, options, TIMING);
const SymmetryPlusRules = Object.freeze({
  SIZES,
  COUNTS,
  DEFAULTS,
  TIMING,
  readRules,
  sameRules,
  validCell,
  isSymmetric,
  accepts,
  streams,
  otherCell,
  expected,
  levelPlan,
});
export { SymmetryPlusRules };
