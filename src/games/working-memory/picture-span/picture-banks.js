import './picture-objects.js';
import { GameI18n } from '../../../i18n/runtime.js';
import { PictureArt } from './picture-variants.js';
const { P, L, C, E, R, G, B, N, I, W, Y, Q, T, definitions } = PictureArt;
// The airplane family deliberately uses five different aircraft/views.
const airplane = definitions.find((def) => def.category === 'airplane');
const topPlane = airplane.render;
airplane.normal = (f) => {
  if (f === 0) return G(topPlane(0), 'rotate(-26 48 48) translate(6 6) scale(.87)');
  if (f === 1)
    return (
      P('M7 49h14l7-28 13 4-1 24h32l19 9-12 9H24L7 58Z', B) +
      P('m43 53 17-24 12 3-12 29-28 17-8-3Z', N) +
      R(29, 51, 44, 7, I, 3) +
      L('M37 51v7m9-7v7m9-7v7m9-7v7', N, 2)
    );
  if (f === 2)
    return (
      P('M7 26h82v12H7Zm4 29h74v11H11Z', Y) +
      L('M18 38v18m61-18v18M31 38v18m34-18v18', W, 3) +
      E(48, 48, 15, 26, T) +
      C(48, 47, 11, N) +
      L('M48 29v36M30 47h36', N, 4) +
      C(48, 47, 5, I) +
      L('M39 72v12m18-12v12', N, 3) +
      C(37, 85, 6, N) +
      C(59, 85, 6, N)
    );
  if (f === 3)
    return (
      P('M6 37 91 9 66 85 47 58 23 76 27 49Z', I) +
      P('M6 37 91 9 27 49Z', B) +
      P('m27 49 64-40-44 49-24 18Z', N) +
      P('m47 58 44-49-25 76Z', Q) +
      L('M8 71 2 78m12-1-6 8', B, 2)
    );
  return (
    P('M10 43h51l19 10-12 9H26Z', T) +
    P('m28 43-8-22 11-4 11 26m-1 7 27-27 11 4-21 29Z', B) +
    L('M19 29h55m-7 20h22m-11-8v16', N, 3) +
    L('M37 62v13m23-13v13', N, 3) +
    P('M21 73h56l-6 10H19Z', B) +
    R(35, 43, 21, 8, I, 3) +
    L('M5 90q11-6 22 0t22 0 22 0 22 0', B, 2)
  );
};

// Additional silhouettes for familiar objects, beyond surface decorations.
const umbrella = definitions.find((def) => def.category === 'umbrella');
umbrella.normal = (f) => {
  if (f === 1)
    return (
      P('m36 11 25 57-16 10-7-48Z', B) + L('M42 15 61 78q7 15 18 2', W, 4) + L('M44 40 57 66', I, 3)
    );
  if (f === 2)
    return (
      P('M5 43 48 9l43 34Z', T) +
      P('m48 9-14 34h29Z', Q) +
      L('M48 9v76', W, 4) +
      E(49, 87, 35, 5, Y) +
      P('m67 69 10-13 13 20H61Z', B)
    );
  return umbrella.render(f);
};

function drawing(def, form) {
  const art = (def.normal || def.render)(form);
  return `<g stroke-linecap="round" stroke-linejoin="round">${G(art, 'translate(4 4) scale(.92)')}</g>`;
}
export function createPictureBank() {
  const normal = [];
  for (const def of definitions) {
    const normalArt = new Set();
    for (let form = 0; form < 5; form++) {
      const label = GameI18n.message('ui.value-value-2', def.label, form + 1);
      const design = Object.freeze({
        id: `normal-${def.category}-${form + 1}`,
        category: def.category,
        form,
        label,
        drawing: drawing(def, form),
      });
      if (!normalArt.has(design.drawing)) {
        normal.push(design);
        normalArt.add(design.drawing);
      }
    }
  }
  return Object.freeze(normal);
}
