import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import { distance, latestPose, pointVisible, selectPropHand, wristPoint } from './hand.js';

export function createOnigiriState({ gesture = GESTURE_CONFIG.eat, prop = PROP_CONFIG } = {}) {
  const state = {
    visible: true,
    propHand: null,
    x: 0,
    y: 0,
    nearMouth: false,
    mouthDistance: Infinity,
    biteCount: 0,
    bites: [],
    approachArmed: true,
    t: 0
  };
  return {
    reset() {
      Object.assign(state, {
        propHand: null, nearMouth: false, mouthDistance: Infinity,
        biteCount: 0, bites: [], approachArmed: true, t: 0
      });
      return snapshot(state);
    },
    update(history, t) { return updateOnigiri(state, history, t, { gesture, prop }); },
    get state() { return snapshot(state); }
  };
}

function snapshot(state) {
  return { ...state, bites: state.bites.map((bite) => ({ ...bite })) };
}

export function updateOnigiri(state, history, t, { gesture = GESTURE_CONFIG.eat, prop = PROP_CONFIG } = {}) {
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

  if (mouthDistance >= prop.onigiri.biteResetDistance) state.approachArmed = true;
  if (state.approachArmed && mouthDistance <= gesture.mouthDistance) {
    state.approachArmed = false;
    state.biteCount = Math.min(prop.onigiri.maxBites, state.biteCount + 1);
    state.bites.push({ index: state.biteCount, t });
    if (state.bites.length > prop.onigiri.maxBites) state.bites.shift();
  }

  state.nearMouth = mouthDistance <= gesture.mouthDistance;
  state.mouthDistance = mouthDistance;
  state.t = t;
  return snapshot(state);
}

