import { drawCartoonFigure, drawDebugSkeleton, drawDemoFigure } from './figure.js';
import { drawContextScene, drawPropState } from './scenes.js';

const DPR_LIMIT = 2;
const CONTEXT_FADE_MS = 650;
const MAX_PARTICLES = 48;

function fitCover(sourceWidth, sourceHeight, width, height) {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) return { x: 0, y: 0, width, height };
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  return { x: (width - drawnWidth) / 2, y: (height - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}

function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(DPR_LIMIT, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 640));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 480));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

function drawVideo(ctx, video, viewport) {
  if (!video || video.readyState < 2 || !(video.videoWidth > 0)) return false;
  ctx.save();
  ctx.translate(viewport.x + viewport.width, viewport.y);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, viewport.width, viewport.height);
  ctx.restore();
  return true;
}

function drawParticles(ctx, particles, now) {
  ctx.save();
  for (const particle of particles) {
    const age = now - particle.born;
    const progress = age / particle.life;
    if (progress < 0 || progress > 1) continue;
    const x = particle.x + particle.vx * age;
    const y = particle.y + particle.vy * age + 0.00065 * age * age;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.translate(x, y);
    ctx.rotate(particle.spin * age);
    if (particle.kind === 'star') {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      for (let point = 0; point < 10; point += 1) {
        const radius = point % 2 ? particle.size * 0.42 : particle.size;
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size * 0.55, -particle.size * 0.25, particle.size * 1.1, particle.size * 0.5);
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Create the app's single-canvas renderer.
 *
 * render({ video, poseFrame, normPose, verb, stage, propState, now,
 *          debug, showDemo, demoRect, background })
 * Core prop state is consumed as-is; poseFrame coordinates must already be
 * mirrored, while the video element is mirrored here at draw time.
 */
export function createCanvasRenderer(canvas, options = {}) {
  if (!canvas?.getContext) throw new TypeError('createCanvasRenderer needs a canvas element');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  let destroyed = false;
  let currentVerb = null;
  let stageOneAt = null;
  let lastStage = 0;
  let particles = [];
  let successActive = false;
  let lastSize = { width: 1, height: 1, dpr: 1 };

  function celebrate({ stars = 2, x, y } = {}) {
    const now = performance.now();
    const centreX = Number.isFinite(x) ? x : lastSize.width / 2;
    const centreY = Number.isFinite(y) ? y : lastSize.height * 0.45;
    const count = Math.min(MAX_PARTICLES, 18 + Math.max(1, stars) * 6);
    const colors = ['#ffd447', '#ff6b6b', '#53d8fb', '#8be06c', '#b78cff'];
    particles = Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI * (0.08 + seeded(index, stars) * 0.84);
      const speed = 0.12 + seeded(index, 2) * 0.25;
      return {
        kind: index < stars * 3 ? 'star' : 'confetti',
        x: centreX,
        y: centreY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.05,
        spin: (seeded(index, 3) - 0.5) * 0.018,
        size: 6 + seeded(index, 4) * 9,
        color: colors[index % colors.length],
        born: now,
        life: 1150 + seeded(index, 5) * 500
      };
    });
  }

  function render(input = {}) {
    if (destroyed) return;
    const now = Number.isFinite(input.now) ? input.now : performance.now();
    const size = resizeCanvas(canvas, ctx);
    lastSize = size;
    const { width, height } = size;
    const video = input.videoVisible === false ? null : input.video;
    const sourceWidth = video?.videoWidth || input.sourceWidth || 640;
    const sourceHeight = video?.videoHeight || input.sourceHeight || 480;
    const sourceAspect = sourceWidth / sourceHeight;
    const normalizationAspect = input.normalizationAspect ?? sourceAspect;
    const viewport = fitCover(sourceWidth, sourceHeight, width, height);
    const mapRaw = (point) => ({
      x: viewport.x + point.x * viewport.width,
      y: viewport.y + point.y * viewport.height
    });
    const normPose = input.normPose;
    const poseFrame = input.poseFrame ?? input.frame;
    const mapNorm = normPose ? (point) => mapRaw({
      x: normPose.origin.x + point.x * normPose.scale / normalizationAspect,
      y: normPose.origin.y + point.y * normPose.scale
    }) : null;

    if (input.verb !== currentVerb) {
      currentVerb = input.verb ?? null;
      stageOneAt = (input.stage ?? 0) >= 1 ? now : null;
      lastStage = input.stage ?? 0;
      successActive = false;
    }
    const stage = input.stage ?? 0;
    if (stage >= 1 && lastStage < 1) stageOneAt = now;
    if (stage < 1) stageOneAt = null;
    lastStage = stage;
    const contextAlpha = Number.isFinite(input.contextAlpha)
      ? input.contextAlpha
      : stage >= 1 ? Math.min(1, (now - (stageOneAt ?? now)) / CONTEXT_FADE_MS) : 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = input.background ?? options.background ?? '#172033';
    ctx.fillRect(0, 0, width, height);
    const hasVideo = drawVideo(ctx, video, viewport);
    if (!hasVideo && input.drawIdleBackground !== false) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(72, 103, 143, .18)');
      gradient.addColorStop(1, 'rgba(20, 31, 52, .35)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    // Webcam scenes are translucent AR scenery. Without video they can use the
    // full color treatment as the backdrop for a synthetic/no-camera figure.
    drawContextScene(
      ctx,
      currentVerb,
      { x: 0, y: 0, width, height },
      contextAlpha * (hasVideo ? 0.46 : 1),
      now
    );

    if (input.simulatedPlayer) {
      drawCartoonFigure(ctx, poseFrame, viewport, {
        mapPoint: mapRaw,
        lineWidth: Math.max(5, Math.min(width, height) * 0.018),
        color: '#eef4ff',
        skin: '#ffd6b0',
        joints: '#ff739d'
      });
    }

    // Prop verbs use their prop as context: visibility follows hint alpha.
    const propAlpha = stage >= 1 ? contextAlpha : input.propBeforeHint ? 1 : 0;
    if (propAlpha > 0 && mapNorm) {
      const props = input.propState ?? input.props?.state ?? input.props?.[currentVerb] ?? input.props;
      ctx.save();
      ctx.globalAlpha = propAlpha;
      drawPropState(ctx, currentVerb, props, mapNorm, {
        size: Math.max(28, Math.min(width, height) * 0.075)
      });
      ctx.restore();
    }

    if (input.debug || input.showSkeleton) {
      drawDebugSkeleton(ctx, poseFrame, mapRaw, {
        showVisibility: Boolean(input.debug),
        lineWidth: Math.max(2, Math.min(width, height) * 0.005),
        fontSize: Math.max(9, Math.min(width, height) * 0.018)
      });
    }

    if (input.showDemo && currentVerb) {
      const demoRect = input.demoRect || {
        x: width * 0.7,
        y: height * 0.5,
        width: width * 0.27,
        height: height * 0.45
      };
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.roundRect(demoRect.x, demoRect.y, demoRect.width, demoRect.height, Math.min(20, demoRect.width * 0.08));
      ctx.fill();
      drawDemoFigure(ctx, {
        verb: currentVerb,
        t: input.demoTime ?? input.itemElapsed ?? now,
        rect: demoRect,
        showProp: true
      });
      ctx.restore();
    }

    if (input.success && !successActive) {
      successActive = true;
      const stars = typeof input.success === 'object' ? input.success.stars : undefined;
      celebrate({ stars });
    } else if (!input.success) {
      successActive = false;
    }

    particles = particles.filter((particle) => now - particle.born <= particle.life);
    drawParticles(ctx, particles, now);
    return { width, height, viewport, contextAlpha };
  }

  function clear() {
    particles = [];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function destroy() {
    clear();
    destroyed = true;
  }

  return { render, celebrate, clear, destroy, get size() { return { ...lastSize }; } };
}

export { fitCover };
