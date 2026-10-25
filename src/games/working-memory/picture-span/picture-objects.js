import { PictureArt } from './picture-variants.js';
const { P, L, C, E, R, G, B, N, I, W, Y, Q, V, D, F, A, H, T, eye, wheel, motif, add } = PictureArt;
function object(id, label, render) {
  add(id, label, render);
}
const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const stem = (x = 48, y = 17) => L(`M${x} ${y}q-3-9 5-12`, W, 4) + E(x + 10, y - 7, 10, 4, V, -30);
const spots = (color = W) => motif(36, 48, 23, 18, color);

const mammals = {
  elephant: [B, 'round', 'trunk'],
  giraffe: [Y, 'horn', 'spots'],
  lion: [Y, 'round', 'mane'],
  tiger: [T, 'round', 'stripes'],
  bear: [W, 'round', 'muzzle'],
  panda: [I, 'round', 'panda'],
  fox: [T, 'point', 'mask'],
  wolf: [B, 'point', 'mask'],
  deer: [T, 'antler', 'muzzle'],
  horse: [W, 'long', 'blaze'],
  cow: [I, 'horn', 'patch'],
  pig: [H, 'point', 'snout'],
  sheep: [I, 'round', 'wool'],
  goat: [Q, 'horn', 'beard'],
  monkey: [W, 'round', 'mask'],
  camel: [T, 'round', 'camel'],
  kangaroo: [T, 'long', 'kangaroo'],
  zebra: [I, 'long', 'stripes'],
  hippo: [B, 'round', 'snout'],
  rhino: [B, 'point', 'horn'],
};
function animalHead(kind) {
  const [color, ears, mark] = mammals[kind];
  let out =
    ears === 'long'
      ? E(31, 14, 7, 17, color, -18) + E(65, 14, 7, 17, color, 18)
      : ears === 'point'
        ? P('m22 33 2-27 23 16m7 0L73 6l2 28Z', color)
        : C(25, 22, 12, color) + C(71, 22, 12, color);
  if (mark === 'mane')
    out += P(
      'm48 3 11 7 13-1 3 13 12 8-5 13 4 13-12 9-6 14-13-2-12 7-10-10-14 1-3-15-11-10 6-13-3-14 13-7 6-12Z',
      W,
    );
  out +=
    mark === 'camel'
      ? E(48, 43, 20, 29, color) + P('M33 20q4-17 11-8 6-12 12 6Z', color)
      : mark === 'kangaroo'
        ? P('M25 23Q48 11 71 23L65 53 48 68 31 53Z', color)
        : E(48, 40, 25, 27, color);
  if (ears === 'horn') out += L('M31 20 25 7m39 13 7-13', W, 5);
  if (ears === 'antler') out += L('M31 23 22 10V2m0 10-10-4m52 15 10-13V2m0 10 10-4', W, 3);
  if (mark === 'panda')
    out +=
      E(35, 35, 10, 13, N, 25) + E(62, 35, 10, 13, N, -25) + C(25, 20, 10, N) + C(71, 20, 10, N);
  if (mark === 'mask') out += P('M24 31 45 40l3 19 3-19 22-9-7 23-18 12-19-12Z', Q);
  if (mark === 'patch') out += P('M26 22q25-9 17 20l-15 3Z', N) + E(63, 24, 9, 12, N);
  if (mark === 'spots') out += C(48, 20, 6, W) + P('m25 40 9 6-5 9-7-5Zm33 7 12-3-2 13-9-4Z', W);
  if (mark === 'stripes') out += L('M31 23 40 29m22-6-9 6M24 39l12 5m37-5-12 5M45 16v11', N, 4);
  if (mark === 'blaze') out += P('M42 16h11l-3 36-8-2Z', Q);
  if (mark === 'wool') out += repeat(5, (i) => C(24 + i * 12, 21 + (i % 2) * 5, 10, I));
  out += E(
    48,
    54,
    mark === 'snout' ? 22 : mark === 'camel' ? 20 : 15,
    mark === 'snout' ? 13 : 10,
    mark === 'panda' ? I : Q,
  );
  out += eye(35, 35) + eye(61, 35);
  if (mark === 'trunk')
    out +=
      E(21, 39, 13, 21, B) +
      E(75, 39, 13, 21, B) +
      L('M48 51v22q0 18 17 6', B, 12) +
      P('m35 55 2 14 6-13m10 0 5 13 2-14Z', Q);
  else if (mark === 'horn') out += P('M47 58 60 37l-1 25Z', Q);
  else out += E(48, 52, 7, 5, mark === 'snout' ? T : N) + L('M48 57v5m0 0-6 2m6-2 6 2', W, 2);
  if (mark === 'beard') out += P('m37 62 11 21 10-21Z', W);
  if (mark === 'snout') out += C(41, 53, 2, W) + C(55, 53, 2, W);
  return out;
}
function mammal(kind, f) {
  const color = mammals[kind][0],
    head = animalHead(kind);
  const coat =
    kind === 'zebra'
      ? L('M27 44 33 68m6-28 6 29m9-29 5 22', N, 4)
      : ['giraffe', 'cow', 'tiger'].includes(kind)
        ? spots(kind === 'tiger' ? N : W)
        : '';
  if (f === 1) return G(head, 'translate(1 5) scale(.98)') + P('M28 68q20 12 40 0l8 21H20Z', color);
  if (f === 3) {
    const detail =
      kind === 'camel'
        ? P('M20 62Q14 36 32 42l14 27Z', color)
        : kind === 'kangaroo'
          ? P('M30 68Q9 85 4 88h33Z', color) + P('M37 62q11 9 23 0l-5 15H42Z', Q)
          : '';
    return (
      detail +
      E(48, 64, 22, 25, color) +
      E(31, 84, 12, 6, color) +
      E(66, 84, 12, 6, color) +
      G(head, 'translate(13 1) scale(.72)') +
      L('M39 66v18m19-18v18', W, 2) +
      (kind === 'kangaroo' ? P('M37 65q11 9 23 0l-5 13H42Z', Q) : '')
    );
  }
  const running = f === 2,
    grazing = f === 4;
  let body = E(43, 56, 29, 18, color);
  if (kind === 'camel') body += P('M19 48Q24 10 43 42 61 4 70 49Z', color);
  if (kind === 'giraffe') body += P('M56 55 57 15h13l4 39Z', color);
  if (kind === 'kangaroo') body += P('M33 58Q8 67 4 87q29-4 45-19Z', color);
  if (kind === 'sheep') body += repeat(6, (i) => C(18 + i * 10, 51 + (i % 2) * 10, 12, I));
  const legs = running
    ? L('m23 63-13 14m24-10 10 18m16-22 18 10m-9-9 17-12', color, 8)
    : L('M23 64v20m11-18v16m25-17v19m10-20v18', color, 8);
  const tail =
    kind === 'pig' ? L('M16 49q-15-11-7 1 6 8 8-3', T, 3) : L('M18 48Q3 32 9 22', color, 5);
  const face =
    kind === 'giraffe'
      ? G(head, 'translate(48 -3) scale(.43)')
      : grazing
        ? G(head, 'translate(47 34) rotate(24 20 20) scale(.48)')
        : G(head, 'translate(47 1) scale(.48)');
  body = tail + legs + body + coat + face;
  return running ? G(body, 'translate(96 0) scale(-1 1)') : body;
}
[
  ['elephant', 'object.elephant'],
  ['giraffe', 'object.giraffe'],
  ['lion', 'object.lion'],
  ['tiger', 'object.tiger'],
  ['bear', 'object.bear'],
  ['panda', 'object.panda'],
  ['fox', 'object.fox'],
  ['wolf', 'object.wolf'],
  ['deer', 'object.deer'],
  ['horse', 'object.horse'],
  ['cow', 'object.cow'],
  ['pig', 'object.pig'],
  ['sheep', 'object.sheep'],
  ['goat', 'object.goat'],
  ['monkey', 'object.monkey'],
  ['camel', 'object.camel'],
  ['kangaroo', 'object.kangaroo'],
  ['zebra', 'object.zebra'],
  ['hippo', 'object.hippopotamus'],
  ['rhino', 'object.rhinoceros'],
].forEach(([id, zh]) => object(id, zh, (f) => mammal(id, f)));

function avian(kind, f) {
  const color = {
    penguin: N,
    owl: W,
    duck: Y,
    goose: I,
    chicken: Q,
    rooster: T,
    peacock: V,
    flamingo: A,
    eagle: W,
    parrot: V,
  }[kind];
  const long = ['goose', 'flamingo'].includes(kind),
    flying = f === 2 || f === 4;
  let bird = '';
  if (kind === 'peacock')
    bird = repeat(f === 1 ? 9 : 5, (i) =>
      G(
        E(48, 31, 10, 32, V) + E(48, 15, 5, 8, B) + C(48, 15, 3, Y),
        `rotate(${(i - (f === 1 ? 4 : 2)) * 18} 48 69)`,
      ),
    );
  if (f === 1) {
    bird += E(48, 56, 25, 30, color) + E(48, 35, 23, 25, color);
    if (kind === 'penguin') bird += E(48, 62, 16, 20, I);
    bird +=
      C(37, 34, 8, kind === 'owl' ? Q : I) +
      C(60, 34, 8, kind === 'owl' ? Q : I) +
      eye(37, 34) +
      eye(60, 34) +
      P('m42 43 6 10 7-10Z', Y);
  } else {
    const body = E(42, 58, 27, 19, color, flying ? -15 : 0);
    bird += body;
    if (long)
      bird += L(
        kind === 'flamingo' ? 'M62 56Q41 44 58 34T66 17' : 'M62 56Q56 37 65 22',
        color,
        kind === 'flamingo' ? 8 : 12,
      );
    bird +=
      C(long ? 66 : 67, long ? 20 : 34, kind === 'flamingo' ? 10 : 14, color) +
      P(
        kind === 'flamingo'
          ? 'm73 18 14 8-5 12-7-3 3-6-8-3Z'
          : long
            ? 'm77 20 15 7-16 2Z'
            : 'm78 31 14 7-14 4Z',
        kind === 'flamingo' ? N : Y,
      ) +
      eye(69, long ? 18 : 31);
    if (kind === 'penguin') bird += E(49, 61, 14, 18, I);
    bird += flying
      ? P('M39 58 10 10 41 29 55 53 69 6 82 17 66 60Z', kind === 'parrot' ? B : color)
      : P(
          f === 3 ? 'M22 53q21-23 38 2L33 72Z' : 'M27 50q26-10 30 9L34 70Z',
          kind === 'eagle' ? T : kind === 'parrot' ? A : B,
        );
    if (kind === 'parrot') bird += P('m24 66-17 25 27-19Z', A);
    if (kind === 'rooster') bird += P('M22 54Q-5 11 18 23L33 51Q19 4 43 24l-4 29Z', D);
  }
  if (['chicken', 'rooster'].includes(kind))
    bird += C(60, 17, 6, A) + C(68, 15, 6, A) + C(75, 19, 5, A);
  if (kind === 'owl') bird += P('m27 23-5-15 20 12m14 0L76 8l-7 16Z', W);
  bird +=
    kind === 'flamingo'
      ? L(f === 3 ? 'M43 73v18m11-18-6 8 15 7' : 'M43 73v18m13-18v18', T, 3)
      : kind === 'goose'
        ? L('M34 76v9m23-9v9', Y, 3) + P('m34 83-10 7h17Zm23 0-7 7h18Z', Y)
        : L('M34 76v10h-9m32-10v10h9', Y, 3);
  return bird + motif(35, 56, 16, 10, kind === 'penguin' ? B : Q);
}
[
  ['penguin', 'object.penguin'],
  ['owl', 'object.owl'],
  ['duck', 'object.duck'],
  ['goose', 'object.goose'],
  ['chicken', 'object.hen'],
  ['rooster', 'object.rooster'],
  ['peacock', 'object.peacock'],
  ['flamingo', 'object.flamingo'],
  ['eagle', 'object.eagle'],
  ['parrot', 'object.parrot'],
].forEach(([id, zh]) => object(id, zh, (f) => avian(id, f)));

