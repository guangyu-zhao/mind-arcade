import { readMeta } from './records.js';
import { beginRecord, finishRecord, updateScoreContext } from './lifecycle.js';
export function createHistory({ version, rules, display, interrupt }) {
  let activeMeta = null,
    lastFrame = 0,
    raf = 0;
  function current() {
    const node = display(),
      rect = node.getBoundingClientRect();
    const slider =
      document.getElementById('display-scale') || document.getElementById('matrix-scale');
    return {
      schema: 1,
      rulesVersion: version,
      rules: { ...rules() },
      display: {
        width: rect.width,
        height: rect.height || 1,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        dpr: devicePixelRatio || 1,
        scale: slider ? Number(slider.value) : 100,
      },
      inputTypes: [],
    };
  }
  function cancel() {
    activeMeta = null;
    cancelAnimationFrame(raf);
  }
  function checkTiming(now = performance.now()) {
    if (!activeMeta) return false;
    if (document.hidden || now - lastFrame > 2000) {
      cancel();
      interrupt?.();
      return false;
    }
    return true;
  }
  function monitor(now) {
    if (!checkTiming(now)) return;
    lastFrame = now;
    raf = requestAnimationFrame(monitor);
  }
  function begin() {
    cancel();
    activeMeta = current();
    lastFrame = performance.now();
    beginRecord(activeMeta);
    raf = requestAnimationFrame(monitor);
    return activeMeta;
  }
  function finish(meta) {
    const clean = readMeta(meta);
    finishRecord(clean);
    cancel();
    return clean;
  }
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (
        activeMeta &&
        ['mouse', 'touch', 'pen'].includes(e.pointerType) &&
        !activeMeta.inputTypes.includes(e.pointerType)
      )
        activeMeta.inputTypes.push(e.pointerType);
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (activeMeta && !e.repeat && !activeMeta.inputTypes.includes('keyboard'))
        activeMeta.inputTypes.push('keyboard');
    },
    { capture: true },
  );
  function update() {
    updateScoreContext(current());
  }
  window.addEventListener('languagechange', update);
  window.addEventListener('game-language-change', update);
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (activeMeta && Math.abs(current().display.width - activeMeta.display.width) > 2) {
      cancel();
      interrupt?.();
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 160);
  });
  document.addEventListener('input', (e) => {
    if (['display-scale', 'matrix-scale'].includes(e.target.id) && !activeMeta) {
      update();
    }
  });
  return {
    begin,
    finish,
    cancel,
    checkTiming,
    updateContext: update,
  };
}
