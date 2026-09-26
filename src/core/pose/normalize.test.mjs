import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPoseNormalizer,
  LANDMARK_INDEX,
  normalizePose,
  resetPoseNormalization
} from './normalize.js';
import { POSE } from '../../config/timing.js';

function frame(t = 0) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }));
  landmarks[LANDMARK_INDEX.lShoulder] = { x: 0.35, y: 0.4, z: 0, v: 0.9 };
  landmarks[LANDMARK_INDEX.rShoulder] = { x: 0.65, y: 0.4, z: 0, v: 0.8 };
  landmarks[LANDMARK_INDEX.nose] = { x: 0.5, y: 0.2, z: 0, v: 0.7 };
  landmarks[LANDMARK_INDEX.lWrist] = { x: 0.2, y: 0.4, z: 0, v: 0.6 };
  landmarks[LANDMARK_INDEX.mouthLeft] = { x: 0.47, y: 0.27, z: 0, v: 0.75 };
  landmarks[LANDMARK_INDEX.mouthRight] = { x: 0.53, y: 0.29, z: 0, v: 0.65 };
  return { t, landmarks };
}

function calibratedFrame(t, distanceScale = 1, shoulderCompression = 1) {
  const result = frame(t);
  const shoulderWidth = 0.18 * distanceScale;
  result.landmarks[LANDMARK_INDEX.lShoulder].x = 0.5 - shoulderWidth * shoulderCompression / 2;
  result.landmarks[LANDMARK_INDEX.rShoulder].x = 0.5 + shoulderWidth * shoulderCompression / 2;
  result.landmarks[LANDMARK_INDEX.lShoulder].y = 0.4;
  result.landmarks[LANDMARK_INDEX.rShoulder].y = 0.4;
  result.landmarks[LANDMARK_INDEX.nose].x = 0.5;
  result.landmarks[LANDMARK_INDEX.nose].y = 0.4 - shoulderWidth / POSE.torsoScaleRatio;
  return result;
}

test('normalizePose maps all named landmarks into isotropic shoulder units', () => {
  resetPoseNormalization();
  const normalized = normalizePose(frame(10), 2);

  assert.equal(normalized.ok, true);
  assert.equal(normalized.t, 10);
  assert.deepEqual(normalized.origin, { x: 0.5, y: 0.4 });
  assert.ok(Math.abs(normalized.scale - 0.6) < 1e-12);
  assert.ok(Math.abs(normalized.p.lShoulder.x + 0.5) < 1e-12);
  assert.ok(Math.abs(normalized.p.rShoulder.x - 0.5) < 1e-12);
  assert.ok(Math.abs(normalized.p.nose.y + (1 / 3)) < 1e-12);
  assert.ok(Math.abs(normalized.p.mouth.x) < 1e-12);
  assert.ok(Math.abs(normalized.p.mouth.y - (0.28 - 0.4) / 0.6) < 1e-12);
  assert.equal(normalized.p.mouth.v, 0.65);
  assert.equal(normalized.raw.landmarks.length, 33);
});

test('normalizers smooth valid scale and do not learn from invisible shoulders', () => {
  const normalizer = createPoseNormalizer();
  const first = normalizer.normalizePose(frame(0), 1);
  const wider = frame(20);
  wider.landmarks[LANDMARK_INDEX.lShoulder].x = 0.2;
  wider.landmarks[LANDMARK_INDEX.rShoulder].x = 0.8;
  const second = normalizer.normalizePose(wider, 1);

  assert.ok(Math.abs(first.scale - 0.3) < 1e-12);
  assert.ok(second.scale > first.scale && second.scale < 0.6);

  const invisible = frame(40);
  invisible.landmarks[LANDMARK_INDEX.lShoulder].v = 0;
  invisible.landmarks[LANDMARK_INDEX.rShoulder].v = 0;
  invisible.landmarks[LANDMARK_INDEX.lShoulder].x = 0;
  invisible.landmarks[LANDMARK_INDEX.rShoulder].x = 1;
  const third = normalizer.normalizePose(invisible, 1);
  assert.equal(third.ok, false);
  assert.equal(third.scale, second.scale);
});

test('side-view shoulder collapse does not pull scale below its floor', () => {
  const normalizer = createPoseNormalizer();
  const initial = normalizer.normalizePose(calibratedFrame(0), 1).scale;
  let minimum = initial;
  for (let t = 50; t <= 1500; t += 50) {
    const compression = 1 - 0.85 * (t / 1500);
    minimum = Math.min(minimum, normalizer.normalizePose(calibratedFrame(t, 1, compression), 1).scale);
  }
  assert.ok(minimum >= initial * POSE.scaleFloorRatio);
});

test('a genuine camera-distance change is adopted within two seconds', () => {
  const normalizer = createPoseNormalizer();
  const initial = normalizer.normalizePose(calibratedFrame(0), 1).scale;
  let normalized;
  for (let t = 50; t <= 2000; t += 50) {
    const distanceScale = 1 - 0.4 * Math.min(1, t / 1500);
    normalized = normalizer.normalizePose(calibratedFrame(t, distanceScale), 1);
  }
  assert.ok(normalized.scale < initial * 0.7);
  assert.ok(Math.abs(normalized.scale - initial * 0.6) < initial * 0.06);
});

test('null and incomplete frames produce a stable invalid NormPose shape', () => {
  const normalizer = createPoseNormalizer();
  const normalized = normalizer.normalizePose({ t: 50, landmarks: null }, 4 / 3);

  assert.equal(normalized.ok, false);
  assert.equal(normalized.scale, 0);
  assert.deepEqual(Object.keys(normalized.p), [
    'nose', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'rWrist',
    'lHip', 'rHip', 'lKnee', 'rKnee', 'mouth'
  ]);
  assert.deepEqual(normalized.p.lWrist, { x: 0, y: 0, v: 0 });
});
