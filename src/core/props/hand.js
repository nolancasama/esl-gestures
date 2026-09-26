import { HISTORY, POSE } from '../../config/timing.js';

export function historyWindow(history, ms = HISTORY.propHandWindowMs) {
  if (!history) return [];
  if (typeof history.window === 'function') return history.window(ms);
  const frames = Array.isArray(history) ? history : [];
  if (frames.length === 0) return [];
  const cutoff = frames.at(-1).t - ms;
  return frames.filter(({ t }) => t >= cutoff);
}

export function latestPose(history) {
  if (!history) return null;
  if (typeof history.latest === 'function') return history.latest();
  return Array.isArray(history) ? history.at(-1) ?? null : null;
}

export function pointVisible(point) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && (point.v ?? 1) >= POSE.minVisibility);
}

export function distance(a, b) {
  if (!pointVisible(a) || !pointVisible(b)) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wristPoint(pose, hand) {
  return pose?.p?.[hand === 'left' ? 'lWrist' : 'rWrist'] ?? null;
}

export function handTravel(history, hand) {
  const poses = historyWindow(history);
  let total = 0;
  let previous = null;
  for (const pose of poses) {
    const wrist = wristPoint(pose, hand);
    if (!pose?.ok || !pointVisible(wrist)) continue;
    if (previous) total += distance(previous, wrist);
    previous = wrist;
  }
  return total;
}

export function selectPropHand(history, currentHand = null, lockCurrent = () => false) {
  const pose = latestPose(history);
  if (currentHand && pointVisible(wristPoint(pose, currentHand)) && lockCurrent(pose, currentHand)) {
    return currentHand;
  }

  const leftVisible = pointVisible(wristPoint(pose, 'left'));
  const rightVisible = pointVisible(wristPoint(pose, 'right'));
  if (!leftVisible) return rightVisible ? 'right' : currentHand;
  if (!rightVisible) return 'left';

  const leftTravel = handTravel(history, 'left');
  const rightTravel = handTravel(history, 'right');
  if (leftTravel === rightTravel) return currentHand ?? 'right';
  return leftTravel > rightTravel ? 'left' : 'right';
}

export function insideBoard(point, board, padding = 0) {
  return pointVisible(point)
    && Math.abs(point.x - board.centerX) <= board.halfWidth + padding
    && point.y >= board.minY - padding
    && point.y <= board.maxY + padding;
}