object('dolphin', 'object.dolphin', (f) => {
  const bodies = [
    'M9 49Q32 11 62 36l25 2-18 10q2 22-42 23L12 86l3-22Q35 67 46 54L27 62Z',
    'M18 72Q8 28 47 18q22-2 33 17l14 9-22 1Q40 18 37 65L51 84l-24-8-16 12Z',
    'M8 41q32-29 66 6l16 4-18 6Q45 71 19 55L5 66l4-17Z',
    'M49 8q20 8 18 27L57 72l15 16-24-7-20 6 13-18-9-35Q31 13 49 8Z',
    'M9 67Q22 18 59 26l24 15-18 1Q43 25 35 64l16 21-26-7-17 12Z',
  ][f];
  return (
    P(bodies, B) +
    P(f === 3 ? 'm39 38-21 14 21 1m18-15 20 14-21 1Z' : 'm45 35-4-18 18 21m-21 15 4 17 16-16Z', N) +
    eye(f === 3 ? 46 : 64, f === 3 ? 26 : 38) +
    spots(I)
  );
});
object('whale', 'object.whale', (f) => {
  const body = [
    P('M10 50q0-30 33-30 34 0 32 37l17-13-1 27-19-4Q51 93 23 76 8 67 10 50Z', B),
    P('M11 48Q12 21 47 31l24 21 18-17-2 33-23-4Q22 90 11 48Z', N),
    P('M14 36Q48 9 66 40l6 23 18 4-15 17-11-18Q21 83 14 36Z', B),
    E(48, 46, 25, 35, B) + P('m38 73-20 12 30-3 29 3-20-12Z', B),
    P('M8 43q20-24 53-4l18 19 12-17-1 31-28-7Q22 82 8 43Z', N),
  ][f];
  return (
    body +
    P('M19 55q18 20 39 6l-14 14q-21 2-25-20Z', I) +
    eye(25, 43) +
    L(`M29 19q${-8}-18-14-9m14 9q6-20 15-12`, B, 3)
  );
});
object(
  'shark',
  'object.shark',
  (f) =>
    P(
      [
        'M8 51 37 31l34 9 18-21-2 27 5 24-22-13-28 13Z',
        'M11 64Q15 16 54 22l24 14-23 4Q35 43 36 66l20 20-30-6-15 8Z',
        'M9 42 35 24l31 15 24-14-10 29 9 25-24-18-32 5Z',
        'M48 6 65 32l-4 31 19 20-32-10-30 10 17-20-3-31Z',
        'M8 57Q36 13 68 44l21-23-3 28 6 26-23-16Q33 80 8 57Z',
      ][f],
      B,
    ) +
    P('m39 36 8-22 13 27m-17 14 5 21 14-18Z', N) +
    L('M29 42v14m6-14v14m6-14v14', N, 2) +
    eye(21, 47) +
    motif(51, 45, 10, 8, I),
);
object('octopus', 'object.octopus', (f) => {
  const arms = repeat(6, (i) =>
    L(
      `M${25 + i * 9} 56q${(i - 2.5) * 8} ${18 + (f % 3) * 4} ${(i - 2.5) * 9} ${24 - (i % 2) * 10}q${i < 3 ? -10 : 10} -4 ${i < 3 ? -3 : 3} -12`,
      A,
      7,
    ),
  );
  return (
    arms +
    (f === 1 ? P('M22 51q-8-36 26-40 35 4 26 40L58 67H37Z', A) : E(48, 35, 22 + f * 2, 23 - f, A)) +
    eye(38, 36) +
    eye(57, 36) +
    L('M42 46q6 5 12 0', W, 2) +
    motif(34, 18, 25, 9, H)
  );
});
object('jellyfish', 'object.jellyfish', (f) => {
  const dome = [
    P('M14 47q0-41 34-39 34-2 34 39l-12-7-11 9-11-9-12 9-11-9Z', A),
    P('M20 47 28 21l20-11 20 11 8 26Z', B),
    E(48, 38, 34, 19, A),
    P('M23 49Q20 7 48 7t25 42Z', B),
    P('M9 45Q13 22 48 22T87 45L71 57H25Z', A),
  ][f];
  return (
    repeat(5, (i) =>
      L(`M${25 + i * 11} 44q${i % 2 ? 14 : -14} 17 0 25t${-4} 18`, i % 2 ? A : B, 3),
    ) +
    dome +
    motif(34, 27, 28, 14, H)
  );
});
object('crab', 'object.crab', (f) => {
  const body = f === 1 ? R(27, 35, 42, 34, T, 12) : E(48, 53, 25 + f, 17, T);
  return (
    L(
      'M29 49 11 41 5 49m24 9L9 60l-3 8m24-5L15 75v10m52-36 18-8 5 8m-24 9 20 2 4 8m-24-5 14 12v10',
      W,
      3,
    ) +
    L(f % 2 ? 'M30 40 12 24m54 16 18-16' : 'M30 40 19 19m47 21 11-21', T, 6) +
    P('M18 27Q-1 26 5 9l10 8L25 6q11 14-7 21m59 0Q96 26 90 9L80 17 70 6q-11 14 7 21Z', T) +
    body +
    L('M39 38v-9m18 9v-9', W, 3) +
    eye(39, 28) +
    eye(57, 28) +
    spots(Q)
  );
});
object('lobster', 'object.lobster', (f) => {
  const body = E(48, 49, 14 + (f % 2) * 4, 27, T) + P('m39 70-12 15 21-5 22 5-14-15Z', T);
  return (
    L(
      'M36 32 18 22m42 10 18-10M36 43 19 51m17 1-17 11m41-20 17 8m-17 1 17 11M44 28 36 8m16 20L61 8',
      T,
      4,
    ) +
    E(17, 18, 13, 16, T, -25) +
    E(79, 18, 13, 16, T, 25) +
    P('m10 3 7 17 8-15m45 0 9 15 7-17Z', Q) +
    body +
    L('M37 47h22m-22 10h22m-18 10h14', W, 2) +
    eye(42, 31) +
    eye(53, 31) +
    motif(42, 36, 12, 8, Q)
  );
});
object(
  'seahorse',
  'object.seahorse',
  (f) =>
    P(
      [
        'M64 14 78 33H61Q81 64 59 83q-25 18-37-6-8-24 14-25 16 4 7 19l-8-6q-8 14 9 14 21-9 5-26L36 30l9-18Z',
        'M38 10 23 28h20Q23 58 42 79q26 20 37-2 6-17-10-21-17 0-9 13l8-4q5 12-6 13-19-8-4-30l10-24-12-14Z',
        'M55 7 78 31 58 36q17 31-8 50-24 13-31-7-4-20 13-18 12 5 2 12 2 9 12 1 10-11-6-26L34 25Z',
        'M57 9 79 25v11H60l-5 16 11 14q7 18-14 23-26 1-29-20 1-14 15-12l-2 14 13 3-4-18-14-18 9-24Z',
        'M51 8 74 19l9 16H61l4 20-11 21q-17 24-33 7-12-18 7-23l9 9-8 5q9 9 17-4l-3-23-13-17 10-17Z',
      ][f],
      Y,
    ) +
    P('m37 30-17 11 17 17Z', T) +
    eye(f === 1 ? 43 : 56, 22) +
    motif(43, 39, 12, 17, Q),
);
object('bee', 'object.bee', (f) => {
  const wings =
    f === 1
      ? E(29, 27, 19, 22, I, -30) + E(67, 27, 19, 22, I, 30)
      : E(31, 29, 17, 24, I, -35) + E(60, 25, 14, 23, I, 30);
  const body = f === 3 ? E(48, 57, 18, 31, Y) : E(48, 56, 29, 19, Y, f === 2 ? -30 : 0);
  return (
    wings +
    body +
    L('M35 41v28m13-31v36m13-32v28', N, 6) +
    C(f === 3 ? 48 : 76, f === 3 ? 27 : 47, 12, N) +
    eye(f === 3 ? 44 : 79, f === 3 ? 24 : 44) +
    P(f === 3 ? 'm43 84 5 9 5-9Z' : 'm19 49-13 9 15 5Z', N) +
    L('M72 37 71 22m9 17 9-10', N, 2) +
    motif(40, 48, 14, 11, Q)
  );
});
object('dragonfly', 'object.dragonfly', (f) => {
  const wings =
    E(24, 34, 24, f === 1 ? 13 : 8, B, -25) +
    E(72, 34, 24, f === 1 ? 13 : 8, B, 25) +
    E(25, 55, 23, 8, I, 20) +
    E(71, 55, 23, 8, I, -20);
  const body =
    wings +
    L('M48 23v65', D, f === 3 ? 7 : 5) +
    C(48, 22, 8, V) +
    C(43, 18, 5, W) +
    C(53, 18, 5, W) +
    L('M43 44h10m-10 12h10m-10 12h10', F, 2) +
    motif(41, 30, 14, 9, F);
  return f === 2 ? G(body, 'rotate(35 48 48) translate(9 9) scale(.8)') : body;
});

