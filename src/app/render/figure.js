import { LANDMARK, poseAt } from '../../core/synth/generate.js';

const LIMBS = Object.freeze([
  [LANDMARK.leftShoulder, LANDMARK.rightShoulder],
  [LANDMARK.leftShoulder, LANDMARK.leftElbow],
  [LANDMARK.leftElbow, LANDMARK.leftWrist],
  [LANDMARK.rightShoulder, LANDMARK.rightElbow],
  [LANDMARK.rightElbow, LANDMARK.rightWrist],
  [LANDMARK.leftShoulder, LANDMARK.leftHip],
  [LANDMARK.rightShoulder, LANDMARK.rightHip],
  [LANDMARK.leftHip, LANDMARK.rightHip],
  [LANDMARK.leftHip, LANDMARK.leftKnee],
  [LANDMARK.leftKnee, LANDMARK.leftAnkle],
  [LANDMARK.rightHip, LANDMARK.rightKnee],
  [LANDMARK.rightKnee, LANDMARK.rightAnkle]
]);

const DEBUG_LIMBS = Object.freeze([
  ...LIMBS,
  [LANDMARK.leftWrist, LANDMARK.leftIndex],
  [LANDMARK.rightWrist, LANDMARK.rightIndex]
]);

function valid(point, minVisibility = 0) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && (point.v ?? 1) >= minVisibility;
}

function containTransform(landmarks, rect, padding = 0.08) {
  const bodyIndices = [
    LANDMARK.nose, LANDMARK.leftShoulder, LANDMARK.rightShoulder,
    LANDMARK.leftElbow, LANDMARK.rightElbow, LANDMARK.leftWrist,
    LANDMARK.rightWrist, LANDMARK.leftHip, LANDMARK.rightHip,
    LANDMARK.leftKnee, LANDMARK.rightKnee, LANDMARK.leftAnkle,
    LANDMARK.rightAnkle
  ];
  const points = bodyIndices.map((index) => landmarks?.[index]).filter((point) => valid(point));
  if (!points.length) return () => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const innerWidth = rect.width * (1 - padding * 2);
  const innerHeight = rect.height * (1 - padding * 2);
  const scale = Math.min(innerWidth / Math.max(0.01, maxX - minX), innerHeight / Math.max(0.01, maxY - minY));
  const left = rect.x + (rect.width - (maxX - minX) * scale) / 2;
  const top = rect.y + (rect.height - (maxY - minY) * scale) / 2;
  return (point) => ({ x: left + (point.x - minX) * scale, y: top + (point.y - minY) * scale });
}

