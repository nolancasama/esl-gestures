import { POSE } from '../../config/timing.js';

export const LANDMARK_INDEX = Object.freeze({
  nose: 0,
  mouthLeft: 9,
  mouthRight: 10,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26
});

const POINT_NAMES = Object.freeze([
  'nose',
  'lShoulder',
  'rShoulder',
  'lElbow',
  'rElbow',
  'lWrist',
  'rWrist',
  'lHip',
  'rHip',
  'lKnee',
  'rKnee'
]);

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const finite = (value) => Number.isFinite(value);

function rawPoint(landmarks, index) {
  const point = landmarks?.[index];
  if (!point || !finite(point.x) || !finite(point.y)) {
    return { x: 0, y: 0, v: 0, valid: false };
  }

  return {
    x: point.x,
    y: point.y,
    v: clamp01(finite(point.v) ? point.v : 0),
    valid: true
  };
}

function mouthPoint(landmarks) {
  const left = rawPoint(landmarks, LANDMARK_INDEX.mouthLeft);
  const right = rawPoint(landmarks, LANDMARK_INDEX.mouthRight);
  if (!left.valid || !right.valid) {
    return { x: 0, y: 0, v: 0, valid: false };
  }

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    v: Math.min(left.v, right.v),
    valid: true
  };
}

function emptyPoints() {
  const points = {};
  for (const name of POINT_NAMES) points[name] = { x: 0, y: 0, v: 0 };
  points.mouth = { x: 0, y: 0, v: 0 };
  return points;
}

function normalizePoint(point, origin, scale, aspect) {
  if (!point.valid || !(scale > 0)) return { x: 0, y: 0, v: point.v };
  return {
    x: ((point.x - origin.x) * aspect) / scale,
    y: (point.y - origin.y) / scale,
    v: point.v
  };
}

function makeNormalizer() {
  let smoothedScale = null;
  let recentScalePeak = null;
  let lastT = null;
  let lastAspect = null;

  function reset() {
    smoothedScale = null;
    recentScalePeak = null;
    lastT = null;
    lastAspect = null;
  }

  function normalizePose(frame, aspect = 1) {
    const safeAspect = finite(aspect) && aspect > 0 ? aspect : 1;
    const t = finite(frame?.t) ? frame.t : 0;

    // A backwards timestamp denotes a new pose stream. Keeping the previous
    // camera's scale would distort the first few frames of that stream.
    if (lastT !== null && t < lastT) reset();
    if (lastAspect !== null && Math.abs(safeAspect - lastAspect) > 1e-9) reset();
    const elapsedMs = lastT === null ? 0 : Math.max(0, t - lastT);
    lastT = t;
    lastAspect = safeAspect;

    const landmarks = Array.isArray(frame?.landmarks) && frame.landmarks.length >= 33
      ? frame.landmarks
      : null;
    if (!landmarks) {
      return {
        t,
        ok: false,
        scale: smoothedScale ?? 0,
        origin: { x: 0, y: 0 },
        p: emptyPoints(),
        raw: frame
      };
    }

    const leftShoulder = rawPoint(landmarks, LANDMARK_INDEX.lShoulder);
    const rightShoulder = rawPoint(landmarks, LANDMARK_INDEX.rShoulder);
    const shouldersVisible = leftShoulder.valid && rightShoulder.valid
      && leftShoulder.v >= POSE.minVisibility
      && rightShoulder.v >= POSE.minVisibility;
    const origin = leftShoulder.valid && rightShoulder.valid
      ? {
          x: (leftShoulder.x + rightShoulder.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2
        }
      : { x: 0, y: 0 };
    const dx = (rightShoulder.x - leftShoulder.x) * safeAspect;
    const dy = rightShoulder.y - leftShoulder.y;
    const observedScale = leftShoulder.valid && rightShoulder.valid
      ? Math.hypot(dx, dy)
      : 0;
    const nose = rawPoint(landmarks, LANDMARK_INDEX.nose);
    const torsoScale = shouldersVisible && nose.valid && nose.v >= POSE.minVisibility
      ? Math.hypot((nose.x - origin.x) * safeAspect, nose.y - origin.y) * POSE.torsoScaleRatio
      : 0;
    const scaleObservation = Math.max(observedScale, torsoScale);
    const scaleIsUsable = shouldersVisible && scaleObservation >= POSE.minShoulderWidth;

    if (scaleIsUsable) {
      const decayedPeak = recentScalePeak === null
        ? scaleObservation
        : recentScalePeak * Math.pow(0.5, elapsedMs / POSE.scalePeakHalfLifeMs);
      recentScalePeak = Math.max(scaleObservation, decayedPeak);
      const flooredObservation = Math.max(scaleObservation, recentScalePeak * POSE.scaleFloorRatio);
      smoothedScale = smoothedScale === null
        ? flooredObservation
        : smoothedScale + POSE.scaleEmaAlpha * (flooredObservation - smoothedScale);
    }

    const scale = smoothedScale ?? 0;
    const points = {};
    for (const name of POINT_NAMES) {
      points[name] = normalizePoint(
        rawPoint(landmarks, LANDMARK_INDEX[name]),
        origin,
        scale,
        safeAspect
      );
    }
    points.mouth = normalizePoint(mouthPoint(landmarks), origin, scale, safeAspect);

    return {
      t,
      ok: scaleIsUsable && scale > 0,
      scale,
      origin,
      p: points,
      raw: frame
    };
  }

  return { normalizePose, reset };
}

const defaultNormalizer = makeNormalizer();

/** Create independent EMA state for a camera, simulation, or test stream. */
export function createPoseNormalizer() {
  return makeNormalizer();
}

/** Reset the EMA used by the module-level normalizePose function. */
export function resetPoseNormalization() {
  defaultNormalizer.reset();
}

/**
 * Convert a mirrored MediaPipe PoseFrame into shoulder-relative coordinates.
 * The module-level function retains scale EMA state between calls.
 */
export function normalizePose(frame, aspect = 1) {
  return defaultNormalizer.normalizePose(frame, aspect);
}
