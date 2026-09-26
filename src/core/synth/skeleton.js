// MediaPipe Pose landmark indices. Keeping this mapping here makes the
// synthetic poses useful anywhere a real PoseFrame is accepted.
export const LANDMARK = Object.freeze({
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32
});

const point = (x, y, z = 0) => ({ x, y, z });

// Coordinates are in shoulder widths, with the shoulder midpoint at (0, 0).
// They deliberately include a complete body even though recognition is upper-
// body-first, so generated frames remain plausible MediaPipe input.
export function neutralSkeleton() {
  return {
    root: point(0, 0),
    nose: point(0, -1.15, -0.08),
    lShoulder: point(-0.5, 0),
    rShoulder: point(0.5, 0),
    lElbow: point(-0.72, 0.68),
    rElbow: point(0.72, 0.68),
    lWrist: point(-0.78, 1.34, -0.03),
    rWrist: point(0.78, 1.34, -0.03),
    lHip: point(-0.34, 1.65),
    rHip: point(0.34, 1.65),
    lKnee: point(-0.38, 2.9),
    rKnee: point(0.38, 2.9),
    lAnkle: point(-0.4, 4.05),
    rAnkle: point(0.4, 4.05)
  };
}

const addRoot = (p, root) => point(p.x + root.x, p.y + root.y, (p.z || 0) + (root.z || 0));

/** Convert the compact joint skeleton to a full set of 33 pose landmarks. */
export function expandSkeleton(skeleton, visibility = 0.99) {
  const root = skeleton.root || point(0, 0);
  const joint = (name) => addRoot(skeleton[name], root);
  const nose = joint('nose');
  const ls = joint('lShoulder');
  const rs = joint('rShoulder');
  const le = joint('lElbow');
  const re = joint('rElbow');
  const lw = joint('lWrist');
  const rw = joint('rWrist');
  const lh = joint('lHip');
  const rh = joint('rHip');
  const lk = joint('lKnee');
  const rk = joint('rKnee');
  const la = joint('lAnkle');
  const ra = joint('rAnkle');
  const landmarks = Array.from({ length: 33 }, () => point(0, 0));

  landmarks[0] = nose;
  landmarks[1] = point(nose.x - 0.105, nose.y - 0.055, nose.z - 0.015);
  landmarks[2] = point(nose.x - 0.145, nose.y - 0.06, nose.z - 0.02);
  landmarks[3] = point(nose.x - 0.2, nose.y - 0.045, nose.z);
  landmarks[4] = point(nose.x + 0.105, nose.y - 0.055, nose.z - 0.015);
  landmarks[5] = point(nose.x + 0.145, nose.y - 0.06, nose.z - 0.02);
  landmarks[6] = point(nose.x + 0.2, nose.y - 0.045, nose.z);
  landmarks[7] = point(nose.x - 0.34, nose.y + 0.015, nose.z + 0.04);
  landmarks[8] = point(nose.x + 0.34, nose.y + 0.015, nose.z + 0.04);
  landmarks[9] = point(nose.x - 0.09, nose.y + 0.2, nose.z - 0.035);
  landmarks[10] = point(nose.x + 0.09, nose.y + 0.2, nose.z - 0.035);
  landmarks[11] = ls;
  landmarks[12] = rs;
  landmarks[13] = le;
  landmarks[14] = re;
  landmarks[15] = lw;
  landmarks[16] = rw;

  // Hand points follow each wrist and form a small, readable open hand.
  landmarks[17] = point(lw.x - 0.12, lw.y - 0.02, lw.z - 0.015);
  landmarks[18] = point(rw.x + 0.12, rw.y - 0.02, rw.z - 0.015);
  landmarks[19] = point(lw.x - 0.07, lw.y - 0.18, lw.z - 0.04);
  landmarks[20] = point(rw.x + 0.07, rw.y - 0.18, rw.z - 0.04);
  landmarks[21] = point(lw.x + 0.1, lw.y - 0.08, lw.z - 0.12);
  landmarks[22] = point(rw.x - 0.1, rw.y - 0.08, rw.z - 0.12);
  landmarks[23] = lh;
  landmarks[24] = rh;
  landmarks[25] = lk;
  landmarks[26] = rk;
  landmarks[27] = la;
  landmarks[28] = ra;
  landmarks[29] = point(la.x - 0.08, la.y + 0.09, la.z + 0.12);
  landmarks[30] = point(ra.x + 0.08, ra.y + 0.09, ra.z + 0.12);
  landmarks[31] = point(la.x - 0.09, la.y + 0.18, la.z - 0.25);
  landmarks[32] = point(ra.x + 0.09, ra.y + 0.18, ra.z - 0.25);

  return landmarks.map((p) => ({ ...p, v: visibility }));
}

export function copySkeleton(skeleton) {
  return Object.fromEntries(Object.entries(skeleton).map(([key, p]) => [key, { ...p }]));
}