function produce(kind, cut = false) {
  const skin = {
    apple: T,
    pear: Y,
    banana: Y,
    orange: T,
    lemon: Y,
    grapes: A,
    strawberry: A,
    watermelon: V,
    pineapple: Y,
    cherry: A,
    peach: T,
    avocado: D,
    pumpkin: T,
    carrot: T,
    corn: Y,
    eggplant: '#88789a',
    broccoli: V,
    tomato: A,
    pepper: A,
    coconut: W,
  }[kind];
  let art = '';
  if (kind === 'apple')
    art = P('M48 25Q19 7 14 37q-5 32 22 45l13-5 12 5q29-19 20-47-8-26-33-10Z', skin) + stem(48, 25);
  if (kind === 'pear')
    art = P('M43 15q15-7 15 12 1 13 13 28 19 32-22 33-41-1-27-32l15-28Z', skin) + stem(47, 19);
  if (kind === 'banana')
    art =
      P('M14 18q9 42 35 40 28-4 30-35 18 48-24 62Q13 94 9 32Z', Y) +
      L('M18 35q15 49 49 24', W, 3) +
      R(8, 16, 9, 13, W, 2);
  if (kind === 'orange') art = C(48, 53, 33, T) + stem(48, 21) + E(35, 42, 10, 14, Q, -25);
  if (kind === 'lemon')
    art =
      P('M9 50q3-6 10-6 8-28 38-22 24 7 24 26l8 6-9 6q-22 31-51 13-11-8-12-17Z', Y) +
      L('M26 45q8-13 20-11', Q, 5);
  if (kind === 'grapes')
    art =
      repeat(4, (row) =>
        repeat(4 - row, (col) => C(24 + row * 8 + col * 16, 29 + row * 16, 11, A)),
      ) +
      stem(48, 20) +
      P('m52 13 22-6-4 19-17-3Z', V);
  if (kind === 'strawberry')
    art = cut
      ? P('M15 30Q48 11 81 30Q77 59 48 88Q19 59 15 30Z', A) +
        P('M24 34Q48 20 72 34Q67 57 48 76Q29 57 24 34Z', H) +
        P('M43 28h10l-5 36Z', Q) +
        P('m48 12-20 8 14 9 6-8 6 8 14-9Z', V) +
        L('M22 39l3 7m6 12 4 6m39-25-3 7m-6 12-4 6', Q, 2)
      : P('M17 36q0-22 31-12 31-10 31 12-4 28-31 51Q23 64 17 36Z', A) +
        P('m48 12 5 13 17-8-6 13 17 2-25 8-8-8-9 8-25-8 17-2-6-13 17 8Z', V) +
        repeat(3, (r) => repeat(3 - r, (i) => E(29 + r * 7 + i * 18, 43 + r * 15, 2, 3, Q)));
  if (kind === 'watermelon')
    art =
      E(48, 49, 38, 31, V) +
      L('M26 24q-19 26 0 51m17-55q-12 32 0 59m17-58q17 27 0 56m16-47q11 17 0 37', D, 5);
  if (kind === 'pineapple')
    art =
      P('m48 30-21-20 6 20-17-6 16 20H65l15-20-18 6 7-20Z', V) +
      E(48, 61, 26, 29, Y) +
      L('M29 41 65 76M23 53l33 32M37 35l35 34M66 42 30 77m43-23L40 87M57 35 24 68', W, 2);
  if (kind === 'cherry')
    art =
      L('M23 60 48 14 71 61m-23-47q25-4 32 9', W, 3) +
      C(23, 68, 18, A) +
      C(71, 69, 18, A) +
      E(63, 18, 17, 6, V, 10) +
      C(18, 63, 5, H) +
      C(66, 64, 5, H);
  if (kind === 'peach')
    art =
      P('M48 26Q23 8 15 39q-4 28 33 46 34-14 32-43-4-33-32-16Z', T) +
      L('M49 28Q65 54 48 83', A, 3) +
      stem(48, 26);
  if (kind === 'avocado')
    art =
      P('M41 11q16-6 21 22l14 25q11 30-28 32-37-1-29-30l15-30Z', D) +
      (cut
        ? P('M43 20q8-5 12 15l13 25q8 21-20 24-29-2-21-24l12-27Z', F) + C(48, 63, 15, W)
        : L('M30 53q-10 20 5 26', V, 4));
  if (kind === 'pumpkin')
    art =
      E(48, 54, 35, 29, T) +
      E(48, 54, 22, 30, Y) +
      E(48, 54, 10, 30, T) +
      P('m42 28 2-19 12-3 3 7-8 7 4 7Z', D) +
      L('M56 23q24-20 28-4-1 13-12 6', V, 3);
  if (kind === 'carrot')
    art =
      P('M27 31q20-14 39 2L36 89Z', T) +
      P('m35 31-17-20 17 5 6-13 7 21 16-16 8 5-19 20Z', V) +
      L('m35 43 13 4m-8 10 12 3m-16 8 9 2', W, 2);
  if (kind === 'corn')
    art =
      E(49, 46, 20, 37, Y) +
      repeat(5, (r) => repeat(3, (c) => R(35 + c * 9, 17 + r * 11, 6, 7, Q, 3))) +
      P('M48 88Q7 78 15 38l23 28L47 89Q82 61 78 27 94 71 48 88Z', V);
  if (kind === 'eggplant')
    art =
      P('M54 28Q38 26 33 49L19 64q-19 33 23 24 27-11 27-40l-3-17Z', skin) +
      P('m51 29 2-19 9-3 1 17 14 7-12 5-7-5-13 6Z', V) +
      L('M34 62q-10 14-6 17', I, 4);
  if (kind === 'broccoli')
    art =
      P('M35 86 42 54 22 38l8-9 20 24 16-21 10 8-19 20 9 26Z', F) +
      C(25, 36, 19, V) +
      C(48, 24, 23, D) +
      C(73, 37, 18, V) +
      C(46, 48, 19, V);
  if (kind === 'tomato')
    art =
      E(48, 57, 35, 29, A) +
      P('m48 20 6 16 20-8-10 17 20 4-25 4-11-9-12 11-26-7 23-5-8-15 17 8Z', D) +
      L('M29 55q-8 14 2 20', H, 5);
  if (kind === 'pepper')
    art = cut
      ? L(
          'M30 20Q48 5 66 20Q90 16 85 43Q96 66 72 77Q60 95 48 81Q25 94 16 70Q0 49 17 38Q9 18 30 20Z',
          A,
          9,
        ) +
        L('M48 19v23M19 65l23-12m34 13L54 52', Q, 6) +
        E(45, 42, 3, 5, Y, -25) +
        E(54, 43, 3, 5, Y, 25)
      : P('M47 28Q27 15 20 37q-7 19 10 38l5 10 12-5 12 5q25-11 24-42-5-25-22-15Z', A) +
        L('M51 33V16l9-8', D, 7) +
        L('M35 42v25m26-27q8 16-2 30', H, 4);
  if (kind === 'coconut')
    art =
      C(48, 52, 33, W) +
      L('M22 35 32 76m8-51 8 58m12-55 13 38', T, 3) +
      C(40, 42, 4, N) +
      C(55, 42, 4, N) +
      C(47, 53, 4, N);
  if (
    cut &&
    ![
      'avocado',
      'carrot',
      'corn',
      'broccoli',
      'grapes',
      'cherry',
      'banana',
      'strawberry',
      'pepper',
    ].includes(kind)
  ) {
    const inside = ['watermelon', 'tomato'].includes(kind) ? A : kind === 'coconut' ? I : Q;
    art = E(48, 51, 34, 30, skin) + E(48, 51, 28, 25, inside);
    if (['orange', 'lemon'].includes(kind))
      art += repeat(8, (i) => G(L('M48 51v-24', skin, 2), `rotate(${i * 45} 48 51)`));
    else if (['apple', 'pear'].includes(kind))
      art +=
        P('M48 29q-13 14 0 22-14 12 0 22 14-10 0-22 13-8 0-22Z', I) +
        E(44, 49, 2, 4, W, 25) +
        E(53, 50, 2, 4, W, -25);
    else if (['peach', 'avocado'].includes(kind)) art += E(48, 52, 12, 17, W);
    else if (kind === 'coconut') art += E(48, 51, 18, 16, Q);
    else art += repeat(6, (i) => G(E(48, 33, 2, 4, W), `rotate(${i * 60} 48 51)`));
  }
  return art + motif(42, 52, 11, 7, cut ? skin : Q);
}
function produceScene(kind, f) {
  const whole = produce(kind),
    sliced = produce(kind, true);
  if (f === 0) return whole;
  if (f === 1) return G(sliced, 'rotate(-18 48 48)');
  if (f === 2) return G(whole, 'translate(48 48) rotate(-35) scale(.8) translate(-48 -48)');
  if (f === 3) return G(sliced, 'translate(48 48) rotate(35) scale(.8) translate(-48 -48)');
  return G(whole, 'translate(48 48) scale(.65 .95) translate(-48 -48)');
}
[
  ['apple', 'ui.apple'],
  ['pear', 'ui.pear'],
  ['banana', 'object.banana'],
  ['orange', 'object.orange'],
  ['lemon', 'object.lemon'],
  ['grapes', 'object.grapes'],
  ['strawberry', 'object.strawberry'],
  ['watermelon', 'object.watermelon'],
  ['pineapple', 'object.pineapple'],
  ['cherry', 'ui.cherries'],
  ['peach', 'object.peach'],
  ['avocado', 'object.avocado'],
  ['pumpkin', 'object.pumpkin'],
  ['carrot', 'ui.carrot'],
  ['corn', 'object.corn'],
  ['eggplant', 'object.eggplant'],
  ['broccoli', 'object.broccoli'],
  ['tomato', 'object.tomato'],
  ['pepper', 'object.bell-pepper'],
  ['coconut', 'object.coconut'],
].forEach(([id, zh]) => object(id, zh, (f) => produceScene(id, f)));

function served(body, f) {
  const turn = [0, 0, -25, 25, 0][f];
  return G(body, `translate(48 48) rotate(${turn}) scale(.85) translate(-48 -48)`);
}
object('bread', 'object.bread', (f) => {
  const b = [
    P('M11 66V42Q18 6 47 19 79 6 86 42v24q-35 19-75 0Z', Y) +
      L('m27 27 9 20m9-25 9 23m9-21 8 16', W, 4),
    P('M26 81V39q-22-21 5-29 21-9 35 0 26 8 5 29v42Z', W) +
      P('M33 74V32q-18-16 3-17 15-8 28 3 14 4-1 16v40Z', Q),
    P('M8 76 65 9q12-6 19 7L25 85Z', Y) + L('m28 59 15 6m-4-24 15 7m-3-21 14 7', W, 4),
    E(48, 49, 34, 31, Y) + L('M27 27 68 68M25 61 65 25', W, 4),
    R(14, 27, 70, 47, Y, 14) + L('M31 29v42m17-43v43m17-43v43', W, 3),
  ][f];
  return served(b, f) + motif(39, 51, 15, 9, Q);
});
object('cake', 'object.cake', (f) => {
  const b =
    f === 1
      ? P('m18 75 9-51 56 25-10 33Z', T) + P('m27 24 56 25-64 6Z', H) + L('M22 63 75 76', Q, 5)
      : f === 2
        ? R(19, 51, 58, 32, T, 4) + R(27, 29, 42, 24, H, 4) + R(36, 13, 24, 18, Q, 3)
        : f === 3
          ? P('M25 42h46l-8 41H33Z', Y) + C(33, 40, 13, H) + C(48, 29, 17, H) + C(64, 39, 13, H)
          : R(14, 35, 68, 45, T, 5) + E(48, 35, 34, 13, H) + L('M17 62h61', Q, 6);
  return served(b, f) + C(48, 24, 5, A) + L('M48 18v-9', Y, 3) + motif(35, 52, 24, 11, Q);
});
object('icecream', 'object.ice-cream', (f) => {
  if (f === 1)
    return (
      R(24, 13, 49, 59, H, 17) +
      R(42, 70, 13, 22, W, 4) +
      L('M37 23v36m14-36v36m12-36v36', A, 3) +
      spots(Q)
    );
  if (f === 3)
    return (
      E(48, 68, 34, 12, B) +
      P('M17 65h63L62 86H33Z', B) +
      C(29, 50, 19, H) +
      C(65, 50, 19, Q) +
      C(47, 29, 19, T) +
      spots(A)
    );
  return (
    P('M26 48h45L49 92Z', Y) +
    L('M30 57 57 72m-19 0 28-16', W, 2) +
    (f === 2
      ? P('M20 51q-5-16 16-17-9-13 9-17-7-10 7-15 1 13 13 21 17 7 5 14 20 10 5 16Z', Q)
      : C(48, 35, 28, f === 4 ? T : H)) +
    motif(35, 31, 26, 13, A)
  );
});
object('donut', 'object.doughnut', (f) =>
  served(
    (f === 1 ? P('M18 16h59v61H18Z', Y) + R(30, 28, 35, 35, Q, 13) : C(48, 48, 35, Y)) +
      (f === 3 ? L('M17 52q31-39 62 0', A, 12) : C(48, 45, 29, H)) +
      C(48, 46, 13, Q) +
      L('m29 32 5 4m21-15-3 8m19 11-7 4M31 63l7-3m26 4-8-4', Y, 3) +
      motif(34, 69, 20, 5, W),
    f,
  ),
);
object('pizza', 'object.pizza', (f) => {
  const b =
    f === 1 || f === 4
      ? P('M13 18 86 34 46 87Z', Y) + L('M13 18 86 34', W, 8) + C(42, 39, 8, A) + C(56, 57, 8, A)
      : C(48, 48, 37, W) +
        C(48, 48, 31, Y) +
        C(32, 35, 8, A) +
        C(60, 34, 8, A) +
        C(46, 65, 8, A) +
        L('M48 17v63M20 33 76 66m-55-3 53-30', T, 2);
  return served(b, f) + motif(35, 48, 19, 8, V);
});
object('burger', 'object.burger', (f) => {
  const layers = f === 2 ? 3 : f === 3 ? 1 : 2,
    top = f === 2 ? 13 : 22;
  return (
    P(`M13 ${top + 24}Q14 ${top - 5} 48 ${top - 5}q34 0 35 29Z`, Y) +
    repeat(
      layers,
      (i) =>
        R(13, top + 27 + i * 14, 70, 8, i % 2 ? W : A, 3) +
        P(
          `M12 ${top + 26 + i * 14} 23 ${top + 20 + i * 14} 36 ${top + 27 + i * 14} 49 ${top + 20 + i * 14} 61 ${top + 27 + i * 14} 75 ${top + 20 + i * 14} 84 ${top + 27 + i * 14}Z`,
          V,
        ),
    ) +
    R(14, top + 28 + layers * 14, 69, 12, Y, 6) +
    motif(33, top + 9, 30, 8, Q)
  );
});
object('sandwich', 'object.sandwich', (f) =>
  served(
    P(f === 1 ? 'M14 21h66v59H14Z' : 'm12 75 38-62 37 62Z', Y) +
      P(f === 1 ? 'M20 28h53v44H20Z' : 'm22 69 28-44 25 44Z', Q) +
      L(f === 1 ? 'M19 46h55' : 'M19 72h60', V, 6) +
      L(f === 1 ? 'M20 55h53' : 'M21 80h57', A, 5) +
      motif(38, 43, 19, 14, T),
    f,
  ),
);
object('noodles', 'object.noodles', (f) => {
  const bowl = f === 1 ? P('M15 58h67L62 86H34Z', B) : P('M9 48h78Q77 87 48 87T9 48Z', B);
  return (
    bowl +
    E(48, f === 1 ? 57 : 48, 38, 12, Q) +
    repeat(5, (i) => L(`M${21 + i * 11} 51q-7-10 3-17t-2-${12 + f * 3}`, Y, 3)) +
    L('m30 18 55-10m-49 19L87 16', W, 3) +
    motif(34, 67, 28, 12, I)
  );
});
object('sushi', 'object.sushi', (f) => {
  const maki =
    R(24, 25, 48, 48, D, 8) +
    E(48, 25, 24, 13, N) +
    E(48, 25, 19, 9, Q) +
    E(48, 25, 10, 6, A) +
    R(27, 61, 42, 13, N, 4);
  const nigiri =
    R(13, 45, 71, 28, Q, 12) +
    P('M8 45Q39 13 87 40l-6 15-63 2Z', T) +
    L('m29 32 5 20m11-26 6 25m11-20 6 21', Q, 3);
  return served(f % 2 ? nigiri : maki, f) + motif(37, f % 2 ? 61 : 42, 20, 8, f % 2 ? Y : V);
});
object('candy', 'object.candy', (f) => {
  if (f === 1 || f === 3)
    return (
      L('M48 47v44', W, 4) +
      (f === 1
        ? C(48, 32, 27, H) + L('M48 12q29 13 3 35-21 3-19-14 6-15 20-3-3 12-13 5', A, 5)
        : P('m48 7 29 20-11 29H30L19 27Z', A)) +
      motif(37, 22, 23, 14, Q)
    );
  return (
    P('M29 35 6 20l7 24-7 23 23-12m39-20 23-15-7 24 7 23-23-12Z', Y) +
    R(23, 24, 49, 44, H, f === 2 ? 20 : 5) +
    motif(32, 33, 31, 24, A)
  );
});
object('cookie', 'object.cookie', (f) =>
  served(
    (f === 1
      ? R(13, 17, 70, 62, Y, 10)
      : f === 2
        ? P('M48 9 60 23l18-3 3 18 10 12-14 14-1 19-21-3-17 10-13-17-17-7 7-24-3-18 23-1Z', Y)
        : C(48, 48, 35, Y)) +
      repeat(6, (i) => G(C(48, 25, 4, W), `rotate(${i * 60} 48 48)`)) +
      C(48, 48, 5, W),
    f,
  ),
);
object('egg', 'object.egg', (f) => {
  if (f === 1 || f === 4)
    return (
      P('M18 27Q29 11 48 20 70 6 82 28l-5 23q18 21-5 30l-26-7q-26 17-35-5l8-22q-15-8-1-20Z', I) +
      C(48, 49, 19, Y) +
      motif(42, 43, 12, 8, Q)
    );
  const whole =
    E(48, 49, 27, 37, Q) +
    (f === 2 ? E(48, 53, 22, 26, I) + E(48, 55, 14, 18, Y) : L('M34 30q-8 12-7 24', I, 5));
  return f === 3 ? G(whole, 'translate(0 -5) scale(.9)') + P('M22 58h47L58 76v9H32v-9Z', B) : whole;
});
object('cheese', 'object.cheese', (f) =>
  served(
    f === 1
      ? C(48, 48, 34, Y) + C(33, 34, 7, Q) + C(62, 39, 9, Q) + C(45, 64, 8, Q)
      : P('M12 44 67 14l19 19v44L12 83Z', Y) +
          P('M12 44 67 14l19 19Z', Q) +
          C(32, 61, 7, Q) +
          C(65, 56, 8, Q) +
          C(63, 25, 4, Y) +
          motif(45, 67, 23, 8, W),
    f,
  ),
);
object('croissant', 'object.croissant', (f) =>
  served(
    P(
      f === 1
        ? 'M11 71Q0 21 48 16 95 23 85 72L64 57q-6-22-31-1Z'
        : 'M8 30q40-31 80 0L73 74 57 56H39L22 74Z',
      Y,
    ) +
      L('M27 21 33 55m9-37 1 35m15-35-4 35m17-28-8 32', W, 3) +
      motif(36, 28, 26, 13, Q),
    f,
  ),
);
object('pretzel', 'object.pretzel', (f) =>
  served(
    L(
      'M25 72Q-5 28 28 20q15-2 20 23 6-26 21-23 30 8 4 52Q60 88 38 50L24 24M72 25 39 77q-16 13-25-2',
      Y,
      12,
    ) +
      L('M22 70h49', Y, 12) +
      motif(37, 65, 20, 8, Q),
    f,
  ),
);
object('pancake', 'object.pancakes', (f) =>
  served(
    repeat(
      f === 1 ? 2 : f === 2 ? 5 : 3,
      (i) => E(48, 72 - i * 10, 34, 12, W) + E(48, 69 - i * 10, 34, 10, Y),
    ) +
      P('M22 35q20-15 45 0l-9 12-8-4-10 12-13-10Z', T) +
      R(38, 24, 22, 12, Q, 3) +
      motif(34, 57, 29, 9, Q),
    f,
  ),
);
object('waffle', 'object.waffle', (f) =>
  served(
    (f % 2 ? C(48, 48, 35, Y) : R(15, 15, 67, 67, Y, 8)) +
      repeat(4, (r) => repeat(4, (c) => R(25 + c * 12, 25 + r * 12, 8, 8, W, 1))) +
      motif(36, 37, 21, 20, Q),
    f,
  ),
);
object('popcorn', 'object.popcorn', (f) => {
  const box = f === 1 ? P('M14 52h68L69 86H26Z', Y) : P('M19 34h59l-8 53H27Z', A);
  return (
    box +
    L('M32 38 37 83m12-45v45m16-45-5 45', Q, 7) +
    repeat(9, (i) => C(23 + (i % 3) * 22, 25 + Math.floor(i / 3) * 12, 10, Q)) +
    motif(34, 58, 29, 13, Y)
  );
});
object('chocolate', 'object.chocolate', (f) =>
  served(
    R(19, 10, 58, 77, W, 3) +
      repeat(4, (r) => repeat(3, (c) => R(23 + c * 18, 14 + r * 17, 14, 13, T, 2))) +
      (f % 2 ? P('M13 48 83 57l-5 32H20Z', B) + P('m13 48 33 12 37-3-22 17Z', I) : '') +
      motif(27, 24, 38, 9, Q),
    f,
  ),
);
object('steak', 'object.steak', (f) =>
  served(
    P(
      [
        'M19 24q31-20 55 4 21 17 3 45-18 24-37 2-31 10-32-15-4-20 11-36Z',
        'M16 44q-1-29 26-25 45-6 41 21-3 37-29 40-38 7-38-36Z',
        'M28 14 69 22l15 21-12 34-44 8-17-25Z',
        'M12 37Q39 6 79 29q11 28-16 52L30 74Z',
        'M18 17q59-4 63 33-4 36-29 33-47-4-34-66Z',
      ][f],
      T,
    ) +
      L('M28 34 65 65m-41-9 34-25m-15 45 29-31', W, 4) +
      motif(34, 43, 25, 12, Q),
    f,
  ),
);

