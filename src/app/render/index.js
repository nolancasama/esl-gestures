export { createCanvasRenderer, fitCover } from './renderer.js';
export { drawCartoonFigure, drawDebugSkeleton, drawDemoFigure } from './figure.js';
export { drawContextScene, drawPropState } from './scenes.js';

import { createCanvasRenderer } from './renderer.js';
import { drawDemoFigure } from './figure.js';

const renderers = new WeakMap();

function rendererFor(canvas) {
  let renderer = renderers.get(canvas);
  if (!renderer) {
    renderer = createCanvasRenderer(canvas);
    renderers.set(canvas, renderer);
  }
  return renderer;
}

/** Convenience entry point for callers that do not need to retain a renderer. */
export function render(canvas, input) {
  return rendererFor(canvas).render(input);
}

/** Mirrored setup preview with a simple skeleton (visibility labels in debug). */
export function renderSetup(canvas, input = {}) {
  return rendererFor(canvas).render({
    ...input,
    frame: input.frame ?? input.poseFrame,
    stage: 0,
    showSkeleton: true
  });
}

/** Paint one no-camera card or hint figure using the core poseAt() motion. */
export function renderDemo(canvas, verb, t = 0, options = {}) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || options.width || 320));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || options.height || 240));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (options.background !== false) {
    ctx.fillStyle = options.background || '#f8fbff';
    ctx.fillRect(0, 0, width, height);
  }
  return drawDemoFigure(ctx, {
    verb,
    t,
    rect: options.rect || { x: 0, y: 0, width, height },
    showProp: options.showProp !== false,
    options
  });
}

export function celebrate(canvas, options) {
  rendererFor(canvas).celebrate(options);
}

export function releaseRenderer(canvas) {
  const renderer = renderers.get(canvas);
  renderer?.destroy();
  renderers.delete(canvas);
}
