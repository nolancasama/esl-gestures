import { expandSkeleton, LANDMARK } from './skeleton.js';
import { motionAt } from './motions.js';

const TAU = Math.PI * 2;

const DEFAULTS = Object.freeze({
  durationMs: 6000,
  fps: 30,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  mirror: false,
  speed: 1,
  noise: 0,
  realisticJitter: false,
  wristSpikeRate: 0,
  dropout: 0,
  seed: 1
});

function hash(seed, frame, landmark, channel) {
  let value = (seed | 0) ^ Math.imul(frame + 1, 0x45d9f3b) ^ Math.imul(landmark + 7, 0x27d4eb2d) ^ Math.imul(channel + 11, 0x165667b1);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

const numericOption = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function resolvedOptions(opts = {}) {
  const values = { ...DEFAULTS, ...opts };
  values.durationMs = Math.max(0, numericOption(values.durationMs, DEFAULTS.durationMs));
  values.fps = Math.max(1, numericOption(values.fps, DEFAULTS.fps));
  values.scale = Math.max(0.05, numericOption(values.scale, DEFAULTS.scale));
  values.speed = Math.max(0.05, numericOption(values.speed, DEFAULTS.speed));
  values.offsetX = numericOption(values.offsetX, 0);
  values.offsetY = numericOption(values.offsetY, 0);
  values.noise = values.noise === true ? 0.012 : Math.max(0, numericOption(values.noise, 0));
  values.realisticJitter = values.realisticJitter === true;
  values.wristSpikeRate = Math.max(0, Math.min(1, numericOption(values.wristSpikeRate, 0)));
  values.dropout = values.dropout === true ? 0.08 : Math.max(0, Math.min(1, numericOption(values.dropout, 0)));
  values.seed = numericOption(values.seed, 1) | 0;
  return values;
}

/**
 * Generate one detector-shaped PoseFrame. `tMs` is the emitted timestamp;
 * speed affects the performed motion without distorting the frame timestamps.
 */
export function poseAt(verb, tMs, opts = {}) {
  const options = resolvedOptions(opts);
  const frameNumber = Math.round(Math.max(0, tMs) * options.fps / 1000);
  const skeleton = motionAt(verb, Math.max(0, tMs) * options.speed, options);
  const canonical = expandSkeleton(skeleton);
  // A default shoulder width of 0.18 leaves the full upper body in frame while
  // providing useful size variation around the requested scale.
  const shoulderWidth = 0.18 * options.scale;
  const centreX = 0.5 + options.offsetX;
  const centreY = 0.31 + options.offsetY;
  const spikeWrist = hash(options.seed, frameNumber, 97, 0) < options.wristSpikeRate
    ? (hash(options.seed, frameNumber, 97, 1) < 0.5 ? LANDMARK.leftWrist : LANDMARK.rightWrist)
    : -1;
  const spikeAngle = TAU * hash(options.seed, frameNumber, 97, 2);
  const landmarks = canonical.map((point, index) => {
    const sigma = options.realisticJitter
      ? ([LANDMARK.leftWrist, LANDMARK.rightWrist, LANDMARK.leftElbow, LANDMARK.rightElbow].includes(index) ? 0.04
        : ([LANDMARK.leftShoulder, LANDMARK.rightShoulder, LANDMARK.nose].includes(index) ? 0.02 : 0))
      : 0;
    const gaussianRadius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, hash(options.seed, frameNumber, index, 4))));
    const gaussianAngle = TAU * hash(options.seed, frameNumber, index, 5);
    const realisticX = gaussianRadius * Math.cos(gaussianAngle) * sigma * shoulderWidth;
    const realisticY = gaussianRadius * Math.sin(gaussianAngle) * sigma * shoulderWidth;
    const spikeX = index === spikeWrist ? Math.cos(spikeAngle) * 0.3 * shoulderWidth : 0;
    const spikeY = index === spikeWrist ? Math.sin(spikeAngle) * 0.3 * shoulderWidth : 0;
    const jitterX = (hash(options.seed, frameNumber, index, 0) * 2 - 1) * options.noise + realisticX + spikeX;
    const jitterY = (hash(options.seed, frameNumber, index, 1) * 2 - 1) * options.noise + realisticY + spikeY;
    const jitterZ = (hash(options.seed, frameNumber, index, 2) * 2 - 1) * options.noise;
    const projectedX = centreX + point.x * shoulderWidth;
    const x = (options.mirror ? 1 - projectedX : projectedX) + jitterX;
    const dropped = hash(options.seed, frameNumber, index, 3) < options.dropout;
    return {
      x,
      y: centreY + point.y * shoulderWidth + jitterY,
      z: point.z * shoulderWidth + jitterZ,
      v: dropped ? 0 : point.v
    };
  });
  return { t: Math.max(0, tMs), landmarks };
}

export function generateFrames(verb, opts = {}) {
  const options = resolvedOptions(opts);
  const intervalMs = 1000 / options.fps;
  const frameCount = Math.floor(options.durationMs / intervalMs) + 1;
  return Array.from({ length: frameCount }, (_, index) => {
    const t = Math.min(options.durationMs, index * intervalMs);
    return poseAt(verb, t, options);
  });
}

/** Generate a stream that idles first, then performs the requested motion. */
export function sequence(verb, idleOrOpts = {}, maybeOpts = {}) {
  const supplied = typeof idleOrOpts === 'number'
    ? { ...maybeOpts, idleMs: idleOrOpts }
    : { ...idleOrOpts };
  const idleMs = Math.max(0, numericOption(supplied.idleMs, 3000));
  const options = resolvedOptions(supplied);
  const intervalMs = 1000 / options.fps;
  const frameCount = Math.floor((idleMs + options.durationMs) / intervalMs) + 1;
  return Array.from({ length: frameCount }, (_, index) => {
    const t = Math.min(idleMs + options.durationMs, index * intervalMs);
    if (t < idleMs) return poseAt('idle', t, options);
    const frame = poseAt(verb, t - idleMs, options);
    frame.t = t;
    return frame;
  });
}

export { MOTIONS, motionAt } from './motions.js';
export { LANDMARK, neutralSkeleton, expandSkeleton } from './skeleton.js';
