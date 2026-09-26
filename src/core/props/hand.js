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

export function createPickupState({ seed, pickupSide, pickup }) {
  const side = pickupSide === 'left' || pickupSide === -1
    ? -1
    : pickupSide === 'right' || pickupSide === 1
      ? 1
      : seededSide(seed);
  const pickupSpot = { x: side * pickup.horizontalOffset, y: pickup.verticalOffset };
  return {
    held: false,
    phase: 'resting',
    propHand: null,
    pickupSide: side < 0 ? 'left' : 'right',
    pickupSpot,
    x: pickupSpot.x,
    y: pickupSpot.y,
    autoAttached: false,
    glideComplete: false,
    attachTime: null,
    attachX: pickupSpot.x,
    attachY: pickupSpot.y
  };
}

function seededSide(seed) {
  if (seed == null) return Math.random() < 0.5 ? -1 : 1;
  let value = typeof seed === 'number' ? seed >>> 0 : 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
  return (value / 4294967296) < 0.5 ? -1 : 1;
}

export function resetPickupState(state) {
  Object.assign(state, {
    held: false,
    phase: 'resting',
    propHand: null,
    x: state.pickupSpot.x,
    y: state.pickupSpot.y,
    autoAttached: false,
    glideComplete: false,
    attachTime: null,
    attachX: state.pickupSpot.x,
    attachY: state.pickupSpot.y
  });
}

export function updatePickupState(state, history, t, {
  mouthDistance,
  pickup,
  pickupDistanceScale = 1
}) {
  const pose = latestPose(history);
  if (!state.held) {
    const hands = ['left', 'right'].map((hand) => ({
      hand,
      wrist: wristPoint(pose, hand)
    })).filter(({ wrist }) => pointVisible(wrist));
    const atPickup = hands
      .map((candidate) => ({ ...candidate, distance: distance(candidate.wrist, state.pickupSpot) }))
      .filter((candidate) => candidate.distance <= pickup.pickupDistance * pickupDistanceScale)
      .sort((a, b) => a.distance - b.distance)[0];
    const atMouth = hands
      .map((candidate) => ({ ...candidate, distance: distance(candidate.wrist, pose?.p?.mouth) }))
      .filter((candidate) => candidate.distance <= mouthDistance)
      .sort((a, b) => a.distance - b.distance)[0];
    const attached = atPickup ?? atMouth;
    if (attached) {
      state.held = true;
      state.phase = 'held';
      state.propHand = attached.hand;
      state.autoAttached = !atPickup;
      state.glideComplete = !state.autoAttached;
      state.attachTime = t;
      state.attachX = state.x;
      state.attachY = state.y;
    }
  }

  if (!state.held) {
    state.x = state.pickupSpot.x;
    state.y = state.pickupSpot.y;
    return;
  }

  const wrist = wristPoint(pose, state.propHand);
  if (!pointVisible(wrist)) return;
  if (state.autoAttached && !state.glideComplete) {
    const progress = Math.max(0, Math.min(1,
      (t - state.attachTime) / pickup.autoAttachGlideMs
    ));
    state.x = state.attachX + (wrist.x - state.attachX) * progress;
    state.y = state.attachY + (wrist.y - state.attachY) * progress;
    state.glideComplete = progress >= 1;
    return;
  }
  state.x += (wrist.x - state.x) * pickup.followAlpha;
  state.y += (wrist.y - state.y) * pickup.followAlpha;
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
