import { GESTURE_CONFIG, PROP_CONFIG } from '../../config/gestures.js';
import { insideBoard, latestPose, pointVisible, selectPropHand, wristPoint } from './hand.js';

export function createCuttingBoardState({ gesture = GESTURE_CONFIG.cut, prop = PROP_CONFIG } = {}) {
  const state = {
    visible: true,
    board: { ...prop.board },
    propHand: null,
    knife: { visible: false, x: 0, y: 0 },
    sliceCount: 0,
    slices: [],
    strokeArmed: true,
    strokeStartY: null,
    strokeBottomY: null,
    t: 0
  };
  return {
    reset() {
      Object.assign(state, {
        propHand: null, sliceCount: 0, slices: [], strokeArmed: true,
        strokeStartY: null, strokeBottomY: null, t: 0
      });
      state.knife = { visible: false, x: 0, y: 0 };
      return snapshot(state);
    },
    update(history, t) { return updateCuttingBoard(state, history, t, { gesture, prop }); },
    get state() { return snapshot(state); }
  };
}

function snapshot(state) {
  return {
    ...state,
    board: { ...state.board },
    knife: { ...state.knife },
    slices: state.slices.map((slice) => ({ ...slice }))
  };
}

export function updateCuttingBoard(state, history, t, { gesture = GESTURE_CONFIG.cut, prop = PROP_CONFIG } = {}) {
  const pose = latestPose(history);
  state.propHand = selectPropHand(history, state.propHand, (current, hand) => (
    insideBoard(wristPoint(current, hand), state.board, prop.propHand.boardPadding)
  ));
  if (!insideBoard(wristPoint(pose, state.propHand), state.board, prop.propHand.boardPadding)) {
    if (insideBoard(wristPoint(pose, 'left'), state.board, prop.propHand.boardPadding)) state.propHand = 'left';
    else if (insideBoard(wristPoint(pose, 'right'), state.board, prop.propHand.boardPadding)) state.propHand = 'right';
  }
  const wrist = wristPoint(pose, state.propHand);
  const inBoard = insideBoard(wrist, state.board);
  state.knife = pointVisible(wrist) && inBoard
    ? { visible: true, x: wrist.x, y: wrist.y }
    : { ...state.knife, visible: false };

  if (!inBoard) {
    state.strokeArmed = true;
    state.strokeStartY = null;
    state.strokeBottomY = null;
  } else if (state.strokeStartY == null) {
    state.strokeStartY = wrist.y;
    state.strokeBottomY = wrist.y;
  } else if (state.strokeArmed) {
    state.strokeStartY = Math.min(state.strokeStartY, wrist.y);
    state.strokeBottomY = Math.max(state.strokeBottomY, wrist.y);
    if (wrist.y - state.strokeStartY >= gesture.strokeDistance) {
      state.sliceCount += 1;
      state.slices.push({ index: state.sliceCount, x: wrist.x, t });
      state.strokeArmed = false;
      state.strokeBottomY = wrist.y;
    }
  } else if (wrist.y <= state.strokeBottomY - gesture.resetDistance) {
    state.strokeArmed = true;
    state.strokeStartY = wrist.y;
    state.strokeBottomY = wrist.y;
  }

  state.t = t;
  return snapshot(state);
}
