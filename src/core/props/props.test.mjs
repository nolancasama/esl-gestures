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
      lWrist: { v: 1, ...left },
      rWrist: { v: 1, ...right },
      mouth
    }
  };
}

test('cup attaches when a visible wrist reaches its resting pickup spot', () => {
  const cup = createCupState({ pickupSide: 'right' });
  const resting = cup.state;
  assert.deepEqual(resting.pickupSpot, { x: 1.5, y: 0.6 });
  assert.equal(resting.held, false);

  const pickedUp = cup.update([
    frame(100, { x: -1, y: 0.6 }, { x: 1.45, y: 0.6 })
  ], 100);
  assert.equal(pickedUp.held, true);
  assert.equal(pickedUp.phase, 'held');
  assert.equal(pickedUp.propHand, 'right');
  assert.equal(pickedUp.autoAttached, false);
  assert.ok(pickedUp.x > 1.45, 'render position should smoothly trail the wrist');
});

test('onigiri auto-attaches at the mouth without visiting the pickup spot', () => {
  const history = [
    frame(0, { x: -1, y: 0.5 }, { x: 1, y: 0.5 }),
    frame(200, { x: 0, y: -0.8 }, { x: -1.2, y: 0.5 })
  ];
  const food = createOnigiriState({ pickupSide: 'right' });
  const attached = food.update(history, 200);
  assert.equal(attached.held, true);
  assert.equal(attached.propHand, 'left');
  assert.equal(attached.autoAttached, true);
  assert.equal(attached.nearMouth, true);
  assert.equal(attached.biteCount, 1);
  assert.deepEqual({ x: attached.x, y: attached.y }, attached.pickupSpot,
    'automatic attachment starts its glide at the resting spot');

  food.update([...history, frame(400, { x: -1, y: 0.6 }, { x: 1.05, y: 0.5 })], 400);
  assert.equal(food.update([...history, frame(600, { x: 0, y: -0.8 }, { x: 1.05, y: 0.5 })], 600).biteCount, 2);
});

test('pickup locks the prop hand even when the other hand moves farther', () => {
  const cup = createCupState({ pickupSide: 'left' });
  cup.update([frame(0, { x: -1.5, y: 0.6 }, { x: 1, y: 0.5 })], 0);
  const state = cup.update([
    frame(0, { x: -1.5, y: 0.6 }, { x: 1, y: 0.5 }),
    frame(100, { x: -1.4, y: 0.6 }, { x: -2, y: -1.5 }),
    frame(200, { x: -1.3, y: 0.6 }, { x: 2, y: 1.5 })
  ], 200);
  assert.equal(state.propHand, 'left');
  assert.equal(state.held, true);
});

test('an invisible locked wrist leaves the prop held at its last render position', () => {
  const food = createOnigiriState({ pickupSide: 'right' });
  let state = food.update([frame(0, { x: -1, y: 0.5 }, { x: 1.5, y: 0.6 })], 0);
  const lastPosition = { x: state.x, y: state.y };
  state = food.update([
    frame(100, { x: -1, y: 0.5 }, { x: 0, y: -0.8, v: 0 })
  ], 100);
  assert.equal(state.held, true);
  assert.equal(state.propHand, 'right');
  assert.deepEqual({ x: state.x, y: state.y }, lastPosition);
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