function feet(f, x = 22, y = 78, w = 52) {
  return L(f % 2 ? `M${x} ${y}l-7 11m${w + 7}-11 7 11` : `M${x} ${y}v10m${w}-10v10`, W, 5);
}
object('sofa', 'object.sofa', (f) => {
  if (f === 1)
    return (
      feet(f, 30, 79, 33) +
      R(22, 16, 53, 55, B, 15) +
      R(23, 58, 52, 20, I, 8) +
      R(15, 45, 14, 38, B, 6) +
      R(68, 45, 14, 38, B, 6) +
      spots(N)
    );
  if (f === 3)
    return (
      feet(f) +
      P('M12 78V38h19v24h52v16Z', B) +
      R(31, 50, 52, 20, I, 6) +
      R(17, 34, 18, 31, B, 7) +
      spots(N)
    );
  return (
    feet(f) +
    R(14, 26, 69, 47, B, f === 2 ? 22 : 7) +
    R(13, 58, 71, 21, I, 5) +
    R(7, 45, 14, 34, B, 5) +
    R(76, 45, 14, 34, B, 5) +
    L(f === 2 ? 'M48 30v31' : 'M36 31v29m24-29v29', N, 2) +
    motif(32, 37, 31, 14, Q)
  );
});
object('bed', 'object.bed', (f) => {
  if (f === 1)
    return (
      R(20, 8, 58, 77, W, 5) +
      R(25, 14, 48, 68, Q, 4) +
      R(27, 40, 44, 39, B, 3) +
      R(30, 19, 35, 16, I, 5) +
      motif(35, 53, 28, 16, I)
    );
  if (f === 2)
    return (
      L('M13 13v74m70-74v74M13 23h70m-70 33h70', W, 6) +
      R(17, 26, 63, 19, B, 3) +
      R(17, 60, 63, 19, B, 3) +
      R(20, 23, 17, 8, Q, 2) +
      R(20, 57, 17, 8, Q, 2) +
      L('M64 33v53m13-53v53m-13-42h13m-13 14h13m-13 14h13', W, 3)
    );
  if (f === 4)
    return (
      P('M17 66 45 28l43 19-27 36Z', B) +
      P('M17 66v14l43 11 1-8Z', W) +
      P('m45 28-1-19 44 18v20Z', W) +
      P('m39 36 35 12-7 9-35-12Z', Q) +
      motif(40, 56, 20, 12, I)
    );
  return (
    L('M12 24v64m72-44v44', W, 6) +
    R(15, 50, 67, 28, B, 3) +
    R(17, 41, 20, 14, Q, 5) +
    L('M15 77h67', W, 5) +
    motif(44, 58, 28, 13, I)
  );
});
object('wardrobe', 'object.wardrobe', (f) => {
  const arched =
    f === 2
      ? P('M16 83V24Q48-5 80 24v59Z', W)
      : R(f === 1 ? 27 : 15, 13, f === 1 ? 42 : 66, 71, W, 3);
  if (f === 3)
    return (
      R(15, 13, 65, 72, W, 3) +
      R(21, 20, 28, 58, Q) +
      L('M21 38h28m-28 19h28', W, 3) +
      P('m51 20 30-10v67l-30-4Z', T) +
      C(59, 47, 2, W) +
      spots(Y)
    );
  return (
    feet(f, 24, 82, 47) +
    arched +
    R(f === 1 ? 33 : 21, 22, f === 1 ? 30 : 54, 50, T, 2) +
    L('M48 21v51', W, 3) +
    C(43, 48, 2, Q) +
    C(54, 48, 2, Q) +
    (f === 4 ? R(20, 67, 55, 12, Q, 1) + C(48, 73, 2, W) : '') +
    motif(28, 27, 13, 12, Q)
  );
});
object('mirror', 'object.mirror', (f) => {
  const shapes = [
    E(48, 42, 29, 36, W) + E(48, 42, 23, 30, I),
    R(19, 10, 58, 70, W, 5) + R(26, 17, 44, 56, I),
    C(48, 36, 29, W) + C(48, 36, 23, I),
    P('m48 7 34 24-8 41H22L14 31Z', W) + P('m48 15 25 20-7 30H29l-7-30Z', I),
    E(44, 37, 26, 30, W) + E(44, 37, 20, 24, I) + L('M45 67 68 91', W, 9),
  ][f];
  return (
    shapes +
    L('M35 30 53 16m-18 36 26-21', B, 3) +
    (f === 2 ? L('M48 65v19m-21 2h42', W, 5) : '') +
    motif(39, 48, 18, 10, B)
  );
});
object('bathtub', 'object.bathtub', (f) => {
  if (f === 1)
    return E(48, 49, 31, 41, I) + E(48, 45, 23, 32, B) + L('M26 23h16v14', N, 5) + spots(Q);
  return (
    feet(f, 27, 72, 40) +
    P(f === 2 ? 'M10 45h77L72 76H26Z' : 'M11 43h76q1 38-38 38T11 43Z', I) +
    L('M10 43h78', B, 7) +
    L(f === 3 ? 'M72 44V21H56v10' : 'M23 42V16h16v10', N, 5) +
    (f === 4 ? C(39, 33, 10, I) + C(59, 32, 14, I) + C(74, 36, 8, I) : '') +
    motif(34, 54, 30, 16, B)
  );
});
object('toilet', 'object.toilet', (f) => {
  if (f === 1)
    return (
      R(20, 11, 56, 23, I, 5) +
      E(48, 56, 30, 31, I) +
      E(48, 53, 22, 23, B) +
      E(48, 53, 16, 16, Q) +
      R(56, 17, 12, 4, N, 2)
    );
  if (f === 2)
    return (
      R(26, 12, 45, 31, I, 5) +
      E(48, 47, 28, 11, B) +
      P('M20 47h56L62 67l4 19H30l5-20Z', I) +
      R(51, 20, 10, 5, N, 2) +
      spots(B)
    );
  return (
    R(14, 17, 29, 43, I, 4) +
    R(21, 25, 11, 5, N, 2) +
    P('M27 53h59q0 25-28 26l7 10H32l8-18Z', I) +
    E(58, 53, 28, 10, B) +
    E(58, 52, 20, 5, Q) +
    motif(37, 63, 18, 9, B)
  );
});
object('sink', 'object.sink', (f) => {
  const basin = f === 1 ? R(15, 39, 68, 30, I, 3) : E(48, 51, 37, 18, I);
  return (
    (f === 2
      ? R(18, 57, 60, 30, W, 3) + L('M48 60v22', Q, 2)
      : f === 3
        ? L('M26 63v25m44-25v25', N, 4)
        : P('M40 62h16l6 25H34Z', I)) +
    basin +
    E(48, 47, 28, 10, B) +
    L('M48 44V18h15v10', N, 5) +
    L('M30 28v10m-7-8h14', N, 3) +
    C(48, 49, 3, N) +
    motif(39, 68, 18, 9, B)
  );
});
object('fan', 'object.fan', (f) => {
  if (f === 1)
    return (
      R(15, 11, 66, 70, B, 7) +
      C(48, 42, 28, I) +
      repeat(3, (i) => G(P('M48 42Q24 6 18 36q1 17 30 6Z', N), `rotate(${i * 120} 48 42)`)) +
      C(48, 42, 5, Y) +
      R(23, 74, 50, 12, N, 3)
    );
  if (f === 3)
    return R(32, 10, 31, 70, B, 12) + L('M41 22v45m10-45v45', I, 4) + E(48, 86, 25, 6, N);
  return (
    L('M48 56v30', N, 6) +
    E(48, 87, 25, 5, N) +
    C(48, 35, 31, B) +
    C(48, 35, 27, I) +
    repeat(f === 2 ? 4 : 3, (i) =>
      G(P('M48 35Q20 10 21 37q8 15 27-2Z', N), `rotate(${i * (f === 2 ? 90 : 120)} 48 35)`),
    ) +
    C(48, 35, 7, Y)
  );
});
object('fridge', 'object.refrigerator', (f) => {
  if (f === 1)
    return (
      R(10, 30, 77, 52, B, 6) +
      R(15, 35, 67, 39, I, 3) +
      L('M48 36v39m-28-19h12m29 0h13', N, 3) +
      feet(f)
    );
  const body =
    R(f === 2 ? 25 : 18, 8, f === 2 ? 47 : 60, 80, I, 5) +
    L(f === 3 ? 'M48 11v72' : 'M21 35h54', B, 3);
  return (
    body +
    L(f === 3 ? 'M42 37v21m13-21v21' : 'M29 17v10m0 19v23', N, 4) +
    (f === 4 ? R(50, 45, 18, 20, B, 3) : '') +
    motif(42, 58, 23, 13, B)
  );
});
object('oven', 'object.oven', (f) => {
  const shape = R(f === 1 ? 9 : 17, f === 1 ? 27 : 14, f === 1 ? 79 : 63, f === 1 ? 52 : 71, B, 5);
  return (
    shape +
    R(f === 1 ? 16 : 23, f === 1 ? 43 : 36, f === 1 ? 49 : 51, 35, N, 3) +
    R(f === 1 ? 20 : 27, f === 1 ? 48 : 41, f === 1 ? 41 : 43, 25, I, 2) +
    L('M30 33h38', N, 4) +
    repeat(3, (i) => C(29 + i * 19, 24, 4, N)) +
    (f === 2 ? C(32, 11, 11, N) + C(65, 11, 11, N) : '') +
    motif(36, 50, 25, 10, W)
  );
});
object('washing-machine', 'object.washing-machine', (f) => {
  if (f === 1 || f === 3)
    return (
      R(19, 24, 58, 62, I, 4) +
      P('m19 24 13-15h32l13 15Z', B) +
      E(48, 24, 22, 8, N) +
      E(48, 24, 16, 5, I) +
      R(24, 37, 48, 11, B, 2) +
      spots(B)
    );
  return (
    R(17, 10, 63, 77, I, 6) +
    R(24, 18, 25, 9, B, 2) +
    C(66, 23, 5, N) +
    C(48, 57, 25, B) +
    C(48, 57, 19, N) +
    P('M32 57q9-10 17 0t15 0v8q-17 16-32 0Z', I) +
    motif(34, 48, 28, 13, V)
  );
});
function screen(f, body) {
  const bezel = f === 1 ? P('m10 19 69-9v60L10 79Z', N) : R(10, 14, 77, 55, N, f === 3 ? 15 : 5);
  return (
    bezel +
    R(17, 21, 63, 41, B, 3) +
    body +
    (f === 2 ? L('M20 68 12 84m64-16 9 16', N, 5) : L('M48 69v14m-23 3h46', N, 5))
  );
}
object('television', 'object.television', (f) =>
  screen(f, (f === 3 ? L('M33 14 18 3m41 11L76 3', N, 3) : '') + motif(26, 30, 43, 23, I)),
);
object('computer', 'object.computer', (f) => {
  if (f === 1 || f === 4)
    return (
      R(20, 13, 60, 45, N, 4) +
      R(26, 19, 48, 33, B, 2) +
      P('M20 59h60l11 23H7Z', I) +
      L('M19 71h61M26 65h47', N, 2) +
      motif(34, 28, 29, 16, I)
    );
  return (
    G(screen(f, motif(23, 28, 49, 24, I)), 'translate(0 0) scale(.8)') +
    R(73, 18, 18, 57, N, 3) +
    R(77, 24, 10, 6, I) +
    C(82, 62, 3, B) +
    P('M9 76h63l8 12H4Z', N) +
    E(86, 82, 7, 9, B)
  );
});
object('phone', 'object.telephone', (f) => {
  if (f === 1 || f === 4)
    return (
      R(27, 7, 43, 82, N, 7) +
      R(32, 17, 33, 58, B, 3) +
      C(48, 82, 3, I) +
      L('M41 12h15', I, 2) +
      motif(39, 30, 22, 27, I)
    );
  if (f === 2)
    return (
      R(31, 26, 34, 57, I, 6) +
      R(36, 9, 25, 57, N, 10) +
      R(40, 23, 17, 17, B, 2) +
      repeat(6, (i) => C(42 + (i % 2) * 12, 45 + Math.floor(i / 2) * 7, 2, I))
    );
  return (
    P('M15 81 23 39h49l13 42Z', B) +
    L(f === 3 ? 'M15 32q31-37 67 0' : 'M14 35q36-25 69 0', N, 13) +
    R(10, 30, 18, 20, N, 5) +
    R(69, 30, 18, 20, N, 5) +
    C(48, 59, 17, I) +
    C(48, 59, 9, N) +
    motif(35, 72, 25, 6, Q)
  );
});
object('radio', 'object.radio', (f) => {
  const b =
    R(f === 1 ? 22 : 9, f === 1 ? 20 : 32, f === 1 ? 54 : 78, f === 1 ? 66 : 50, W, 6) +
    L('M33 31V17h32v14m5-4L84 5', N, 3);
  return (
    b +
    (f === 1
      ? C(48, 60, 19, N) + R(31, 29, 34, 9, I)
      : C(34, 57, 20, N) + R(59, 41, 20, 11, I) + C(64, 67, 5, N) + C(77, 67, 5, N)) +
    motif(f === 1 ? 36 : 22, 48, 24, 15, B)
  );
});
object('speaker', 'object.speaker', (f) => {
  if (f === 1) return R(8, 26, 80, 48, N, 19) + C(30, 50, 17, B) + C(66, 50, 17, B) + spots(I);
  if (f === 3)
    return (
      C(48, 47, 35, N) +
      C(48, 47, 27, B) +
      C(48, 47, 15, N) +
      L('M29 75v11m39-11v11', N, 4) +
      spots(I)
    );
  return (
    R(23, 9, 50, 78, N, 5) +
    C(48, 32, 15, B) +
    C(48, 66, 19, B) +
    C(48, 32, 7, N) +
    C(48, 66, 10, N) +
    motif(36, 59, 25, 9, I)
  );
});
object('headphones', 'object.headphones', (f) => {
  if (f === 1)
    return (
      R(13, 30, 22, 28, I, 10) +
      L('M27 45v27q0 16 20 9', N, 3) +
      R(62, 13, 22, 28, I, 10) +
      L('M70 32v34q0 20-21 21', N, 3) +
      C(22, 41, 5, B) +
      C(75, 24, 5, B)
    );
  if (f === 3)
    return (
      R(20, 11, 17, 38, I, 8) +
      R(60, 11, 17, 38, I, 8) +
      L('M28 48v19m40-19v19', B, 5) +
      R(19, 59, 60, 28, I, 10) +
      L('M22 70h54', B, 2)
    );
  return (
    L('M20 62V38Q20 5 48 7q28-2 28 31v24', N, 10) +
    L('M24 38q24-20 48 0', B, 4) +
    R(11, 42, 22, 38, B, 8) +
    R(64, 42, 22, 38, B, 8) +
    (f === 2 ? L('M74 74q-4 15-26 15', N, 4) + C(46, 88, 4, N) : '') +
    motif(16, 54, 12, 13, I)
  );
});
object('microphone', 'object.microphone', (f) => {
  if (f === 1)
    return (
      L('M37 48 74 85', N, 15) +
      C(26, 33, 22, B) +
      L('m13 28 22 23m-24-12 23-21', I, 3) +
      motif(17, 27, 20, 14, N)
    );
  return (
    R(34, 9, 29, 47, B, 14) +
    L('M25 38v9q0 23 24 22 23 0 23-22v-9M48 70v17m-23 1h47', N, 5) +
    L('M40 19h16m-16 9h16m-16 9h16', I, 3) +
    (f === 3 ? L('M48 86 21 94m27-8 28 8', N, 3) : '') +
    motif(39, 40, 19, 9, N)
  );
});
object('flashlight', 'object.flashlight', (f) => {
  if (f === 1)
    return C(48, 48, 32, N) + C(48, 48, 25, B) + C(48, 48, 19, Q) + C(48, 48, 8, Y) + spots(I);
  const light =
    P(f === 3 ? 'M30 37h37L58 83H40Z' : 'M31 33h34L61 86H35Z', B) +
    P('M23 11h49l-7 27H31Z', N) +
    R(24, 9, 47, 10, Y, 3) +
    R(41, 45, 14, 19, N, 4) +
    motif(39, 68, 19, 10, I);
  return f === 2 ? G(light, 'rotate(-35 48 48) translate(10 10) scale(.8)') : light;
});
object('candle', 'object.candle', (f) => {
  const wax =
    R(
      f === 1 ? 32 : 24,
      f === 1 ? 40 : 31,
      f === 1 ? 32 : 49,
      f === 1 ? 43 : 49,
      Q,
      f === 3 ? 18 : 4,
    ) + P('M25 31h47v16l-8-8-8 14-8-14-9 10-7-11-7 10Z', I);
  const flame = P('M49 5q-23 20-9 26 27 6 9-26Z', Y) + P('m49 16-5 12q14 2 5-12Z', T);
  return (
    (f === 2 ? E(48, 85, 37, 7, W) : f === 4 ? L('M16 85h64M48 77v8', W, 5) : '') +
    wax +
    flame +
    L('M48 31v-7', W, 2) +
    motif(37, 53, 22, 17, T)
  );
});

