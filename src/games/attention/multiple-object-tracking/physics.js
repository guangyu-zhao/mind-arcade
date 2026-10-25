const WIDTH = 640,
  HEIGHT = 480,
  RADIUS = 24;
const DIAMETER = RADIUS * 2;
const TIME_EPSILON = 1e-10;
const MAX_IMPACTS = 2048;

function nextImpact(balls, remaining) {
  let first = null,
    earliest = remaining;
  function consider(time, impact) {
    if (time < -TIME_EPSILON || time > earliest) return;
    earliest = Math.max(0, time);
    first = { ...impact, time: earliest };
  }

  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.vx < 0) consider((RADIUS - a.x) / a.vx, { a: i, axis: 'x', edge: RADIUS });
    else if (a.vx > 0)
      consider((WIDTH - RADIUS - a.x) / a.vx, { a: i, axis: 'x', edge: WIDTH - RADIUS });
    if (a.vy < 0) consider((RADIUS - a.y) / a.vy, { a: i, axis: 'y', edge: RADIUS });
    else if (a.vy > 0)
      consider((HEIGHT - RADIUS - a.y) / a.vy, { a: i, axis: 'y', edge: HEIGHT - RADIUS });

    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const vx = b.vx - a.vx,
        vy = b.vy - a.vy;
      const approach = dx * vx + dy * vy;
      if (approach >= 0) continue;
      const speedSquared = vx * vx + vy * vy;
      const separation = dx * dx + dy * dy - DIAMETER * DIAMETER;
      const discriminant = approach * approach - speedSquared * separation;
      if (discriminant <= 0) continue;
      // Stable form of the first root of |position + velocity * t|² = diameter².
      const time = separation <= 0 ? 0 : separation / (-approach + Math.sqrt(discriminant));
      consider(time, { a: i, b: j });
    }
  }
  return first;
}

function resolve(balls, impact) {
  const a = balls[impact.a];
  if (impact.axis) {
    a[impact.axis] = impact.edge;
    a[`v${impact.axis}`] *= -1;
    return;
  }

  const b = balls[impact.b];
  const dx = b.x - a.x,
    dy = b.y - a.y,
    distance = Math.hypot(dx, dy);
  const nx = dx / distance,
    ny = dy / distance;
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing <= 0) return;
  // Equal masses: exchange normal velocity, retaining tangential velocity.
  a.vx -= closing * nx;
  a.vy -= closing * ny;
  b.vx += closing * nx;
  b.vy += closing * ny;
}

function advance(balls, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid motion interval');
  let remaining = seconds,
    impacts = 0;
  while (remaining > TIME_EPSILON) {
    const impact = nextImpact(balls, remaining);
    const travel = impact ? impact.time : remaining;
    for (const ball of balls) {
      ball.x += ball.vx * travel;
      ball.y += ball.vy * travel;
    }
    if (!impact) return;
    remaining = Math.max(0, remaining - travel);
    resolve(balls, impact);
    if (++impacts > MAX_IMPACTS) throw new Error('Collision solver did not converge');
  }
}

const TrackingPhysics = Object.freeze({
  width: WIDTH,
  height: HEIGHT,
  radius: RADIUS,
  version: 'elastic-discs-1',
  advance,
});
export { TrackingPhysics };
