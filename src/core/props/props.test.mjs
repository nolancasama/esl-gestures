import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCatchBallState,
  createCupState,
  createCuttingBoardState,
  createOnigiriState,
  createWashBubblesState
} from './index.js';

function frame(t, left, right, mouth = { x: 0, y: -0.8, v: 1 }) {
  return {
    t,
    ok: true,
    p: {
      lWrist: { ...left, v: 1 },
      rWrist: { ...right, v: 1 },
      mouth
    }
  };
}

test('cup and onigiri follow the more active hand and react at the mouth', () => {
  const history = [
    frame(0, { x: -1, y: 0.5 }, { x: 1, y: 0.5 }),
    frame(200, { x: 0, y: -0.8 }, { x: 1.05, y: 0.5 })
  ];
  const cup = createCupState().update(history, 200);
  assert.equal(cup.propHand, 'left');
  assert.equal(cup.nearMouth, true);
  assert.notEqual(cup.tilt, 0);

  const food = createOnigiriState();
  assert.equal(food.update(history, 200).biteCount, 1);
  food.update([...history, frame(400, { x: -1, y: 0.6 }, { x: 1.05, y: 0.5 })], 400);
  assert.equal(food.update([...history, frame(600, { x: 0, y: -0.8 }, { x: 1.05, y: 0.5 })], 600).biteCount, 2);
});

test('cutting board counts downward strokes inside its zone', () => {
  const board = createCuttingBoardState();
  const right = { x: 2, y: 0.5 };
  board.update([frame(0, { x: 0, y: 0.4 }, right)], 0);
  let state = board.update([frame(100, { x: 0, y: 0.9 }, right)], 100);
  assert.equal(state.sliceCount, 1);
  board.update([frame(200, { x: 0, y: 0.5 }, right)], 200);
  state = board.update([frame(300, { x: 0, y: 1.0 }, right)], 300);
  assert.equal(state.sliceCount, 2);
  assert.equal(state.knife.visible, true);
});

test('catch ball sticks to either wrist in the arrival window', () => {
  const target = { x: -0.8, y: -0.5 };
  const ball = createCatchBallState({ target });
  const state = ball.update([frame(1400, target, { x: 1, y: 0.5 })], 1400);
  assert.equal(state.caught, true);
  assert.equal(state.caughtBy, 'left');
  assert.deepEqual({ x: state.ball.x, y: state.ball.y }, target);
});

test('wash bubbles spawn from close, relatively moving hands', () => {
  const bubbles = createWashBubblesState();
  const history = [
    frame(0, { x: -0.4, y: 0.5 }, { x: 0.4, y: 0.5 }),
    frame(100, { x: -0.1, y: 0.5 }, { x: 0.1, y: 0.5 })
  ];
  const state = bubbles.update(history, 100);
  assert.equal(state.rubbing, true);
  assert.ok(state.bubbles.length > 0);
});