object('scissors', 'object.scissors', (f) => {
  if (f === 1)
    return (
      L('M40 59 67 7m-12 52L27 7', B, 8) +
      E(31, 74, 12, 15, T, -20) +
      E(64, 74, 12, 15, T, 20) +
      C(48, 47, 5, N) +
      motif(42, 42, 12, 7, I)
    );
  const angle = f === 2 ? 20 : f === 3 ? 60 : 38;
  return (
    G(
      P('M46 53 40 9q7-14 10 0l3 44Z', B) + E(48, 72, 13, 16, T) + E(48, 72, 7, 10, Q),
      `rotate(${-angle} 48 48)`,
    ) +
    G(
      P('M46 53 40 9q7-14 10 0l3 44Z', I) + E(48, 72, 13, 16, T) + E(48, 72, 7, 10, Q),
      `rotate(${angle} 48 48)`,
    ) +
    C(48, 48, 5, N) +
    spots(W)
  );
});
object('hammer', 'object.hammer', (f) => {
  const heads = [
    P('M12 15h57l16 12-9 8-15-11v19H12Z', B),
    R(8, 12, 79, 34, W, 6),
    C(24, 28, 17, B) + R(23, 16, 49, 25, B, 4) + C(74, 29, 12, N),
    P('M12 15h61v12L58 44H12Z', B),
    R(17, 12, 64, 28, N, 3),
  ][f];
  return (
    R(40, 32, 14, 58, W, 4) +
    heads +
    motif(29, 23, 21, 10, I) +
    (f === 4 ? L('M40 64h14m-14 8h14m-14 8h14', T, 4) : '')
  );
});
object('saw', 'object.saw', (f) => {
  if (f === 1)
    return (
      L('M16 69V17h67v52', N, 7) +
      L('M17 68h65', B, 7) +
      L('M25 73h50', W, 3) +
      R(6, 42, 15, 37, W, 4)
    );
  if (f === 3)
    return (
      R(19, 20, 59, 25, B, 3) +
      R(19, 38, 59, 35, W, 4) +
      R(26, 45, 43, 18, Q, 3) +
      L('M19 17h60', N, 4)
    );
  return (
    P('M33 31 87 14 81 61 73 57 65 66 58 62 51 72 43 68 34 76 27 64Z', B) +
    P('M6 24h31l9 27-20 26L7 66Z', W) +
    P('M16 36h11l6 14-12 15-6-8Z', Q) +
    motif(49, 35, 22, 11, I)
  );
});
object('wrench', 'object.wrench', (f) => {
  const top =
    f === 1
      ? R(29, 8, 37, 30, B, 3) + R(43, 8, 13, 18, Q)
      : f === 3
        ? C(48, 26, 20, B) + P('m48 13 12 7v13l-12 7-12-7V20Z', Q)
        : P('M36 9v20h24V9q26 19 1 40H35Q12 28 36 9Z', B);
  return (
    R(40, 37, 16, 49, B, 6) +
    top +
    (f === 2 ? C(48, 78, 13, B) + C(48, 78, 6, Q) : R(44, 56, 8, 21, N, 3)) +
    motif(41, 40, 14, 9, I)
  );
});
object('screwdriver', 'object.screwdriver', (f) => {
  if (f === 1)
    return (
      P('M17 52h15l3-8h35v13H35l-3-8H17Z', B) +
      R(62, 40, 27, 19, T, 7) +
      P('m5 48 14-5v12Z', N) +
      motif(66, 43, 16, 10, Q)
    );
  return (
    P(f === 3 ? 'M43 8h10v36H43Z' : 'M43 9h10l-2 8v27h-6V17Z', B) +
    R(f === 2 ? 29 : 34, 40, f === 2 ? 39 : 29, 48, T, f === 2 ? 17 : 8) +
    L('M42 53v24m12-24v24', W, 3) +
    motif(40, 45, 18, 9, Q)
  );
});
object('pliers', 'object.pliers', (f) => {
  const jaw =
    f === 1
      ? P('M32 5h12v32H32m21-32h12v32H53Z', B)
      : f === 3
        ? P('M22 10h19v19h14V10h20v33H22Z', B)
        : P('m31 6 12 25h11L66 6l7 29-20 18H41L21 35Z', B);
  return (
    jaw +
    L(f === 2 ? 'M37 40 18 83m40-43 20 43' : 'M37 42 29 84m29-42 9 42', T, 11) +
    C(48, 39, 11, B) +
    C(48, 39, 4, N) +
    motif(41, 33, 14, 11, I)
  );
});
object(
  'shovel',
  'object.shovel',
  (f) =>
    L('M48 23v38', W, 7) +
    L('M34 8h28v12L48 29 34 20Z', N, 5) +
    P(
      [
        'M27 57h43v18L48 91 27 75Z',
        'M22 55h52v32H22Z',
        'M32 57h32l8 15-24 21-24-21Z',
        'M20 61q28-17 56 0v22H20Z',
        'M33 56h30v24L48 93 33 80Z',
      ][f],
      B,
    ) +
    motif(36, 64, 24, 11, I),
);
object('rake', 'object.rake', (f) => {
  const fan = f === 1 || f === 3;
  return (
    L('M48 10v53', W, 6) +
    (fan
      ? repeat(7, (i) => L(`M48 49 ${13 + i * 12} 77v12`, B, 3))
      : L('M13 65h70', B, 6) +
        repeat(f === 2 ? 5 : 7, (i) => L(`M${14 + i * (f === 2 ? 17 : 11)} 64v23`, B, 4))) +
    R(42, 44, 12, 18, N, 3) +
    motif(43, 47, 10, 10, I)
  );
});
object('watering-can', 'object.watering-can', (f) => {
  const b =
    f === 1 ? E(46, 56, 25, 27, V) : f === 3 ? P('M23 31h43l9 52H17Z', V) : R(23, 33, 47, 49, V, 8);
  return (
    L(f === 2 ? 'M29 36Q9 7 51 9q34 0 16 33' : 'M27 45Q0 24 8 55l17 11', D, 6) +
    P('m65 49 16-23 9 3-17 38Z', V) +
    P('m77 25 6-9 12 13-9 8Z', B) +
    b +
    R(33, 26, 24, 8, D, 3) +
    motif(33, 48, 28, 21, F)
  );
});
object('bucket', 'object.bucket', (f) => {
  if (f === 1)
    return E(48, 48, 35, 34, B) + E(48, 43, 28, 24, I) + L('M15 36Q48 4 82 36', N, 5) + spots(B);
  const b = f === 2 ? R(22, 32, 53, 53, B, 4) : P('M15 29h67L71 86H27Z', B);
  return (
    L('M18 40V25Q48-8 79 25v15', N, 4) +
    b +
    E(48, 29, 34, 9, I) +
    L('M21 53h56m-52 21h47', N, 3) +
    motif(32, 44, 32, 24, Q)
  );
});
object(
  'broom',
  'object.broom',
  (f) =>
    L(f === 1 ? 'M73 8 46 60' : 'M48 8v50', W, 6) +
    P(
      [
        'M32 47h32L81 89H15Z',
        'm35 52 30 8 16 22H15Z',
        'M34 48h28l8 39H26Z',
        'M22 51h52v34H22Z',
        'M31 48h35l21 28-47 16-21-20Z',
      ][f],
      Y,
    ) +
    L('M33 62 27 84m16-22-3 22m12-22 2 22m10-22 5 22', W, 2) +
    L('M31 53h35', T, 5) +
    motif(38, 65, 20, 10, Q),
);
object('dustpan', 'object.dustpan', (f) => {
  const handle = f === 1 ? L('M49 52V8', W, 6) : P('M41 13h15v41H41Z', B) + R(45, 18, 7, 17, Q, 3);
  return (
    handle +
    P(f === 2 ? 'M18 44h59v42H18Z' : 'M27 43h43l16 42H10Z', B) +
    P('M30 50h36l8 26H21Z', I) +
    L('M10 85h76', N, 5) +
    motif(35, 57, 27, 12, N)
  );
});
object('comb', 'object.comb', (f) => {
  if (f === 1 || f === 3)
    return (
      R(40, 49, 16, 41, W, 6) +
      E(48, 29, 25, 28, T) +
      repeat(4, (r) => repeat(4, (c) => C(34 + c * 9, 15 + r * 9, 2, N))) +
      motif(40, 58, 16, 14, Q)
    );
  return (
    R(12, 20, 73, 19, T, f === 2 ? 12 : 4) +
    repeat(f === 4 ? 7 : 11, (i) =>
      R(16 + i * (f === 4 ? 10 : 6), 34, f === 4 ? 5 : 3, 43 - (i % 2) * 6, W, 2),
    ) +
    motif(32, 23, 34, 12, Q)
  );
});
object('toothbrush', 'object.toothbrush', (f) => {
  if (f === 1)
    return (
      R(17, 54, 61, 12, B, 6) +
      P('M74 54V32h10v29Z', B) +
      R(61, 21, 23, 14, I, 3) +
      L('M66 22v12m7-12v12m7-12v12', N, 2) +
      spots(I)
    );
  return (
    R(f === 2 ? 37 : 42, 36, f === 2 ? 22 : 12, 55, B, 6) +
    R(35, 8, 26, 36, I, 4) +
    L('M39 11v29m7-29v29m7-29v29m5-29v29', N, 2) +
    motif(42, 60, 12, 16, I)
  );
});
object('hairdryer', 'object.hair-dryer', (f) => {
  if (f === 1)
    return (
      C(48, 35, 27, B) +
      C(48, 35, 20, N) +
      L('M37 24v22m11-25v29m11-26v22', I, 3) +
      R(40, 56, 16, 31, B, 5) +
      L('M48 87q19 9 27 1', N, 2)
    );
  return (
    P(f === 3 ? 'M18 23h53l17 21-20 15H18Z' : 'M13 23q21-13 48 1l22 5v28l-22 6q-33 7-48-10Z', B) +
    P('m35 58 23-1 3 26H40Z', B) +
    R(10, 26, 14, 28, N, 5) +
    L('M49 85q-7 9 14 9', N, 2) +
    motif(35, 32, 26, 18, I)
  );
});
object('iron', 'object.iron', (f) => {
  if (f === 1)
    return (
      P('M48 7Q78 29 76 82H20Q19 29 48 7Z', B) +
      P('M48 20Q66 38 65 72H31Q29 38 48 20Z', I) +
      repeat(3, (r) => repeat(3, (c) => C(37 + c * 11, 48 + r * 10, 2, N)))
    );
  return (
    L('M29 45V24h34l8 22', N, 7) +
    P(f === 2 ? 'M9 76Q27 38 71 42l17 34Z' : 'M9 76 31 45h42l15 31Z', B) +
    L('M9 80h79', N, 5) +
    motif(35, 54, 29, 16, I)
  );
});
object('sewing-machine', 'object.sewing-machine', (f) => {
  const body =
    f === 1
      ? P('M15 28h54v41H57V43H25V58H15Z', N)
      : P('M13 31q-2-14 19-14h32q18 0 18 23v37H60V42H28v20H13Z', B);
  return (
    R(8, 76, 80, 10, W, 3) +
    body +
    C(79, 38, 11, W) +
    C(79, 38, 5, I) +
    L('M21 54v22m27-59V8m-7 0h15', N, 3) +
    motif(35, 23, 24, 12, I) +
    (f === 3 ? L('M16 87v7m65-7v7', W, 4) : '')
  );
});
object('stapler', 'object.stapler', (f) => {
  if (f === 1)
    return (
      R(29, 14, 38, 71, N, 6) +
      R(32, 14, 32, 52, B, 6) +
      R(38, 69, 19, 10, I, 2) +
      motif(37, 26, 23, 24, I)
    );
  return (
    P('M13 66h71l3 15H9Z', N) +
    P(
      f === 2
        ? 'M13 62 59 9l16 13-47 51Z'
        : f === 3
          ? 'M14 39q43-30 64-5l9 31H14Z'
          : 'M13 28h62l12 25-7 13H13Z',
      B,
    ) +
    L('M18 63h62', I, 4) +
    motif(29, 34, 31, 15, I)
  );
});
object('pencil', 'object.pencil', (f) => {
  const one =
    P('M38 18h20v51L48 91 38 69Z', Y) +
    P('M38 69h20L48 91Z', Q) +
    P('m43 81 5 10 5-10Z', N) +
    R(38, 7, 20, 14, A, 3) +
    L('M43 23v42m10-42v42', W, 2) +
    motif(42, 31, 12, 18, Q);
  if (f === 1) return G(one, 'rotate(44 48 48) translate(10 10) scale(.8)');
  if (f === 2) return G(one, 'translate(-10 2) scale(.8)') + G(one, 'translate(27 9) scale(.82)');
  if (f === 3)
    return G(one, 'translate(9 20) scale(.8 .65)') + R(10, 64, 27, 23, B, 4) + C(23, 74, 7, N);
  return f === 4 ? G(one, 'rotate(-24 48 48) translate(8 8) scale(.83)') : one;
});
object('paintbrush', 'object.paintbrush', (f) => {
  const tip =
    f === 1
      ? P('M29 35V8h37v27Z', W)
      : f === 2
        ? P('M26 34 13 9q33-16 70 0L65 34Z', W)
        : P('M34 33Q30 13 51 5q-4 16 12 28Z', W);
  const b = tip + R(33, 30, 31, 14, B, 2) + P('M39 44h20l-6 47H44Z', T) + motif(39, 32, 19, 9, I);
  return f === 3
    ? G(b, 'rotate(30 48 48) translate(9 9) scale(.8)')
    : f === 4
      ? G(b, 'translate(-8 0) scale(.8)') + G(b, 'translate(29 17) scale(.75)')
      : b;
});

