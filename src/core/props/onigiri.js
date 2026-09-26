import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import {
  createPickupState,
  distance,
  latestPose,
  resetPickupState,
  updatePickupState,
  wristPoint
} from './hand.js';

export function createOnigiriState({
  gesture = GESTURE_CONFIG.eat,
  prop = PROP_CONFIG,
  seed,
  pickupSide,
  pickupDistanceScale = 1
} = {}) {
  const state = {
    visible: true,
    ...createPickupState({ seed, pickupSide, pickup: prop.pickup }),
    nearMouth: false,
    mouthDistance: Infinity,
    biteCount: 0,
    bites: [],
    approachArmed: true,
    t: 0
  };
  return {
    reset() {
      resetPickupState(state);
      Object.assign(state, {
        nearMouth: false, mouthDistance: Infinity,
        biteCount: 0, bites: [], approachArmed: true, t: 0
      });
      return snapshot(state);
    },
    update(history, t) {
      return updateOnigiri(state, history, t, { gesture, prop, pickupDistanceScale });
    },
    setPickupDistanceScale(scale) { pickupDistanceScale = scale; },
    get state() { return snapshot(state); }
  };
}

function snapshot(state) {
  return {
    ...state,
    pickupSpot: { ...state.pickupSpot },
    bites: state.bites.map((bite) => ({ ...bite }))
  };
}

export function updateOnigiri(state, history, t, {
  gesture = GESTURE_CONFIG.eat,
  prop = PROP_CONFIG,
  pickupDistanceScale = 1
} = {}) {
  const pose = latestPose(history);
  updatePickupState(state, history, t, {
    mouthDistance: gesture.mouthDistance,
    pickup: prop.pickup,
    pickupDistanceScale
  });
  const wrist = state.held ? wristPoint(pose, state.propHand) : null;
  const mouthDistance = distance(wrist, pose?.p?.mouth);

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