/** Draw a clean, readable cartoon figure from a detector-shaped PoseFrame. */
export function drawCartoonFigure(ctx, poseFrame, rect, options = {}) {
  const landmarks = poseFrame?.landmarks;
  if (!Array.isArray(landmarks)) return null;
  const map = typeof options.mapPoint === 'function'
    ? options.mapPoint
    : containTransform(landmarks, rect, options.padding);
  const lineWidth = options.lineWidth ?? Math.max(5, Math.min(rect.width, rect.height) * 0.035);
  const color = options.color ?? '#26324a';
  const skin = options.skin ?? '#ffd6b0';
  const joints = options.joints ?? '#ff6b6b';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  for (const [fromIndex, toIndex] of LIMBS) {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!valid(from, 0.15) || !valid(to, 0.15)) continue;
    const a = map(from);
    const b = map(to);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const nose = landmarks[LANDMARK.nose];
  const leftEar = landmarks[LANDMARK.leftEar];
  const rightEar = landmarks[LANDMARK.rightEar];
  if (valid(nose)) {
    const centre = map(nose);
    const earDistance = valid(leftEar) && valid(rightEar)
      ? Math.abs(map(rightEar).x - map(leftEar).x)
      : lineWidth * 3.4;
    const radius = Math.max(lineWidth * 1.35, earDistance * 0.58);
    const leftShoulder = landmarks[LANDMARK.leftShoulder];
    const rightShoulder = landmarks[LANDMARK.rightShoulder];
    if (valid(leftShoulder, 0.15) && valid(rightShoulder, 0.15)) {
      const left = map(leftShoulder);
      const right = map(rightShoulder);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y);
      ctx.lineTo((left.x + right.x) / 2, (left.y + right.y) / 2);
      ctx.stroke();
    }
    ctx.fillStyle = skin;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, lineWidth * 0.55);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centre.x - radius * 0.3, centre.y - radius * 0.08, Math.max(1.5, radius * 0.08), 0, Math.PI * 2);
    ctx.arc(centre.x + radius * 0.3, centre.y - radius * 0.08, Math.max(1.5, radius * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centre.x, centre.y + radius * 0.1, radius * 0.37, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();
  }

  ctx.fillStyle = joints;
  for (const index of [LANDMARK.leftWrist, LANDMARK.rightWrist, LANDMARK.leftAnkle, LANDMARK.rightAnkle]) {
    const point = landmarks[index];
    if (!valid(point, 0.15)) continue;
    const at = map(point);
    ctx.beginPath();
    ctx.arc(at.x, at.y, lineWidth * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return { map, lineWidth };
}

/** Draw MediaPipe landmarks with per-landmark visibility for debug/setup views. */
export function drawDebugSkeleton(ctx, poseFrame, mapPoint, options = {}) {
  const landmarks = poseFrame?.landmarks;
  if (!Array.isArray(landmarks) || typeof mapPoint !== 'function') return;
  const lineWidth = options.lineWidth ?? 3;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidth;
  for (const [fromIndex, toIndex] of DEBUG_LIMBS) {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!valid(from) || !valid(to)) continue;
    const a = mapPoint(from);
    const b = mapPoint(to);
    const visibility = Math.min(from.v ?? 1, to.v ?? 1);
    ctx.strokeStyle = `rgba(72, 238, 186, ${0.18 + visibility * 0.78})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.font = `${Math.max(9, options.fontSize ?? 10)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  landmarks.forEach((point, index) => {
    if (!valid(point)) return;
    const at = mapPoint(point);
    const visibility = Math.max(0, Math.min(1, point.v ?? 1));
    ctx.fillStyle = visibility >= 0.5 ? '#54f0bf' : '#ffbe4f';
    ctx.beginPath();
    ctx.arc(at.x, at.y, Math.max(2, lineWidth * 1.2), 0, Math.PI * 2);
    ctx.fill();
    if (options.showVisibility !== false) {
      ctx.fillStyle = 'rgba(0, 0, 0, .82)';
      ctx.fillText(`${index}:${visibility.toFixed(1)}`, at.x, at.y - 4);
    }
  });
  ctx.restore();
}

function demoProp(ctx, verb, poseFrame, map, t, lineWidth) {
  const landmarks = poseFrame.landmarks;
  const wrist = (side) => map(landmarks[side === 'left' ? LANDMARK.leftWrist : LANDMARK.rightWrist]);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (verb === 'drink') {
    const p = wrist('right');
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#4bc0e8';
    ctx.fillRect(-lineWidth, -lineWidth * 1.5, lineWidth * 2, lineWidth * 2.4);
    ctx.strokeStyle = '#26324a';
    ctx.lineWidth = Math.max(2, lineWidth * 0.3);
    ctx.strokeRect(-lineWidth, -lineWidth * 1.5, lineWidth * 2, lineWidth * 2.4);
  } else if (verb === 'eat') {
    const p = wrist('left');
    ctx.fillStyle = '#fff8dc';
    ctx.strokeStyle = '#26324a';
    ctx.lineWidth = Math.max(2, lineWidth * 0.3);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - lineWidth * 1.35);
    ctx.lineTo(p.x - lineWidth * 1.15, p.y + lineWidth);
    ctx.lineTo(p.x + lineWidth * 1.15, p.y + lineWidth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#244d38';
    ctx.fillRect(p.x - lineWidth * 0.75, p.y + lineWidth * 0.25, lineWidth * 1.5, lineWidth * 0.65);
  } else if (verb === 'cut') {
    const leftHip = map(landmarks[LANDMARK.leftHip]);
    const rightHip = map(landmarks[LANDMARK.rightHip]);
    const boardX = (leftHip.x + rightHip.x) / 2;
    const boardY = Math.max(leftHip.y, rightHip.y) + lineWidth * 2.2;
    ctx.fillStyle = '#d99a54';
    ctx.beginPath();
    ctx.roundRect(boardX - lineWidth * 4.2, boardY - lineWidth, lineWidth * 8.4, lineWidth * 2, lineWidth * 0.5);
    ctx.fill();
    const p = wrist('right');
    ctx.strokeStyle = '#dce8ee';
    ctx.lineWidth = lineWidth * 0.7;
    ctx.beginPath();
    ctx.moveTo(p.x - lineWidth * 2.5, p.y + lineWidth * 0.3);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (verb === 'catch') {
    const phase = (t % 2300) / 2300;
    const target = wrist('right');
    const x = phase < 0.62 ? rectLerp(target.x + lineWidth * 8, target.x, phase / 0.62) : target.x;
    const y = phase < 0.62 ? rectLerp(target.y - lineWidth * 8, target.y, phase / 0.62) : target.y;
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.arc(x, y, lineWidth * 1.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (verb === 'wash') {
    const left = wrist('left');
    const right = wrist('right');
    const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    ctx.strokeStyle = '#9be8ff';
    ctx.lineWidth = Math.max(2, lineWidth * 0.3);
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 2.4 + t / 300;
      ctx.beginPath();
      ctx.arc(mid.x + Math.cos(angle) * lineWidth * (1 + i * 0.35), mid.y + Math.sin(angle) * lineWidth, lineWidth * (0.35 + i * 0.08), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

const rectLerp = (from, to, amount) => from + (to - from) * Math.max(0, Math.min(1, amount));

/** Render the shared synthetic motion used by hint and no-camera cards. */
export function drawDemoFigure(ctx, { verb, t = 0, rect, showProp = true, options = {} }) {
  if (!verb || !rect) return null;
  const poseFrame = poseAt(verb, t, { scale: 1, mirror: false });
  const result = drawCartoonFigure(ctx, poseFrame, rect, options);
  if (showProp && result) demoProp(ctx, verb, poseFrame, result.map, t, result.lineWidth);
  return poseFrame;
}