function garment(kind, f) {
  let body = '';
  if (kind === 'shirt')
    body =
      P(
        [
          'M30 14 14 23 4 46l17 9 9-15v44h37V40l9 15 16-9-10-23-17-9-17 9Z',
          'M29 16 14 22 4 72l17 6 10-33v40h36V45l10 33 15-6-9-50-17-6-18 9Z',
          'M30 14h12l6 11 7-11h12v70H30Z',
          'M29 14 12 32l15 15 6-9v45h32V38l6 9 14-15-17-18-20 9Z',
          'M32 13 12 24 5 51l15 6 11-18v46h35V39l10 18 15-6-10-27-17-11-16 8Z',
        ][f],
        B,
      ) +
      L('M42 15 48 25l8-10', I, 3) +
      (f === 4 ? L('M48 29v53', N, 3) : '');
  if (kind === 'dress')
    body =
      P(
        [
          'M32 11h12l4 11 5-11h13l-6 28 26 49H10l27-49Z',
          'M37 11h22l4 35 18 42H15l18-42Z',
          'M30 16 18 27l10 13 7-6 3 16-20 38h60L58 50l3-16 8 6 10-13-12-11-19 9Z',
          'M39 12h19l7 38 26 38H5l27-38Z',
          'M30 10h11v21h14V10h12l-6 34 18 44H18l18-44Z',
        ][f],
        A,
      ) + L('M35 44h26', W, 4);
  if (kind === 'pants')
    body =
      P(
        [
          'M23 11h50l7 75H54l-6-51-6 51H16Z',
          'M24 11h49l2 53H54l-6-30-6 30H22Z',
          'M28 11h40l-7 36 22 39H55L48 48 40 86H13l22-39Z',
          'M21 13h55L66 85H52l-4-48-5 48H29Z',
          'M24 10h47l7 73H52l-4-37-4 37H18Z',
        ][f],
        B,
      ) + L('M25 21h46M48 22v13', N, 3);
  if (kind === 'skirt')
    body =
      P(
        [
          'M32 15h32l22 70H10Z',
          'M25 16h46l-3 69H29Z',
          'M34 16h29L80 62 67 88 50 77 29 87 16 67Z',
          'M31 14h34l20 47H12Z',
          'M30 15h36l2 28 19 40H9l19-40Z',
        ][f],
        A,
      ) + L('M31 25h34M39 35 27 78m22-43v43m10-43 12 35', H, 3);
  if (kind === 'coat')
    body =
      P(
        [
          'M31 11 13 24 5 69l17 6 8-31v44h37V44l8 31 16-6-8-45-18-13-17 11Z',
          'M30 13 13 25 5 62l16 7 10-26-10 44h55L65 43l10 26 16-7-9-37-17-12-17 11Z',
          'M30 18 14 24 9 76l15 4 8-32v38h34V48l7 32 14-4-5-52-18-6Z',
          'M32 12h32l9 74H23Z',
          'M29 12 12 26 5 77l17 3 7-34v42h39V46l8 34 15-3-9-51-17-14-17 12Z',
        ][f],
        T,
      ) +
      P('m34 15 14 11-9 20-8-20m31-11-14 11 9 20 8-20Z', Q) +
      L('M48 30v55', W, 3);
  return body + motif(37, 51, 22, 18, kind === 'shirt' || kind === 'pants' ? I : Q);
}
[
  ['shirt', 'object.shirt'],
  ['dress', 'object.dress'],
  ['pants', 'object.trousers'],
  ['skirt', 'object.skirt'],
  ['coat', 'object.coat'],
].forEach(([id, zh]) => object(id, zh, (f) => garment(id, f)));
object('gloves', 'object.gloves', (f) => {
  const mitten = P('M26 80V38q-12-15-17-3L7 55l20 20m0 5h38V25q0-25-30-15-9 4-9 15Z', B);
  const fingers = P(
    'M25 84V55L8 43q-7-12 6-15l16 12V13q0-12 9-3v22V8q7-11 10 0v25l2-23q8-7 10 2v24l4-18q9-5 9 4v44L62 84Z',
    B,
  );
  const one = (f % 2 ? fingers : mitten) + R(23, 75, 43, 13, I, 3) + motif(36, 44, 21, 18, Q);
  return f === 2 || f === 4
    ? G(one, 'translate(-2 0) scale(.72)') + G(one, 'translate(40 22) scale(.72)')
    : one;
});
object('scarf', 'object.scarf', (f) => {
  const body = [
    P('M21 15h54v23H59v48H40V38H21Z', A),
    P('M23 11h24v54l31 7-5 19-50-12Z', A),
    P('M24 14q27-17 49 5l-8 30-11-9-2 46H31l5-44-14-7Z', A),
    P('M15 20h65v24L60 59l20 19-13 14-30-31 20-18H15Z', A),
    P('M30 7h22v58l25-13 12 19-44 21-15-18Z', A),
  ][f];
  return body + L('M30 22h34m-26 28h16m-17 14h16', H, 5) + motif(39, 71, 13, 9, Q);
});
object('socks', 'object.socks', (f) => {
  const body =
    P(
      f === 1
        ? 'M34 10h33v38l-9 27-34 12Q3 80 15 64l20-12Z'
        : f === 3
          ? 'M30 27h37v22l-7 25-39 14q-22-8-8-25l18-12Z'
          : 'M34 9h34v52L49 80 22 89Q-1 78 13 66l21-13Z',
      B,
    ) +
    R(34, f === 3 ? 27 : 10, 34, 12, I) +
    P('m22 61 13 14-15 9q-13-6-8-15Z', N) +
    motif(41, 31, 20, 17, I);
  return f === 2 || f === 4
    ? G(body, 'translate(-1 0) scale(.72)') + G(body, 'translate(35 20) scale(.72)')
    : body;
});
object('glasses', 'object.glasses', (f) => {
  const lens =
    f === 1
      ? R(7, 29, 32, 31, B, 4) + R(57, 29, 32, 31, B, 4)
      : f === 2
        ? P('M5 22 43 33l-8 29H14Zm48 11 38-11-9 40H61Z', N)
        : C(25, 47, 20, f === 3 ? N : B) + C(72, 47, 20, f === 3 ? N : B);
  return (
    lens +
    L('M42 44q6-7 12 0M6 41 3 23m87 18 3-18', W, 4) +
    L('m14 39 9-6m40 6 10-6', I, 4) +
    motif(60, 44, 22, 9, I)
  );
});
object('watch', 'object.wristwatch', (f) => {
  const band = P(
    f === 1 ? 'M33 7h30l-3 24v39l3 19H33l3-19V31Z' : 'M34 7h29v82H34Z',
    f === 3 ? N : W,
  );
  const face =
    f === 2
      ? R(19, 26, 58, 43, B, 9) + R(26, 32, 44, 31, N, 3) + L('M36 40h8v15m10-15h9v15', I, 3)
      : C(48, 47, 29, B) + C(48, 47, 23, Q) + L('M48 29v18l12 9', N, 3);
  return band + face + motif(37, 73, 23, 10, T);
});
object('ring', 'object.ring', (f) => {
  const band =
    f === 1 ? E(48, 57, 32, 23, Y) + E(48, 57, 24, 16, Q) : C(48, 57, 28, Y) + C(48, 57, 21, Q);
  const jewel = [
    P('m27 24 11-14h22l12 14-24 23Z', B),
    C(48, 28, 15, A),
    P('m48 8 20 19-20 20-20-20Z', V),
    C(48, 27, 17, I) + C(48, 27, 10, B),
    P('M29 16h39v29H29Z', N),
  ][f];
  return band + jewel + motif(38, 20, 21, 13, I);
});
object('crown', 'object.crown', (f) => {
  const b = [
    P('M15 76 8 23l22 21 18-32 18 32 23-21-9 53Z', Y),
    P('M17 72 9 31l18 13 9-31 13 30 14-30 8 31 18-13-8 41Z', Y),
    P('M16 69Q7 24 48 16 89 24 80 69Z', Y) + P('M25 64Q19 33 48 27q30 7 23 37Z', Q),
    P('M17 73 10 18l26 32 12-42 13 42 26-32-8 55Z', Y),
    P('M12 66 21 37l11 13 17-30 18 30 9-13 10 29Z', Y),
  ][f];
  return b + R(15, 68, 66, 15, W, 4) + motif(29, 51, 40, 12, A) + L('M23 76h50', Q, 3);
});
object('mask', 'object.mask', (f) => {
  const b = [
    P('M10 20q19 4 38-3 19 7 38 3v33Q68 84 48 89 28 84 10 53Z', T),
    P('M9 28 28 14l20 13 20-13 19 14-8 33-23 8-8-13-8 13-23-8Z', A),
    P('M16 17 34 9l14 9L63 8l18 10-6 48-27 22-27-22Z', B),
    P('M10 31 27 14l21 11 21-11 17 17-9 26-20 9-9-8-9 8-21-9Z', V),
    P('M22 13h52l10 35-14 31-22 10-22-10-14-31Z', Y),
  ][f];
  return (
    b +
    E(31, 40, 10, 7, Q, -15) +
    E(65, 40, 10, 7, Q, 15) +
    L('M33 63q15 13 30 0', W, 3) +
    motif(38, 20, 20, 12, Q)
  );
});
object('violin', 'object.violin', (f) => {
  const b =
    P(
      f === 1
        ? 'M30 39q-17-7-15 9l15 15q-18 17 2 25h32q18-9 0-25l15-15q1-16-14-9Z'
        : 'M31 40q-18 5-3 22-21 13-6 26 23 10 47-1 11-15-9-25 15-16-3-22Z',
      T,
    ) +
    R(41, 20, 13, 46, W) +
    E(48, 12, 10, 10, W) +
    L('M44 13v70m7-70v70', I, 1.5) +
    L('M32 65q-9 5-3 11m34-11q9 5 3 11', N, 3) +
    R(35, 80, 24, 4, W) +
    L('M83 10v79', W, 3) +
    motif(35, 70, 25, 7, Q);
  return f === 2
    ? G(b, 'rotate(-20 48 48) translate(8 8) scale(.83)')
    : f === 3
      ? G(b, 'translate(7 -6) scale(.9)')
      : b;
});
object('trumpet', 'object.trumpet', (f) => {
  if (f === 1)
    return (
      C(48, 46, 33, Y) +
      C(48, 46, 24, W) +
      C(48, 46, 16, N) +
      L('M42 76v15m11-15v15', Y, 4) +
      spots(Q)
    );
  return (
    P('M60 35 86 16v60L60 58Z', Y) +
    L('M8 45h53m-44 0v20q0 15 20 15h20V46', Y, 9) +
    L('M28 33v29m12-29v29m12-29v29M6 37v17', W, 4) +
    motif(64, 38, 16, 16, Q)
  );
});
object('piano', 'object.piano', (f) => {
  if (f === 1 || f === 3)
    return (
      P('M19 20q49-20 65 8l-8 35H19Z', N) +
      P('M19 20 73 4l11 24Z', W) +
      R(15, 59, 66, 17, I, 2) +
      repeat(9, (i) => L(`M${20 + i * 7} 59v17`, N, 1.5)) +
      repeat(6, (i) => R(25 + i * 9, 59, 4, 10, N)) +
      feet(f, 23, 75, 50)
    );
  return (
    R(12, 18, 74, 47, N, 5) +
    R(12, 58, 74, 18, I) +
    repeat(10, (i) => L(`M${17 + i * 7} 58v18`, N, 1.5)) +
    repeat(7, (i) => R(20 + i * 9, 58, 4, 11, N)) +
    feet(f) +
    motif(32, 30, 35, 17, Y)
  );
});
object('harp', 'object.harp', (f) => {
  const frame = f === 1 ? 'M17 13h64L65 84H35Z' : 'M18 14Q53 37 80 10L69 85H37Z';
  return (
    L(frame, W, 8) +
    repeat(6, (i) => L(`M${29 + i * 7} ${25 - i * 1.8} ${39 + i * 5} 79`, Y, 1.7)) +
    R(31, 83, 44, 7, W, 2) +
    motif(59, 71, 10, 8, Q)
  );
});
object('accordion', 'object.accordion', (f) => {
  const bellows =
    P(f === 1 ? 'M30 16 68 28v55L30 69Z' : 'M28 23h41v53H28Z', A) +
    repeat(6, (i) => L(`M${32 + i * 6} ${f === 1 ? 19 + i * 2 : 25}v48`, W, 3));
  return (
    bellows +
    R(9, 15, 23, 68, N, 5) +
    R(66, 18, 23, 68, N, 5) +
    R(13, 22, 15, 55, I, 1) +
    repeat(7, (i) => L(`M14 ${28 + i * 7}h12`, N, 2)) +
    repeat(5, (i) => C(76, 30 + i * 10, 2, I)) +
    motif(38, 37, 22, 18, H)
  );
});
object('flute', 'object.flute', (f) => {
  const b =
    L(f === 1 ? 'M12 69 86 29' : 'M10 70 86 19', B, f === 3 ? 13 : 8) +
    repeat(f === 2 ? 5 : 7, (i) => C(26 + i * 8, 59 - i * 5, 3, N)) +
    L('M9 63 16 75m62-63 11 14', N, 3) +
    motif(47, 44, 13, 8, I);
  return f === 4 ? G(b, 'rotate(-42 48 48)') : b;
});
object('saxophone', 'object.saxophone', (f) => {
  const b =
    L(f === 1 ? 'M32 17h20v49q0 21 20 14l5-29' : 'M25 13q24-6 27 17v36q-2 25 22 13l3-21', Y, 13) +
    P('M65 61 86 35l6 37Z', Y) +
    L('M24 14 12 11', N, 7) +
    repeat(5, (i) => C(48, 34 + i * 8, 3, W)) +
    motif(63, 66, 13, 9, Q);
  return f === 2 ? G(b, 'translate(96 0) scale(-1 1)') : b;
});

