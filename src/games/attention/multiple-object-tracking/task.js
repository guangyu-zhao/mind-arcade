import { CognitiveGame } from '../../../engines/progressive.js';
import { TrackingPhysics } from './physics.js';
export function mountGame() {
  const G = CognitiveGame;
  const physics = TrackingPhysics;
  const { width: WIDTH, height: HEIGHT, radius: RADIUS } = physics;
  const SPAWN_MARGIN = RADIUS + 12,
    INITIAL_SEPARATION = RADIUS * 2 + 40;
  const strings = {
    title: 'catalog.multiple-object-tracking',
    intro: 'game.keep-track-of-the-highlighted-balls-as-they-move',
    instructions: 'game.remember-the-purple-balls-they-turn-gray-and-move-with-the-others',
    progressionHelp: 'game.start-by-tracking-1-target-increasing-to-5-speed-and-motion-durat',
    markTargets: 'game.remember-the-targets',
    tracking: 'game.keep-tracking',
    chooseTargets: 'game.find-the-targets',
    found: 'game.recovered-value-value',
    targetFeedback: 'game.green-rings-show-the-original-targets',
    ball: 'game.ball-value',
  };
  function levelPlan(level) {
    const early = [
      [1, 6, 60, 4000],
      [1, 6, 80, 4000],
      [2, 8, 80, 4000],
      [2, 8, 100, 4000],
      [2, 8, 120, 4500],
      [3, 10, 120, 4500],
      [3, 10, 140, 4500],
      [3, 10, 160, 5000],
      [4, 12, 160, 5000],
      [4, 12, 180, 5000],
      [4, 12, 200, 5500],
      [5, 12, 200, 5500],
    ];
    const extra = Math.max(0, level - 24);
    const [targets, ballCount, speed, motionMs] =
      level <= 12
        ? early[level - 1]
        : level <= 24
          ? [5, 12, 200 + (level - 12) * 10, 5500 + Math.ceil((level - 12) / 3) * 500]
          : [
              5,
              12,
              Math.round((320 + 80 * Math.log2(1 + extra / 8)) * 1000) / 1000,
              7500 + extra * 500,
            ];
    return { level, condition: String(speed), targets, ballCount, speed, motionMs };
  }
  function initialBalls(speed, total) {
    const balls = [];
    for (let i = 0; i < total; i++) {
      let position = null;
      for (let attempt = 0; attempt < 1000; attempt++) {
        const p = {
          x: SPAWN_MARGIN + Math.random() * (WIDTH - SPAWN_MARGIN * 2),
          y: SPAWN_MARGIN + Math.random() * (HEIGHT - SPAWN_MARGIN * 2),
        };
        if (balls.every((b) => Math.hypot(b.x - p.x, b.y - p.y) > INITIAL_SEPARATION)) {
          position = p;
          break;
        }
      }
      if (!position) {
        // A bounded fallback keeps every initial target comfortably separated.
        return G.shuffle(
          Array.from({ length: total }, (_, j) => ({
            x: 100 + (j % 4) * 146,
            y: 90 + Math.floor(j / 4) * 150,
          })),
        ).map((p) => {
          const a = Math.random() * Math.PI * 2;
          return { ...p, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
        });
      }
      const a = Math.random() * Math.PI * 2;
      balls.push({ ...position, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    }
    return balls;
  }
  async function animateMotion(ctx, initial, groups, plan) {
    const balls = initial.map((b) => ({ ...b }));
    let previousMs = 0;
    const motionMs = await ctx.hold(plan.motionMs, {
      critical: true,
      frame: (elapsed) => {
        physics.advance(balls, (elapsed - previousMs) / 1000);
        previousMs = elapsed;
        groups.forEach((g, i) =>
          g.setAttribute('transform', `translate(${balls[i].x} ${balls[i].y})`),
        );
      },
    });
    return { motionMs, final: balls.map(({ x, y }) => ({ x, y })) };
  }
  function draw(ctx, positions, targets = [], selection = [], feedback = false) {
    const s = ctx.picture(),
      groups = [];
    positions.forEach((p, i) => {
      const g = ctx.svg('g', { transform: `translate(${p.x} ${p.y})` });
      if (feedback && targets.includes(i))
        g.append(
          ctx.svg('circle', { r: RADIUS + 7, fill: 'none', stroke: '#508064', 'stroke-width': 4 }),
        );
      g.append(
        ctx.svg('circle', {
          r: RADIUS,
          class: `ball${!feedback && targets.includes(i) ? ' target' : ''}${selection.includes(i) ? ' selected' : ''}`,
        }),
      );
      s.append(g);
      groups.push(g);
    });
    return { s, groups };
  }
  async function choose(ctx, positions, count) {
    const { s, groups } = draw(ctx, positions);
    const bounds = s.getBoundingClientRect(),
      displayScale = Math.max(0.01, Math.min(bounds.width / WIDTH, bounds.height / HEIGHT)),
      labelSize = Math.max(20, 14 / displayScale);
    s.setAttribute('aria-hidden', 'false');
    s.setAttribute('role', 'group');
    ctx.I.label(s, 'chooseTargets');
    const selected = new Set(),
      confirm = ctx.button('submit', null, true);
    confirm.disabled = true;
    ctx.toolbar.replaceChildren(confirm);
    ctx.hint('selected', { n: 0, total: count });
    const answer = await ctx.response((done) => {
      const cleanups = [];
      function toggle(i) {
        if (selected.has(i)) selected.delete(i);
        else if (selected.size < count) selected.add(i);
        groups.forEach((g, j) => {
          g.querySelector('.ball').classList.toggle('selected', selected.has(j));
          g.setAttribute('aria-pressed', String(selected.has(j)));
        });
        confirm.disabled = selected.size !== count;
        ctx.hint('selected', { n: selected.size, total: count });
      }
      groups.forEach((g, i) => {
        g.classList.add('ball-choice');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-pressed', 'false');
        ctx.I.label(g, 'ball', { n: i + 1 });
        // Identity numbers appear only after motion has stopped.
        const label = ctx.svg('text', { class: 'ball-label' });
        label.textContent = String(i + 1);
        label.style.fontSize = `${labelSize}px`;
        g.append(label);
        const click = () => toggle(i),
          key = (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (!e.repeat) toggle(i);
            }
          };
        g.addEventListener('click', click);
        g.addEventListener('keydown', key);
        cleanups.push(() => {
          g.removeEventListener('click', click);
          g.removeEventListener('keydown', key);
        });
      });
      const submit = () => {
        if (selected.size === count) done([...selected]);
      };
      confirm.addEventListener('click', submit);
      function key(e) {
        if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || e.isComposing) return;
        if (
          e.target instanceof Element &&
          (e.target.closest('input, textarea, select, [data-language-switch], #action, #help') ||
            (e.target instanceof HTMLElement && e.target.isContentEditable))
        )
          return;
        if (/^[1-9]$/.test(e.key) && Number(e.key) <= groups.length) {
          e.preventDefault();
          toggle(Number(e.key) - 1);
        }
      }
      document.addEventListener('keydown', key);
      return () => {
        cleanups.forEach((f) => f());
        confirm.removeEventListener('click', submit);
        document.removeEventListener('keydown', key);
      };
    });
    ctx.toolbar.replaceChildren();
    return answer;
  }
  function recovered(t) {
    return t.selected.filter((i) => t.targets.includes(i)).length;
  }
  async function run(ctx, plan) {
    const count = plan.targets,
      initial = initialBalls(plan.speed, plan.ballCount);
    const targets = ctx
      .shuffle(Array.from({ length: plan.ballCount }, (_, i) => i))
      .slice(0, count);
    ctx.phase('markTargets');
    ctx.hint('');
    draw(ctx, initial, targets);
    const cueMs = await ctx.hold(1500, { critical: true });
    ctx.phase('tracking');
    const { groups } = draw(ctx, initial);
    await ctx.hold(500, { critical: true });
    const { motionMs, final } = await animateMotion(ctx, initial, groups, plan);
    ctx.phase('chooseTargets');
    const answer = await choose(ctx, final, count);
    return {
      condition: plan.condition,
      physicsVersion: physics.version,
      initial,
      final,
      targets,
      selected: answer.value,
      rtMs: answer.rtMs,
      cueMs,
      motionMs,
    };
  }
  function validateTrial(t) {
    if (
      !t ||
      typeof t.condition !== 'string' ||
      !G.finite(Number(t.condition)) ||
      Number(t.condition) < 60 ||
      !Array.isArray(t.initial) ||
      !G.integer(t.initial.length, 6, 12) ||
      !Array.isArray(t.final) ||
      t.final.length !== t.initial.length ||
      !Array.isArray(t.targets) ||
      !G.integer(t.targets.length, 1, 5) ||
      new Set(t.targets).size !== t.targets.length ||
      !t.targets.every((v) => G.integer(v, 0, t.initial.length - 1)) ||
      !Array.isArray(t.selected) ||
      t.selected.length !== t.targets.length ||
      new Set(t.selected).size !== t.selected.length ||
      !t.selected.every((v) => G.integer(v, 0, t.initial.length - 1)) ||
      ![t.rtMs, t.cueMs, t.motionMs].every((v) => G.finite(v) && v >= 0) ||
      (t.physicsVersion !== undefined &&
        !['separated-discs-1', physics.version].includes(t.physicsVersion))
    )
      throw Error('trial');
    const position = (p) => {
      if (!p || !G.finite(p.x) || p.x < 0 || p.x > 640 || !G.finite(p.y) || p.y < 0 || p.y > 480)
        throw Error('position');
      return { x: p.x, y: p.y };
    };
    const initial = t.initial.map((p) => {
      if (!p || !G.finite(p.vx) || !G.finite(p.vy)) throw Error('velocity');
      return { ...position(p), vx: p.vx, vy: p.vy };
    });
    return {
      condition: t.condition,
      physicsVersion: t.physicsVersion ?? 'separated-discs-1',
      initial,
      final: t.final.map(position),
      targets: [...t.targets],
      selected: [...t.selected],
      rtMs: t.rtMs,
      cueMs: t.cueMs,
      motionMs: t.motionMs,
    };
  }
  G.init({
    slug: 'multiple-object-tracking',

    strings,

    preview:
      '<g fill="currentColor"><circle cx="30" cy="30" r="10"/><circle cx="111" cy="28" r="10" opacity=".3"/><circle cx="78" cy="64" r="10"/><circle cx="139" cy="81" r="10" opacity=".3"/><circle cx="27" cy="91" r="10" opacity=".3"/></g><path d="M14 22L4 15m77 36-6-14m26-15-13-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".4"/>',
    levelPlan,
    run,
    validateTrial,

    passes: (t) => recovered(t) === t.targets.length,
    validateContext: (t, p) => {
      if (
        t.condition !== p.condition ||
        t.targets.length !== p.targets ||
        t.initial.length !== p.ballCount ||
        Math.abs(t.motionMs - p.motionMs) > 125
      )
        throw Error('level parameters');
    },
    feedback(ctx, t) {
      ctx.phase('found', { n: recovered(t), total: t.targets.length });
      ctx.hint('targetFeedback');
      draw(ctx, t.final, t.targets, t.selected, true);
    },
  });
}
