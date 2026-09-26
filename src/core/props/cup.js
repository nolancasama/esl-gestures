import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import {
  createPickupState,
  distance,
  latestPose,
  resetPickupState,
  updatePickupState,
  wristPoint
} from './hand.js';

export function createCupState({
  gesture = GESTURE_CONFIG.drink,
  prop = PROP_CONFIG,
  seed,
  pickupSide,
  pickupDistanceScale = 1
} = {}) {
  const state = {
    visible: true,
    ...createPickupState({ seed, pickupSide, pickup: prop.pickup }),
    tilt: 0,
    nearMouth: false,
    mouthDistance: Infinity,
    t: 0
  };

  return {
    reset() {
      resetPickupState(state);
      Object.assign(state, { tilt: 0, nearMouth: false, mouthDistance: Infinity, t: 0 });
      return snapshot(state);
    },
    update(history, t) {
      return updateCup(state, history, t, { gesture, prop, pickupDistanceScale });
    },
    setPickupDistanceScale(scale) { pickupDistanceScale = scale; },
    get state() { return snapshot(state); }
  };
}

function snapshot(state) {
  return { ...state, pickupSpot: { ...state.pickupSpot } };
}

export function updateCup(state, history, t, {
  gesture = GESTURE_CONFIG.drink,
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
  const tiltProgress = Math.max(0, Math.min(1,
    (prop.cup.tiltStartDistance - mouthDistance) / prop.cup.tiltStartDistance
  ));
  state.tilt = (state.propHand === 'left' ? -1 : 1) * tiltProgress * prop.cup.maxTiltRadians;
  state.nearMouth = mouthDistance <= gesture.mouthDistance;
  state.mouthDistance = mouthDistance;
  state.t = t;
  return snapshot(state);
}