object('motorcycle', 'object.motorcycle', (f) => {
  if (f === 1)
    return (
      C(48, 73, 15, N) +
      R(39, 47, 18, 35, B, 5) +
      L('M14 34h67M27 34l6 20m33-20-6 20', N, 5) +
      R(29, 22, 37, 34, T, 10) +
      C(48, 36, 10, Q) +
      spots(N)
    );
  return (
    wheel(21, 71, 18) +
    wheel(76, 71, 18) +
    P(f === 3 ? 'M22 40h36l11 24H36Z' : 'M30 43q11-19 28-4l7 23H31Z', T) +
    L('M22 71 45 50l10 21H22m36-40 18 40m-19-42 13-7M21 38h21', N, 5) +
    L('M41 66h23', B, 7) +
    motif(37, 44, 22, 11, Q)
  );
});
object('bus', 'object.bus', (f) => {
  if (f === 1)
    return (
      R(22, 10, 52, 73, B, 10) +
      R(28, 22, 40, 29, I, 4) +
      R(30, 9, 36, 9, N, 3) +
      C(33, 70, 5, Y) +
      C(63, 70, 5, Y) +
      L('M29 85v6m38-6v6', N, 7) +
      spots(N)
    );
  return (
    R(7, f === 2 ? 15 : 32, 82, f === 2 ? 61 : 44, B, 6) +
    repeat(5, (i) => R(13 + i * 15, f === 2 ? 21 : 38, 11, 16, I, 2)) +
    (f === 2 ? repeat(5, (i) => R(13 + i * 15, 42, 11, 14, I, 2)) : '') +
    wheel(24, 76, 11) +
    wheel(72, 76, 11) +
    motif(34, 59, 28, 9, Q)
  );
});
object('truck', 'object.truck', (f) => {
  const load = [
    R(8, 16, 48, 53, T, 3),
    P('M7 22h48l-7 45H11Z', Y),
    E(31, 41, 27, 24, I),
    R(10, 33, 43, 31, W, 2) + L('M18 33v31m11-31v31m11-31v31', Q, 2),
    P('M8 48h47v15H8Z', W) + C(20, 35, 12, T) + C(41, 35, 12, T),
  ][f];
  return (
    load +
    P('M59 32h18l14 20v20H57Z', B) +
    P('M64 38h11l9 16H64Z', I) +
    L('M8 72h82', N, 6) +
    wheel(24, 77, 11) +
    wheel(74, 77, 11) +
    motif(17, 39, 29, 13, Q)
  );
});
object('tractor', 'object.tractor', (f) => {
  if (f === 1)
    return (
      R(27, 19, 44, 60, V, 4) +
      R(32, 26, 34, 25, I, 2) +
      R(17, 57, 18, 32, N, 5) +
      R(64, 57, 18, 32, N, 5) +
      L('M39 61v17m9-17v17m9-17v17', D, 3) +
      spots(Q)
    );
  return (
    R(14, 29, 31, 40, V, 4) +
    R(20, 34, 21, 21, I, 2) +
    R(41, 47, 42, 26, V, 3) +
    L('M68 48V25m-55 3h36', N, 5) +
    wheel(28, 72, 20) +
    wheel(75, 76, f === 2 ? 18 : 12) +
    motif(52, 53, 21, 12, F)
  );
});
object('excavator', 'object.excavator', (f) => {
  const arm =
    f === 1
      ? 'M42 49 30 9 73 22l12 35'
      : f === 3
        ? 'M43 46 66 12 85 35 71 65'
        : 'M45 45 60 10 83 27v33';
  return (
    R(6, 72, 57, 16, N, 8) +
    C(18, 80, 5, B) +
    C(48, 80, 5, B) +
    R(10, 48, 49, 26, Y, 4) +
    P('M16 48V28h24l8 20Z', Y) +
    R(21, 32, 15, 18, I, 2) +
    L(arm, Y, 9) +
    P('M71 57h20l-2 25H69L59 73Z', W) +
    motif(24, 55, 23, 12, Q)
  );
});
object('helicopter', 'object.helicopter', (f) => {
  if (f === 1)
    return (
      L('M9 16h78M48 16v14m-23 54h47M32 65v19m33-19v19', N, 4) +
      E(48, 51, 26, 27, B) +
      P('M26 42h44L58 62H38Z', I) +
      L('M48 43v18', N, 3) +
      spots(Q)
    );
  return (
    L('M8 15h60m-30 0v15M15 79h53m-42-17v17m26-17v17', N, 4) +
    P('M11 52q-2-23 25-23 22 0 25 19l20-5 7-16h5v32L59 61q-32 22-48-9Z', B) +
    P('M15 48q-2-16 22-14v20H16Z', I) +
    C(86, 30, 5, N) +
    motif(35, 46, 21, 14, Q)
  );
});
object('rocket', 'object.rocket', (f) => {
  const body =
    f === 1
      ? P('M35 27 48 5l13 22v47H35Z', I)
      : f === 3
        ? P('M25 73 28 30 48 7l20 23 4 43Z', I)
        : P('M31 72Q25 27 48 5q23 22 17 67Z', B);
  return (
    P('m34 52-20 28 20-5m28-23 19 28-19-5Z', A) +
    P(f === 2 ? 'm35 73 2 22 11-13 11 13 5-22Z' : 'm36 72 12 23 13-23Z', Y) +
    body +
    C(48, 38, 12, N) +
    C(48, 38, 8, I) +
    R(33, 68, 30, 8, N, 2) +
    motif(38, 53, 21, 10, Q)
  );
});
object('submarine', 'object.submarine', (f) => {
  if (f === 1)
    return (
      E(48, 47, 30, 36, Y) +
      L('M48 11V3h15', N, 5) +
      C(48, 44, 18, B) +
      C(48, 44, 12, I) +
      P('m20 45-13 26 20-7m49-19 13 26-20-7Z', W) +
      spots(N)
    );
  return (
    R(10, 32, 77, 43, Y, 20) +
    P('M35 32V20h28v13Z', Y) +
    L('M48 20V7h15v6', N, 4) +
    repeat(
      f === 2 ? 4 : 3,
      (i) => C(28 + i * (f === 2 ? 14 : 21), 52, 7, B) + C(28 + i * (f === 2 ? 14 : 21), 52, 4, I),
    ) +
    L('M88 41v25M9 52H3', N, 4) +
    motif(36, 65, 26, 7, W)
  );
});
object('balloon', 'object.hot-air-balloon', (f) => {
  const dome =
    f === 1
      ? P('M22 14h52l13 28-24 24H33L9 42Z', T)
      : f === 3
        ? P('M19 14q29-23 58 0l-6 37-23 16-23-16Z', B)
        : E(48, 31, 32, 30, A);
  return (
    dome +
    P('M31 50h35L57 70H39Z', f === 3 ? B : A) +
    L('M38 67 37 80m21-13 1 13', W, 2) +
    R(35, 78, 25, 14, W, 3) +
    (f === 2 ? L('M30 14q-12 31 12 50m20-50q12 31-12 50', Q, 6) : motif(29, 23, 39, 24, Q))
  );
});
object('cablecar', 'object.cable-car', (f) => {
  const box = f === 1 ? P('M22 40h52l10 32-11 16H23L12 72Z', A) : R(16, 37, 64, 48, A, 8);
  return (
    L(f === 3 ? 'M5 26 90 8' : 'M5 14h85', N, 3) +
    L('M47 16v22', N, 5) +
    C(48, 15, 7, N) +
    box +
    R(23, 44, 50, 22, I, 3) +
    L(f === 2 ? 'M39 45v20m18-20v20' : 'M48 44v21', N, 2) +
    motif(33, 71, 30, 9, Q)
  );
});
object('skateboard', 'object.skateboard', (f) => {
  if (f === 1 || f === 3)
    return (
      R(28, 6, 40, 84, f === 1 ? W : B, 19) +
      R(31, 21, 34, 54, N, 8) +
      L('M20 24h55m-55 48h55', B, 6) +
      C(22, 24, 6, N) +
      C(74, 24, 6, N) +
      C(22, 72, 6, N) +
      C(74, 72, 6, N) +
      motif(37, 35, 22, 27, Y)
    );
  return (
    L(f === 2 ? 'M7 40q38 26 80 0' : 'M7 41l11 15h59l11-15', W, 9) +
    wheel(27, 69, 11) +
    wheel(69, 69, 11) +
    motif(30, 46, 31, 8, Q)
  );
});
object('rollerskate', 'object.roller-skate', (f) => {
  const boot =
    P(f === 1 ? 'M22 11h30v35l28 12 6 17H18Z' : 'M19 17h31l8 32 22 6 6 19H15Z', T) +
    L('M41 30h13m-12 10h15m-10 10h17', Q, 4) +
    R(14, 74, 72, 6, N, 2);
  return (
    boot +
    (f === 2
      ? repeat(4, (i) => wheel(21 + i * 19, 85, 8))
      : wheel(28, 84, 10) + wheel(70, 84, 10)) +
    motif(24, 44, 16, 15, Q)
  );
});
object('soccer', 'object.football', (f) => {
  const b =
    C(48, 48, 35, I) +
    P('m48 29 18 13-7 21H36l-7-21Z', N) +
    P('m29 18-5 18-12 5 3-19m53-4 5 18 11 5-3-19M18 68l20 2 3 15m37-17-20 2-3 15Z', N) +
    L('M29 36 29 42m44-6-7 6M36 63 28 73m31-10 10 10M48 13v16', B, 2) +
    motif(40, 44, 16, 11, B);
  return f === 1
    ? G(b, 'translate(1 16) scale(.72)') + L('M65 66V17h24v49m-24-37h24m-24 17h24M77 18v48', N, 2)
    : f === 2
      ? G(b, 'translate(20 20) scale(.7)') + L('M7 47h25M14 32h21m-20 30h18', B, 3)
      : b;
});
object('basketball', 'object.basketball', (f) => {
  const ball =
    C(48, 48, 35, T) +
    L('M13 48h70M48 13v70M24 23q41 25 0 50m48-50q-41 25 0 50', W, 3) +
    motif(37, 41, 22, 13, Y);
  if (f === 1 || f === 3)
    return (
      R(39, 4, 48, 29, I, 2) +
      R(53, 11, 21, 15, T, 2) +
      E(63, 31, 22, 5, A) +
      L('m42 31 9 25h23l11-25M53 33l5 22m14-22-4 22', I, 2) +
      G(ball, 'translate(-3 35) scale(.6)')
    );
  return f === 2 ? G(ball, 'translate(4 0) scale(.85)') + E(48, 89, 29, 4, B) : ball;
});
function racket(f, badminton = false) {
  const head = badminton ? E(48, 31, 23, 28, B) : E(48, 31, 28, 28, T);
  const inside =
    E(48, 31, badminton ? 18 : 23, 23, I) +
    repeat(4, (i) => L(`M${36 + i * 8} 14v35M30 ${19 + i * 8}h36`, N, 1));
  return (
    head + inside + L('M48 58v31', W, 8) + L('M44 70h8m-8 8h8', Q, 2) + motif(38, 25, 20, 11, B)
  );
}
object('tennis', 'object.tennis-racket', (f) => {
  const r = racket(f);
  return (
    (f === 1
      ? G(r, 'rotate(-25 48 48) translate(8 8) scale(.8)')
      : f === 3
        ? G(r, 'translate(-10 0) scale(.8)') + G(r, 'translate(33 21) scale(.72)')
        : r) +
    C(f === 1 ? 76 : 78, 75, 12, F) +
    L('M72 65q-7 10 2 20', Q, 2)
  );
});
object('badminton', 'object.badminton-racket', (f) => {
  const r = racket(f, true),
    shuttle =
      P('M67 78 61 50l27 1-9 27Z', I) + L('m66 53 6 22m7-22-4 22', B, 2) + E(73, 79, 7, 5, W);
  return (
    (f === 1
      ? G(r, 'rotate(25 48 48) translate(8 8) scale(.8)')
      : f === 2
        ? G(r, 'translate(-12 0) scale(.86)')
        : r) + shuttle
  );
});
object('bowling', 'object.bowling', (f) => {
  const pin =
    E(48, 20, 8, 12, I) +
    P('M41 27h14q-1 13 9 29 13 34-16 34-28 0-16-34 10-16 9-29Z', I) +
    L('M40 32h16m-16 7h16', A, 4);
  const pins =
    f === 1 || f === 3
      ? G(pin, 'translate(-11 -1) scale(.7)') +
        G(pin, 'translate(24 -1) scale(.7)') +
        G(pin, 'translate(13 20) scale(.78)')
      : G(pin, 'translate(17 -2) scale(.85)');
  return (
    pins +
    C(25, 71, f === 2 ? 24 : 21, N) +
    C(21, 64, 3, I) +
    C(32, 64, 3, I) +
    C(27, 74, 3, I) +
    motif(13, 75, 18, 8, B)
  );
});
object('dumbbell', 'object.dumbbell', (f) => {
  const b =
    L('M11 48h75', N, 11) +
    R(14, 22, 17, 53, B, 5) +
    R(65, 22, 17, 53, B, 5) +
    R(7, 32, 10, 33, N, 4) +
    R(80, 32, 10, 33, N, 4) +
    motif(19, 37, 9, 22, I);
  if (f === 1) return G(b, 'rotate(-35 48 48) translate(8 8) scale(.84)');
  if (f === 2) return C(48, 57, 29, B) + L('M30 33V14h37v19', N, 8) + spots(I);
  return f === 3 ? G(b, 'translate(1 -3) scale(.72)') + G(b, 'translate(25 39) scale(.69)') : b;
});
object('tent', 'object.tent', (f) => {
  const body = [
    P('M48 13 89 84H7Z', T) + P('M48 30 69 84H27Z', N),
    P('M10 82Q8 14 48 16q40-2 38 66Z', B) + P('M32 82V52q16-26 32 0v30Z', N),
    P('M33 12 76 20l18 62H9Z', T) + P('m33 12 27 70H9Z', Y) + P('m33 35 15 47H19Z', N),
    P('M13 34h70L72 84H23Z', V) + P('M8 34 25 12h47l17 22Z', F) + R(38, 42, 24, 42, N),
    P('M48 8 79 84H17Z', Q) + P('m48 36 18 48H31Z', W),
  ][f];
  return body + L('M15 63 4 88m78-25 10 25', W, 2) + motif(22, 53, 14, 16, Q);
});
object('bridge', 'object.bridge', (f) => {
  if (f === 1)
    return (
      P('M8 42q40-47 80 0v41H74V58Q48 18 22 58v25H8Z', W) +
      L('M10 28q39-34 76 0', N, 3) +
      L('M11 84h75', B, 3) +
      motif(39, 25, 20, 8, Q)
    );
  const road = R(6, 58, 84, 11, W) + L('M19 23v62m58-62v62', N, 5);
  const cables =
    f === 2
      ? L('M19 24 45 58m32-34L48 58m-28-3 5-20m47 20-4-20', N, 2)
      : L('M8 34q40 38 80 0M17 41v17m13-10v10m13-7v7m13-7v7m13-10v10m13-17v17', N, 2);
  return road + cables + L('M7 89q10-8 20 0t20 0 20 0 20 0', B, 3) + motif(33, 60, 30, 6, Q);
});
