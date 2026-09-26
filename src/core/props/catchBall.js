import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import { TIMING } from '../../config/timing.js';
import { distance, latestPose, pointVisible } from './hand.js';

function seededRng(seed = 0) {
  let value = typeof seed === 'number' ? seed >>> 0 : 0;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedTarget(rng, config) {
  for (;;) {
    const target = {
      x: (rng() * 2 - 1) * config.targetMaxX,
      y: config.targetMinY + rng() * (config.targetMaxY - config.targetMinY)
    };
    const onTorso = Math.abs(target.x) < config.torsoHalfWidth
      && target.y >= config.torsoMinY && target.y <= config.torsoMaxY;
    if (!onTorso) return target;
  }
}

function snapshot(state) {
  return {
    visible: state.visible,
    phase: state.phase,
    caught: state.caught,
    caughtBy: state.caughtBy,
    launchTime: state.launchTime,
    target: { ...state.target },
    ball: { ...state.ball },
    t: state.t
  };
}

function launch(state, launchTime) {
  state.launchIndex += 1;
  const configured = typeof state.targetOption === 'function'
    ? state.targetOption(state.launchIndex, state.rng)
    : state.targetOption;
  state.target = configured ? { x: configured.x, y: configured.y } : generatedTarget(state.rng, state.config);
  const launchSide = state.rng() < 0.5 ? -1 : 1;
  state.start = { x: launchSide * state.config.launchX, y: state.config.launchY };
  state.launchTime = launchTime;
  state.phase = 'flying';
  state.caught = false;
  state.caughtBy = null;
  state.ball = { ...state.start, alpha: 1 };
}

export function createCatchBallState({
  seed = 0,
  target = null,
  gesture = GESTURE_CONFIG.catch,
  prop = PROP_CONFIG,
  timing = TIMING,
  launchTime = 0
} = {}) {
  const initialSeed = seed;
  const state = {
    visible: true,
    phase: 'flying',
    caught: false,
    caughtBy: null,
    launchTime,
    launchIndex: -1,
    target: { x: 0, y: 0 },
    start: { x: 0, y: 0 },
    ball: { x: 0, y: 0, alpha: 1 },
    nextLaunchTime: null,
    targetOption: target,
    rng: seededRng(seed),
    config: prop.catch,
    gesture,
    timing,
    t: launchTime
  };
  launch(state, launchTime);

  return {
    reset(t = 0) {
      state.rng = seededRng(initialSeed);
      state.launchIndex = -1;
      state.nextLaunchTime = null;
      launch(state, t);
      state.t = t;
      return snapshot(state);
    },
    update(history, t) { return updateCatchBall(state, history, t); },
    get state() { return snapshot(state); }
  };
}

export function updateCatchBall(state, history, t) {
  if (t < state.t) throw new RangeError('Catch-ball time must be monotonic');
  while (state.phase !== 'caught') {
    if (state.phase === 'missed' && t >= state.nextLaunchTime) {
      launch(state, state.nextLaunchTime);
      continue;
    }
    const missTime = state.launchTime + state.timing.catchFlightMs + state.timing.catchArrivalAfterMs;
    if (state.phase === 'flying' && t > missTime) {
      state.phase = 'missed';
      state.nextLaunchTime = missTime + state.timing.catchRelaunchMs;
      state.ball = { ...state.target, alpha: 1 };
      continue;
    }
    break;
  }

  const pose = latestPose(history);
  if (state.phase === 'caught') {
    const wrist = pose?.p?.[state.caughtBy === 'left' ? 'lWrist' : 'rWrist'];
    if (pointVisible(wrist)) state.ball = { x: wrist.x, y: wrist.y, alpha: 1 };
  } else if (state.phase === 'flying') {
    const elapsed = t - state.launchTime;
    const progress = Math.max(0, Math.min(1, elapsed / state.timing.catchFlightMs));
    const eased = 1 - (1 - progress) * (1 - progress);
    state.ball = {
      x: state.start.x + (state.target.x - state.start.x) * eased,
      y: state.start.y + (state.target.y - state.start.y) * eased,
      alpha: 1
    };

    const arrivalOffset = elapsed - state.timing.catchFlightMs;
    const inArrivalWindow = arrivalOffset >= -state.timing.catchArrivalBeforeMs
      && arrivalOffset <= state.timing.catchArrivalAfterMs;
    if (inArrivalWindow && pose?.ok) {
      const leftDistance = distance(pose.p?.lWrist, state.ball);
      const rightDistance = distance(pose.p?.rWrist, state.ball);
      const closest = Math.min(leftDistance, rightDistance);
      if (closest <= state.gesture.catchDistance) {
        state.phase = 'caught';
        state.caught = true;
        state.caughtBy = leftDistance <= rightDistance ? 'left' : 'right';
        const wrist = pose.p[state.caughtBy === 'left' ? 'lWrist' : 'rWrist'];
        state.ball = { x: wrist.x, y: wrist.y, alpha: 1 };
      }
    }

  } else if (state.phase === 'missed') {
    const fadeStart = state.nextLaunchTime - state.timing.catchRelaunchMs;
    state.ball.alpha = Math.max(0, 1 - (t - fadeStart) / state.config.missFadeMs);
  }

  state.t = t;
  return snapshot(state);
}
