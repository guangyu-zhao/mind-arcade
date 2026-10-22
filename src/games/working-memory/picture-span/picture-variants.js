const P = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const L = (d, color, width = 3) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const E = (x, y, rx, ry, fill, angle = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle} ${x} ${y})"/>`;
const R = (x, y, w, h, fill, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
const G = (content, transform) => `<g transform="${transform}">${content}</g>`;
const B = '#819eaf',
  N = '#466175',
  I = '#e5edf0';
const W = '#947258',
  Y = '#d4a45b',
  Q = '#f6e3bc';
const V = '#769768',
  D = '#486d4b',
  F = '#acc49a';
const A = '#c98999',
  H = '#edc7ce',
  T = '#c9967c';
const definitions = [];

// Each category supplies its own geometry; the banks choose how it is composed.
function add(category, label, render, normal = null) {
  definitions.push({ category, label, render, normal });
}
const eye = (x, y) => C(x, y, 2.8, '#524b3c');
const wheel = (x, y, r = 11) => C(x, y, r, N) + C(x, y, r * 0.5, I);
const win = (x, y, w = 12, h = 12) =>
  R(x, y, w, h, B, 1) + L(`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`, I, 2);
function motif(x, y, w, h, color = Q) {
  return L(`M${x + w * 0.18} ${y + h * 0.5}h${w * 0.64}`, color, 5);
}

add('umbrella', 'ui.umbrella', (f) => {
  const canopy = [
    'M9 45Q12 7 48 9 84 7 87 45L73 38 61 46 48 38 35 46 23 38Z',
    'M10 44 28 24 48 12 68 24 86 44 66 40 48 49 30 40Z',
    'M12 46Q22 27 32 27L48 8 64 27Q79 29 84 46L65 42 48 51 31 42Z',
    'M9 36Q48 13 87 36L79 51 64 42 48 52 32 42 17 51Z',
    'M14 21Q48 9 82 21v28L66 43 48 52 30 43 14 49Z',
  ][f];
  const ribs = L('M48 15Q29 26 31 42M48 15Q66 26 65 42', N, 2.5);
  const handle = L('M48 44v30q0 16-16 7', W, 4);
  return P(canopy, B) + ribs + handle + L('M48 8v6', W, 3);
});

add('fish', 'ui.fish', (f) => {
  const body = [
    'M11 47Q30 14 65 34L73 48 62 64Q29 79 11 47Z',
    'M13 48Q14 18 42 19 71 23 68 49 69 77 40 77 14 75 13 48Z',
    'M13 47 47 15 64 36 68 51 47 80Z',
    'M8 43Q22 28 42 43T72 46L70 60Q53 78 34 55T8 54Z',
    'M10 45 28 27 55 29 70 47 55 68 27 66 10 54Z',
  ][f];
  const tail = P('m63 45 24-20-4 44-20-15Z', Y);
  const fins = P('m34 28 12-18 9 23m-20 34 14 17 7-20Z', W);
  return (
    tail + fins + P(body, Y) + motif(33, 35, 25, 24, Q) + eye(23, 43) + L('M29 38q-6 9 0 19', W, 2)
  );
});

function blossom(f) {
  return [
    [0, 60, 120, 180, 240, 300].map((a) => G(E(0, -12, 7, 12, A), `rotate(${a})`)).join('') +
      C(0, 0, 8, Y),
    P('M-21-16-10-5 0-23 10-5 21-16V1Q20 22 0 22-20 22-21 1Z', A) + P('m0-23-10 18L0 11 10-5Z', H),
    Array.from({ length: 10 }, (_, i) => G(E(0, -16, 5, 11, Y), `rotate(${i * 36})`)).join('') +
      C(0, 0, 13, W) +
      motif(-9, -5, 18, 10, Q),
    P('M-18-18Q-3-29 7-16 29-19 23 2 28 23 5 22-18 31-21 10-33-8-18-18Z', A) +
      P('M-10-10Q6-21 14-5 25 12 7 14-12 21-15 3Z', H) +
      L('M-7 0q13-13 14 2L0 8', A, 4),
    P('M0 20Q-31 15-27-5L-7 7Q-26-18-9-26L0 5Q7-29 21-23L10 9Q31-14 31 2 22 21 0 20Z', A) +
      L('M0 12 11-12M0 12l-12-22', Y, 3),
  ][f];
}
add('flower', 'ui.flower', (f) => {
  const branches =
    L('M48 82V36', D, 4) + P('M47 71Q17 67 24 52q20 3 23 19M50 59q20-20 26-8-9 16-26 8Z', V);
  const heads = G(blossom(f), 'translate(48 32) scale(.85)');
  return branches + heads;
});

add('bird', 'ui.bird', (f) => {
  const body = [
    'M17 58Q10 34 38 32 45 11 65 21L74 45Q77 72 41 74H20Z',
    'M24 65Q19 42 37 33V18Q51 2 64 20L59 39Q80 71 51 78H30Z',
    'M17 49 10 25 34 39Q43 14 64 23 82 29 71 51L57 73H25Z',
    'M23 46Q19 21 44 19 71 10 75 39L68 68Q43 89 23 65Z',
    'M15 59Q26 39 48 43l7-25Q68 4 75 19L66 52Q57 77 27 71Z',
  ][f];
  const wings = P('M30 48Q58 34 58 54 45 72 30 48Z', I);
  const tails = P('m23 60-12 24 27-14Z', N);
  return (
    tails +
    P(body, B) +
    wings +
    P('m71 28 18 9-17 7Z', Y) +
    eye(62, 28) +
    L('m41 74-5 13m18-13 6 13', W, 3)
  );
});

add('tree', 'ui.tree', (f) => {
  const crown = [
    C(27, 37, 20, V) + C(65, 38, 23, V) + C(47, 22, 20, F),
    P('m48 6-22 24h11L16 49h15L9 69h78L65 49h15L60 30h11Z', V),
    P('M48 10Q13 11 10 40l10-6-1 26 12-15v27l13-26 8 27 6-29 18 24-4-36 16 17Q86 12 48 10Z', V),
    E(48, 30, 18, 24, F) + E(29, 47, 17, 20, V) + E(68, 47, 18, 20, V),
    E(48, 33, 20, 29, V) + E(38, 28, 10, 20, F),
  ][f];
  const trunk = P('m41 86 3-39h9l6 39Z', W) + L('M48 68 29 47m20 14 20-18', D, 3);
  const detail = L('M30 35h14m9 12 16-8', F, 4);
  return trunk + crown + detail + L('M48 61v13', W, 5);
});

add('cup', 'ui.cup', (f) => {
  const bodies = [
    'M22 25h45v40q0 19-45 0Z',
    'M20 22h51L62 79H30Z',
    'M23 24h43l8 22-9 32H29l-9-32Z',
    'M22 29q3-22 24-17 25-5 24 17v40q-20 17-48 0Z',
    'M19 28h53l-4 25-8 25H31l-8-25Z',
  ];
  const handles = L('M68 33h11q19 22-12 28', W, 6);
  return (
    handles +
    P(bodies[f], T) +
    motif(31, 40, 27, 22, Q) +
    L('M23 26h44', W, 3) +
    L('M28 81h36', W, 3)
  );
});

add('house', 'ui.house', (f) => {
  const bodies = [
    R(20, 39, 57, 44, Q),
    R(22, 27, 53, 56, Q),
    P('M21 83 47 17 77 83Z', Q),
    R(12, 40, 49, 43, Q) + R(61, 54, 22, 29, Q),
    P('M20 43q-1-28 28-28 30 0 30 28v40H20Z', Q),
  ][f];
  const roofs = [
    P('m9 42 39-32 40 32Z', T),
    P('M13 28 26 11h45l13 17Z', T),
    L('M15 85 47 11 84 85', W, 6),
    P('m6 42 29-26 31 26Zm51 13 15-17 16 17Z', T),
    P('M10 44Q10 7 48 7q38 0 38 37H74q-2-25-26-25-23 0-26 25Z', T),
  ][f];
  const front = win(28, 48) + win(58, 48) + R(43, 63, 14, 20, W);
  const fittedFront =
    f === 2
      ? G(front, 'translate(15 16) scale(.69 .8)')
      : f === 3
        ? G(front, 'translate(-1 12) scale(.85)') + win(66, 62, 10, 12)
        : front;
  return bodies + roofs + fittedFront + R(65, 10, 8, 17, W);
});

add('boat', 'ui.boat', (f) => {
  const hull = [
    'M8 63h81L71 84H25Z',
    'M8 58q36 22 80 0L75 81H21Z',
    'M10 68 24 55h50l15 13-14 17H22Z',
    'M10 61h77L80 81H17Z',
    'M9 68 19 52l9 11h42l9-11 9 16-18 18H27Z',
  ][f];
  const top = L('M46 12v51', W, 3) + P('m41 16-27 39h27Zm11 7v33h29Z', B);
  return P(hull, W) + top + motif(28, 70, 38, 8, Q) + L('M11 90h75', B, 2);
});

add('butterfly', 'ui.butterfly', (f) => {
  const wing = [
    'M46 44C22 0 1 14 15 42L33 53Q3 58 18 81 38 91 46 59Z',
    'M46 44 23 9 7 22 15 43 30 49 12 66 25 82 46 60Z',
    'M46 44Q11 1 7 32 4 50 30 49 10 66 23 80 45 88 46 58Z',
    'M46 43 14 14 9 44 28 49 16 80 32 72 43 86 46 58Z',
    'M46 44Q25 8 18 14 0 25 18 50 4 74 33 81L46 59Z',
  ][f];
  const left = P(wing, A),
    marks = E(26, 32, 9, 13, H, -25) + C(28, 66, 6, Y);
  return (
    left +
    G(left, 'translate(96 0) scale(-1 1)') +
    marks +
    G(marks, 'translate(96 0) scale(-1 1)') +
    L('M48 33v39m-2-39-10-17m14 17 10-17', W, 4) +
    C(48, 33, 5, W)
  );
});

add('turtle', 'ui.turtle', (f) => {
  const shell = [
    E(45, 49, 28, 25, V),
    P('M18 45 30 24h31l14 22-11 27H30Z', V),
    E(46, 48, 24, 32, V),
    P('M17 55Q17 22 47 22 78 21 75 55L61 73H31Z', V),
    P('M17 46 26 31 46 24 66 31 75 48 64 70 43 75 25 66Z', V),
  ][f];
  const limbs = P('m28 28-14-5 3 18m10 24-13 12 16-1m31-47 16-5-4 18m-11 25 14 13-16-2Z', F);
  return (
    limbs +
    E(81, 48, 11, 9, F) +
    P('m19 47-13 6 14 2Z', F) +
    shell +
    motif(29, 34, 33, 30, F) +
    L('M25 47h43', D, 2) +
    eye(85, 46)
  );
});

add('snail', 'ui.snail', (f) => {
  const shell = [
    C(40, 45, 27, T),
    E(39, 43, 23, 31, T),
    P('M15 51V30L32 15l25 7 11 23-13 22H28Z', T),
    P('M12 49Q14 13 43 19 68 18 67 47L57 66H23Z', T),
    P('M15 48 21 24 47 14 64 28 65 53 48 68 27 63Z', T),
  ][f];
  const spirals = L(
    'M49 59Q19 67 20 41q2-22 25-17 22 5 14 23-8 16-23 6-13-11 1-19 14-5 13 7-2 8-9 3',
    Q,
    4,
  );
  const body = P('M9 70Q43 59 70 62V42h13v27q-1 15-23 15H15Z', V);
  return body + shell + spirals + L('m72 47-4-17m11 17 5-17', D, 3) + eye(67, 28) + eye(89, 28);
});

function petHead(kind, f) {
  const faces = [
    E(48, 44, 24, 24, T),
    P('M24 26h48v24L59 70H37L24 50Z', T),
    P('M19 39Q21 15 48 20 75 15 77 39L64 63H33Z', T),
    E(48, 43, 22, 29, T),
    P('M23 30 39 18h18l17 14-2 26-24 13-25-13Z', T),
  ][f];
  let ears = '';
  if (kind === 'cat')
    ears = [
      P('m24 34-3-23 21 13m13 0 20-13-3 25Z', W),
      P('m22 33 4-23 17 16m12 0 14-18 8 25Z', W),
      P('m22 30-5-18 25 12m13 0 25-12-5 22Z', W),
      P('m26 30-1-23 16 19m15 0 14-19 1 27Z', W),
      P('m24 31 7-24 12 19m12 0L66 7l8 28Z', W),
    ][f];
  if (kind === 'rabbit')
    ears = [
      E(35, 19, 8, 18, W, -15) + E(60, 19, 8, 18, W, 15),
      P('M28 35 19 9l10-5 14 28m10-1L62 5l10 5-5 25Z', W),
      E(29, 19, 9, 18, W, -35) + E(65, 20, 9, 17, W, 35),
      P('M27 31Q16 0 30 4q13 12 13 29m13-1Q59 1 70 6l-4 29Z', W),
      E(35, 18, 7, 17, W) + P('M54 31V11q1-11 11-5L78 20l-8 6-7-8v15Z', W),
    ][f];
  if (kind === 'dog')
    ears = [
      E(23, 34, 10, 22, W, 15) + E(73, 34, 10, 22, W, -15),
      P('m24 37-6-24 23 10m14 0 24-10-6 29Z', W),
      P('M27 22Q4 16 10 47l16 10 9-30m25-5q30-8 26 24L72 59 62 29Z', W),
      E(20, 35, 12, 16, W, -20) + E(76, 35, 12, 16, W, 20),
      P('m24 33-8-23 17 4 9 13m12 0 12-17 13 5-4 23Z', W),
    ][f];
  return ears + faces;
}
const petBody = E(48, 72, 19, 15, T) + E(31, 84, 12, 5, W) + E(65, 84, 12, 5, W);
function pet(kind, f) {
  const face = P('m29 39 16-7 2 18-15 8Z', Q);
  return (
    petBody +
    G(petHead(kind, f), 'translate(7 0) scale(.86)') +
    face +
    eye(36, 40) +
    eye(59, 40) +
    P('m43 49 5 5 5-5Z', W) +
    L('M48 54v5m0 0-7 3m7-3 7 3', W, 2) +
    (kind === 'cat' ? L('M29 50 16 47m13 9-13 3m51-9 13-3m-13 9 13 3', W, 2) : '')
  );
}
add('cat', 'ui.cat', (f) => pet('cat', f));
add('rabbit', 'ui.rabbit', (f) => pet('rabbit', f));
add('dog', 'ui.dog', (f) => pet('dog', f));

add('mushroom', 'ui.mushroom', (f) => {
  const stalk = P('M40 40h16l9 42q-17 8-32 0Z', Q);
  const cap = [
    P('M9 46Q12 9 48 9t39 37q-37 14-78 0Z', T),
    P('M12 47 32 16l16-8 17 8 19 31-17 7-19-6-18 6Z', T),
    P('M10 45q10-19 24-11L48 8l15 26q16-9 24 11L71 59 48 50 25 59Z', T),
    P('M10 43Q14 22 34 20L48 9l15 11q21 2 24 23L76 58H20Z', T),
    P('M14 45Q11 7 47 12 84 4 83 45l-15 16-20-8-20 8Z', T),
  ][f];
  const spots = C(30, 34, 7, Q) + C(55, 27, 6, Q) + C(68, 41, 5, Q);
  return stalk + cap + spots + L('M47 60v16', T, 3);
});

add('cactus', 'ui.cactus', (f) => {
  const plants = [
    R(36, 13, 25, 58, V, 12) + L('M39 47H22V30m37 25h17V36', V, 11),
    E(48, 47, 26, 29, V),
    E(48, 34, 18, 26, V) + E(29, 49, 13, 19, V, -30) + E(68, 51, 13, 18, V, 30),
    R(32, 22, 14, 49, V, 7) + R(49, 9, 15, 62, V, 7) + L('M35 43H19V31m40 23h19V40', V, 9),
    P('M31 71V24q0-14 12-11l9 18q11-24 17-10 7 21-10 27v23Z', V),
  ][f];
  const pot = P('M24 66h48l-8 22H32Z', T);
  return plants + L('M43 24v36m12-35v35', F, 3) + C(48, 16, 7, A) + pot + motif(33, 72, 30, 10, Q);
});

add('leaf', 'ui.leaf', (f) => {
  const blades = [
    'M48 10Q8 28 19 60q5 24 30 17Q86 60 48 10Z',
    'M48 8 59 24l15-5-1 20 14 10-19 11 3 20-24-9-21 10 1-21-16-12 18-10-2-20 14 7Z',
    'M47 8Q68 12 67 36l16-5-8 25-16 18H36L18 52l-5-20 19 4Q27 14 47 8Z',
    'M49 7Q19 44 21 70q25 27 50-2Q72 32 49 7Z',
    'M48 10 66 18l-3 10 17 6-8 12 13 8-17 11 1 11-22 3-20-7 2-12-16-8 10-10-4-16 17 2Z',
  ][f];
  const veins = L('M48 77V21m0 22-18-11m18 25L26 46m22 17 19-19m-19 4 13-17', D, 3);
  return P(blades, V) + veins + L('M48 76v13', W, 4);
});

add('teapot', 'ui.teapot', (f) => {
  const body = [
    E(47, 58, 27, 24, V),
    P('M26 36h42l6 36-11 12H30L20 70Z', V),
    P('M29 35h34L77 68q-29 32-59 0Z', V),
    P('M31 35h33l7 18-5 30H29l-6-29Z', V),
    P('M27 39q20-17 39 0l13 21-12 21H27L15 60Z', V),
  ][f];
  const handle = L('M65 43q30-18 21 16L69 73', D, 6);
  const spout = P('M26 47 7 35l8 28 13 6Z', V);
  return (
    handle + spout + body + P('M26 36h43L58 26H36Z', D) + C(47, 23, 5, D) + motif(33, 49, 27, 20, F)
  );
});

add('bottle', 'ui.bottle', (f) => {
  const bodies = [
    'M37 11h22v21L74 48v34H22V48l15-16Z',
    'M37 11h22v23q20 8 19 26l-4 25H22l-4-25q-1-18 19-26Z',
    'M36 10h24v24l8 8v43H28V42l8-8Z',
    'M37 11h22v19l19 13-10 42H28L18 43l19-13Z',
    'M37 11h22v17l10 12-6 14 13 23-11 9H31l-11-9 13-23-6-14 10-12Z',
  ][f];
  const closures = R(33, 7, 30, 11, W, 3);
  const label = R(30, 48, 36, 24, Q, 3);
  return P(bodies, B) + closures + label + motif(38, 55, 20, 12, N);
});

add('vase', 'ui.vase', (f) => {
  const bodies = [
    'M34 12h28l-7 29q30 39 8 46H33q-22-8 8-46Z',
    'M30 12h36l-9 18 15 44-9 13H32l-9-13 15-44Z',
    'M34 12h28v19l15 16-9 39H27l-9-39 16-16Z',
    'M29 13h38l-6 19 8 54H27l8-54Z',
    'M34 12h28l-5 27 18 15-1 23-12 11H33L20 77V54l20-15Z',
  ][f];
  const handles = '';
  return handles + P(bodies, T) + L('M32 14h32', W, 4) + motif(32, 51, 32, 25, Q) + '';
});

add('lamp', 'ui.lamp', (f) => {
  const shade = [
    P('M29 9h38l15 32H14Z', A),
    P('M15 41Q17 7 48 8q31 0 33 33Z', A),
    P('M22 12h52v30H22Z', A),
    P('M32 9h31l-4 13 22 20H15l22-20Z', A),
    P('m48 7 29 20-9 16H28l-9-16Z', A),
  ][f];
  const stand = L('M48 40v39', W, 5) + E(48, 83, 24, 6, W);
  const pattern = L('M39 12 31 37m25-25 9 25', H, 3);
  return stand + shade + pattern + L('M27 43v13', Y, 2) + C(27, 58, 3, Y);
});

add('chair', 'ui.chair', (f) => {
  const back = [
    R(24, 11, 46, 42, W, 5),
    P('M25 53V21q22-27 44 0v32Z', W),
    P('m24 53 6-41h34l7 41Z', W),
    P('M22 14h50L64 53H30Z', W),
    P('M26 52V14h13v27h17V14h13v38Z', W),
  ][f];
  const legs = L('M27 60v27m40-27v27', W, 6);
  const filling = R(33, 21, 29, 23, Q, 3);
  return legs + back + filling + R(20, 51, 56, 11, T, 4) + '';
});

add('table', 'ui.table', (f) => {
  const top = [
    E(48, 31, 37, 14, W),
    R(10, 18, 77, 26, W, 4),
    P('m48 10 39 20-16 17H26L9 30Z', W),
    P('M14 17h67l7 17-13 13H23L8 34Z', W),
    P('M15 19h66v12H65v15H30V31H15Z', W),
  ][f];
  const base = L('M22 40v45m50-45v45M35 44v29m24-29v29', W, 5);
  return base + top + L('M22 29h53', Q, 3) + '';
});

add('hat', 'ui.hat', (f) => {
  const body = [
    P('M26 59V23q22-9 44 0v36Z', W),
    P('M20 59Q16 17 48 18 80 17 76 59Z', W),
    P('M17 59 31 22h33l16 37Z', W),
    P('M23 58 34 14h29l8 44Z', W),
    P('M19 57Q19 35 29 31l3-15 16 12 16-12 6 17q8 8 9 24Z', W),
  ][f];
  const brim = E(48, 64, 39, 12, T);
  const trim = R(25, 46, 46, 9, Q);
  return body + brim + trim;
});

add('shoe', 'ui.shoe', (f) => {
  const upper = [
    P('M15 29h27l9 19 31 11q9 5 5 16H13Z', B),
    P('M17 13h28v36l29 9q15 2 14 18H14Z', B),
    P('M14 47q10 3 18-17l17 17 33 10q10 6 5 18H12Z', B),
    P('M14 35h22l10 19 37 7 5 14H11Z', B),
    P('M16 28h25l6 22 26-5 14 17v14H12Z', B),
  ][f];
  const sole = P('M10 73h78v10H13Z', N);
  const fastening = L('m39 45 17-5m-12 12 18-6m-12 13 19-6', I, 4);
  return upper + sole + fastening;
});

add('bag', 'ui.bag', (f) => {
  const bodies = [
    R(21, 30, 55, 55, T, 9),
    P('M25 31h45l13 51H14Z', T),
    P('M30 28h34l15 16v38H18V44Z', T),
    P('M18 38 29 27h39l11 11-8 45H26Z', T),
    P('M23 35q25-24 50 0v43q-25 17-50 0Z', T),
  ][f];
  const straps = L('M32 34V21q15-23 31 0v13', W, 5);
  const pockets = R(32, 55, 33, 22, Q, 4) + L('M34 61h28', W, 2);
  return straps + bodies + pockets;
});

add('key', 'ui.key', (f) => {
  const heads = [
    C(29, 28, 21, Y) + C(29, 28, 10, I),
    R(9, 8, 40, 40, Y, 8) + R(19, 18, 20, 20, I, 4),
    P('m29 5 24 23-24 23L5 28Z', Y) + P('m29 16 12 12-12 12-12-12Z', I),
    P('M11 18q1-18 18-9 17-10 20 8l-5 24-15 12-16-12Z', Y) + C(29, 25, 9, I),
    P('M13 10h32v14h9v17L29 51 4 41V24h9Z', Y) + R(20, 19, 18, 17, I, 3),
  ][f];
  const shaft = P('m40 39 45 39-8 9-12-11 6-7-8-7-6 7-13-11Z', Y);
  return shaft + heads + L('m47 48 25 23', W, 2);
});

add('clock', 'ui.clock', (f) => {
  const caseShape = [
    C(48, 46, 33, B),
    R(15, 12, 67, 67, B, 12),
    P('M48 7 81 26v39L48 84 15 65V26Z', B),
    P('M20 78V35Q19 7 48 9q29-2 28 26v43Z', B),
    P('M21 11h54l10 24-9 44H20L10 35Z', B),
  ][f];
  const extra = L('M31 75 24 87m41-12 7 12', N, 5);
  const hands = L('M48 26v20l14 11', N, 4);
  return (
    extra +
    caseShape +
    C(48, 46, 25, Q) +
    L('M48 24v4m22 18h-4M48 68v-4m-22-18h4', W, 2) +
    hands +
    C(48, 46, 4, N)
  );
});

add('camera', 'ui.camera', (f) => {
  const bodies = [
    R(11, 29, 76, 51, B, 8),
    P('M10 34 22 24h48l17 10v41l-11 9H19l-9-9Z', B),
    R(20, 18, 58, 68, B, 6),
    P('M8 32h60l19 12v32H8Z', B),
    P('M16 23h61l8 20-8 39H16L9 43Z', B),
  ][f];
  const top = P('m29 30 7-14h23l8 14Z', N);
  const lens = C(48, 54, 22, I) + C(48, 54, 16, N) + C(43, 49, 6, B);
  return bodies + top + lens + R(73, 37, 8, 6, Y, 1) + L('M17 43v24', N, 3);
});

add('book', 'ui.book', (f) => {
  const covers = [
    P('M11 20q18-8 37 5 19-13 37-5v58q-19-7-37 6-19-13-37-6Z', B),
    P('M20 11h56v76H20q-9-1-9-9V20q0-9 9-9Z', B),
    P('m14 20 58-11 13 11-58 12v55L14 74Z', B) + P('m27 32 58-12v56L27 87Z', B),
    P('M14 17h69v18H72v17h11v33H14Z', B),
    P('M11 21q13-12 37-1 22-13 37 0v56L48 86 11 76Z', B),
  ][f];
  const pages =
    f === 0 || f === 4
      ? P('M17 27q15-5 31 5 15-10 31-5v43q-17-3-31 9-15-12-31-9Z', Q) + L('M48 32v45', W, 2)
      : R(26, 22, 44, 52, Q, 2);
  const print = L('M32 36h31m-31 10h31m-31 10h22', W, 3);
  return covers + pages + print + '';
});

add('car', 'ui.car', (f) => {
  const bodies = [
    'M9 48 22 40 32 23h32l12 18 11 8v27H9Z',
    'M9 43h69l9 14v19H9Z',
    'M9 47 25 41 30 25h23l12 20 22 12v19H9Z',
    'M10 40h59l18 14v22H10Z',
    'M10 47 27 33h32l19 16 10 8v19H9Z',
  ][f];
  const roof = [
    'M20 47 32 23h30l15 24Z',
    'M13 45V20h60l10 25Z',
    'M23 47 29 25h24l15 22Z',
    'M15 45V24h53l14 21Z',
    'M21 48 30 30h29l17 18Z',
  ][f];
  const [x, y, w, h] = [
    [34, 29, 25, 12],
    [19, 26, 48, 16],
    [32, 30, 20, 14],
    [21, 30, 42, 14],
    [33, 35, 27, 10],
  ][f];
  const panes = R(x, y, w, h, I, 2) + L(`M${x + w / 2} ${y}v${h}`, N, 2);
  const cabins = P(roof, B) + panes;
  const trim = L('M15 62h65', I, 4);
  return (
    P(bodies, B) +
    cabins +
    trim +
    wheel(28, 76, 11) +
    wheel(69, 76, 11) +
    R(10, 51, 9, 7, Y, 2) +
    R(79, 56, 7, 7, A, 2)
  );
});

add('bicycle', 'ui.bicycle', (f) => {
  const frame = [
    L('M21 68 37 37 56 68H21m16-31h28l10 31H56l9-31', T, 4),
    L('M21 68 44 39 55 68H21m23-29 22-3 9 32H55', T, 4),
    L('M21 68 36 46h28l11 22m-39-22 19 22H21m34 0 9-22', T, 4),
    L('M21 68 36 34 54 49 66 34l9 34H21m33-19v19', T, 4),
    L('M21 68 32 40 52 35 57 68H21m31-33 13 4 10 29H57', T, 4),
  ][f];
  const equipment = L('M32 30h16m-9 0 4 13m24-6-4-14h14', N, 4);
  const tires = N;
  return (
    C(21, 68, 18, tires) +
    C(21, 68, 14, I) +
    C(75, 68, 18, tires) +
    C(75, 68, 14, I) +
    L('M21 53v30m-15-15h30m39-15v30m-15-15h30', B, 2) +
    frame +
    equipment +
    C(55, 68, 5, N) +
    L('m55 68 8 7h7', N, 3)
  );
});

add('airplane', 'ui.airplane', (f) => {
  const body = [
    P('M44 10q4-9 8 0l4 55-4 22h-8l-4-22Z', B),
    P('m48 5 10 25-3 39 5 16H36l5-16-3-39Z', B),
    P('M43 12Q48 0 53 12l8 49-8 23H43L35 61Z', B),
    P('M40 14 48 5l8 9v57l-8 17-8-17Z', B),
    P('m48 5 12 27-8 13 7 32-11 11-11-11 7-32-8-13Z', B),
  ][f];
  const wings = P('m43 32-34 25v10l35-13h8l35 13V57L53 32Z', B);
  const engines = R(25, 48, 8, 21, N, 4) + R(63, 48, 8, 21, N, 4);
  return (
    wings +
    body +
    engines +
    P('m44 70-19 11v6l23-8 23 8v-6L52 70Z', N) +
    P('m44 17 4-6 4 6v9h-8Z', I) +
    L('M48 32v32', I, 3)
  );
});

add('train', 'ui.train', (f) => {
  const cab = [
    P('M12 30 26 16h45l14 14v42H12Z', B),
    P('M10 33Q9 14 32 14h32q20 0 22 19v39H10Z', B),
    P('M12 22h48l25 30v20H12Z', B),
    P('M11 17h56v19l18 17v19H11Z', B),
    P('m10 27 13-14h45l18 14-8 45H18Z', B),
  ][f];
  const windows = win(24, 28, 18, 20) + win(53, 28, 18, 20);
  const base = R(10, 67, 76, 9, N, 2);
  const fittedWindows = f === 2 || f === 3 ? G(windows, 'translate(10 0) scale(.72 1)') : windows;
  return (
    cab +
    fittedWindows +
    base +
    wheel(27, 78, 10) +
    wheel(68, 78, 10) +
    motif(22, 53, 50, 9, Q) +
    L('M7 90h82', W, 3)
  );
});

add('kite', 'ui.kite', (f) => {
  const sail = [
    'm48 8 28 24-28 35-28-35Z',
    'M23 12h50l12 27-37 28-37-28Z',
    'm48 7 12 18 22 2-14 17 4 22-24-10-23 10 4-22-14-17 23-2Z',
    'm48 8 35 27-12 23H25L13 35Z',
    'M48 9Q19 7 12 30l16 10-11 20 31-10 31 10-11-20 16-10Q77 7 48 9Z',
  ][f];
  const panels = P('M48 9v50L21 33Z', Q) + L('M22 33h53M48 10v49', W, 2);
  const tails = L('M48 64q27 9 3 18l8 8', W, 2.5) + P('m58 75 8-5v9Zm-8 8-9-4 1 9Z', A);
  return tails + P(sail, B) + panels;
});

add('guitar', 'ui.guitar', (f) => {
  const body = [
    'M35 42q-15-9-19 7-3 10 8 17-17 22 12 26h24q29-4 12-26 11-7 8-17-4-16-19-7Z',
    'M31 42 16 49l9 17-12 20 22 6h26l22-6-12-20 9-17-15-7Z',
    'M34 43q-16-12-18 6l11 17q-19 21 10 26h22q25-6 11-25l10-16-14-12-8 12Z',
    'M32 42h32l12 17-6 30H27l-6-30Z',
    'M28 43 43 54h12l14-13 9 15-14 13 12 20H21l14-20-15-13Z',
  ][f];
  const head = P('M40 5h16v21H40Z', W);
  const details = C(48, 63, 10, N) + R(35, 79, 27, 5, W, 2);
  return (
    P(body, T) +
    R(43, 23, 10, 34, W) +
    head +
    details +
    L('M45 13v69m6-69v69', I, 1.6) +
    L('M36 10h6m12 0h7m-25 9h6m12 0h7', N, 3)
  );
});

add('drum', 'ui.drum', (f) => {
  const bodies = [
    'M17 29h62v45q-31 18-62 0Z',
    'M20 27h56l-7 55H28Z',
    'M15 29h66L68 48l9 29q-29 19-58 0l9-29Z',
    'M20 24h56v58H20Z',
    'M12 33h72l-9 34-27 20-27-20Z',
  ][f];
  const lacing = L('M23 34 35 74 48 34 61 74 73 34', Q, 3);
  return (
    P(bodies, T) +
    lacing +
    E(48, 28, 32, 10, W) +
    E(48, 26, 28, 7, Q) +
    L('M20 78q28 14 55 0', W, 4) +
    L('m16 7 39 19m27-19L43 26', W, 4)
  );
});

add('robot', 'ui.robot', (f) => {
  const body = [
    R(28, 39, 40, 34, B, 5),
    P('M27 40h42l-7 34H34Z', B),
    P('m48 36 25 14-9 25H32l-9-25Z', B),
    E(48, 55, 22, 22, B),
    P('M31 38h34v12h9v18H62v9H34v-9H22V50h9Z', B),
  ][f];
  const heads = R(28, 12, 40, 25, N, 4) + R(33, 18, 30, 12, I, 3);
  const arms = L('M28 46H16v19m52-19h12v19', W, 6) + C(16, 68, 6, N) + C(80, 68, 6, N);
  return (
    arms +
    body +
    heads +
    L('M39 73v12m18-12v12', W, 6) +
    R(28, 83, 20, 7, N, 2) +
    R(50, 83, 20, 7, N, 2) +
    motif(36, 46, 24, 18, Q) +
    L('M48 8V3', W, 3) +
    C(48, 3, 3, Y)
  );
});

add('castle', 'ui.castle', (f) => {
  const layout = [
    [
      [14, 28, 20],
      [34, 47, 28],
      [62, 28, 20],
    ],
    [
      [12, 43, 21],
      [35, 26, 26],
      [63, 43, 21],
    ],
    [
      [11, 35, 21],
      [34, 25, 27],
      [63, 35, 22],
    ],
    [
      [12, 26, 20],
      [33, 46, 28],
      [63, 40, 22],
    ],
    [
      [13, 40, 19],
      [34, 32, 28],
      [65, 24, 19],
    ],
  ][f];
  const towers = layout.map(([x, y, w]) => R(x, y, w, 86 - y, T)).join('');
  const cap = P('M-3 0 10-18 23 0Z', W);
  const roof = layout
    .map(([x, y, w]) => G(cap, `translate(${x} ${y}) scale(${w / 20} 1)`))
    .join('');
  const gate = P('M38 86V67q10-20 20 0v19Z', W);
  const windows = layout.map(([x, y, w]) => win(x + (w - 10) / 2, y + 12, 10, 12)).join('');
  return towers + roof + windows + gate + L('M14 79h17m34-19h18', Q, 3);
});

add('lantern', 'ui.lantern', (f) => {
  const body = [
    E(48, 45, 29, 31, A),
    R(23, 18, 50, 54, A, 9),
    P('M32 14h32l18 22v22L64 76H32L14 58V36Z', A),
    P('m48 12 31 20-5 35-26 12-26-12-5-35Z', A),
    P('M27 17h42l-9 21 12 32-24 10-24-10 12-32Z', A),
  ][f];
  const frame = L('M48 15v59M31 21q-9 26 0 48m34-48q9 26 0 48', Q, 3);
  const hang = L('M38 15V7h20v8', W, 3) + L('M48 77v14m-8-10 8 8 8-8', Y, 3);
  return (
    hang +
    body +
    (f === 4 ? G(frame, 'translate(19.2 4.5) scale(.6 .9)') : frame) +
    L('M32 17h32M32 75h32', W, 4)
  );
});

const PictureArt = {
  P,
  L,
  C,
  E,
  R,
  G,
  B,
  N,
  I,
  W,
  Y,
  Q,
  V,
  D,
  F,
  A,
  H,
  T,
  eye,
  wheel,
  win,
  motif,
  add,
  definitions,
};

export { PictureArt };
