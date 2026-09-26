import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import { distance, historyWindow, latestPose, pointVisible } from './hand.js';

function snapshot(state) {
  return {
    visible: state.visible,
    rubbing: state.rubbing,
    handDistance: state.handDistance,
    relativeSpeed: state.relativeSpeed,
    midpoint: state.midpoint ? { ...state.midpoint } : null,
    bubbles: state.bubbles.map((bubble) => ({ ...bubble })),
    t: state.t
  };
}

function relativeVector(pose) {
  const left = pose?.p?.lWrist;
  const right = pose?.p?.rWrist;
  if (!pointVisible(left) || !pointVisible(right)) return null;
  return { x: left.x - right.x, y: left.y - right.y };
}

export function createWashBubblesState({ gesture = GESTURE_CONFIG.wash, prop = PROP_CONFIG } = {}) {
  const state = {
    visible: true,
    rubbing: false,
    handDistance: Infinity,
    relativeSpeed: 0,
    midpoint: null,
    bubbles: [],
    spawnRemainder: 0,
    nextId: 1,
    t: 0
  };
  return {
    reset() {
      Object.assign(state, {
        rubbing: false, handDistance: Infinity, relativeSpeed: 0,
        midpoint: null, bubbles: [], spawnRemainder: 0, nextId: 1, t: 0
      });
      return snapshot(state);
    },
    update(history, t) { return updateWashBubbles(state, history, t, { gesture, prop }); },
    get state() { return snapshot(state); }
  };
}

export function updateWashBubbles(state, history, t, { gesture = GESTURE_CONFIG.wash, prop = PROP_CONFIG } = {}) {
  if (t < state.t) throw new RangeError('Wash-bubble time must be monotonic');
  const pose = latestPose(history);
  const left = pose?.p?.lWrist;
  const right = pose?.p?.rWrist;
  state.handDistance = distance(left, right);
  state.midpoint = pointVisible(left) && pointVisible(right)
    ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
    : null;

  const poses = historyWindow(history).filter((frame) => frame?.ok && relativeVector(frame));
  const previous = poses.length > 1 ? poses.at(-2) : null;
  const previousVector = relativeVector(previous);
  const currentVector = relativeVector(pose);
  const dtMs = previous ? pose.t - previous.t : 0;
  state.relativeSpeed = previousVector && currentVector && dtMs > 0
    ? Math.hypot(currentVector.x - previousVector.x, currentVector.y - previousVector.y) / (dtMs / 1000)
    : 0;
  state.rubbing = state.handDistance <= gesture.maxHandDistance
    && state.relativeSpeed >= gesture.minRelativeSpeed;

  const dt = Math.max(0, t - state.t) / 1000;
  if (state.rubbing && state.midpoint) {
    state.spawnRemainder += state.relativeSpeed * dt * prop.wash.spawnPerUnit;
    const count = Math.floor(state.spawnRemainder);
    state.spawnRemainder -= count;
    for (let i = 0; i < count; i += 1) {
      state.bubbles.push({ id: state.nextId++, x: state.midpoint.x, y: state.midpoint.y, bornT: t, alpha: 1 });
    }
  }

  state.bubbles = state.bubbles
    .filter(({ bornT }) => t - bornT <= prop.wash.bubbleLifetimeMs)
    .slice(-prop.wash.maxBubbles)
    .map((bubble) => ({
      ...bubble,
      alpha: Math.max(0, 1 - (t - bubble.bornT) / prop.wash.bubbleLifetimeMs)
    }));
  state.t = t;
  return snapshot(state);
}

