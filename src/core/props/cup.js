import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import { distance, latestPose, pointVisible, selectPropHand, wristPoint } from './hand.js';

export function createCupState({ gesture = GESTURE_CONFIG.drink, prop = PROP_CONFIG } = {}) {
  const state = {
    visible: true,
    propHand: null,
    x: 0,
    y: 0,
    tilt: 0,
    nearMouth: false,
    mouthDistance: Infinity,
    t: 0
  };

  return {
    reset() {
      Object.assign(state, { propHand: null, tilt: 0, nearMouth: false, mouthDistance: Infinity, t: 0 });
      return { ...state };
    },
    update(history, t) {
      return updateCup(state, history, t, { gesture, prop });
    },
    get state() { return { ...state }; }
  };
}

export function updateCup(state, history, t, { gesture = GESTURE_CONFIG.drink, prop = PROP_CONFIG } = {}) {
  const pose = latestPose(history);
  state.propHand = selectPropHand(history, state.propHand, (current, hand) => (
    distance(wristPoint(current, hand), current.p?.mouth) <= prop.propHand.nearMouthDistance
  ));
  const wrist = wristPoint(pose, state.propHand);
  const mouthDistance = distance(wrist, pose?.p?.mouth);
  if (pointVisible(wrist)) {
    state.x = wrist.x;
    state.y = wrist.y;
  }
  const tiltProgress = Math.max(0, Math.min(1,
    (prop.cup.tiltStartDistance - mouthDistance) / prop.cup.tiltStartDistance
  ));
  state.tilt = (state.propHand === 'left' ? -1 : 1) * tiltProgress * prop.cup.maxTiltRadians;
  state.nearMouth = mouthDistance <= gesture.mouthDistance;
  state.mouthDistance = mouthDistance;
  state.t = t;
  return { ...state };
}

