import assert from 'node:assert/strict';
import test from 'node:test';

import { PoseHistory } from './history.js';

function pose(t, shoulderY = 0.4, visibility = 1) {
  return {
    t,
    ok: true,
    scale: 0.2,
    origin: { x: 0.5, y: shoulderY },
    p: {
      lShoulder: { x: -0.5, y: 0, v: visibility },
      rShoulder: { x: 0.5, y: 0, v: visibility }
    },
    raw: { t, landmarks: [] }
  };
}

test('PoseHistory retains only the configured time window', () => {
  const history = new PoseHistory(1000);
  history.push(pose(0));
  history.push(pose(400));
  history.push(pose(1000));
  history.push(pose(1401));

  assert.deepEqual(history.window().map(({ t }) => t), [1000, 1401]);
  assert.deepEqual(history.window(500).map(({ t }) => t), [1000, 1401]);
  assert.equal(history.latest().t, 1401);
});

test('PoseHistory keeps an absolute shoulder-mid baseline series', () => {
  const history = new PoseHistory(2500);
  history.push(pose(0, 0.42, 0.9));
  history.push(pose(600, 0.37, 0.8));
  history.push(pose(1200, 0.43, 0.7));

  assert.deepEqual(history.absoluteWindow(700), [
    { t: 600, y: 0.37, v: 0.8 },
    { t: 1200, y: 0.43, v: 0.7 }
  ]);
  assert.deepEqual(history.absoluteBaseline.map(({ y }) => y), [0.42, 0.37, 0.43]);
});

test('PoseHistory clears state and treats backwards time as a new stream', () => {
  const history = new PoseHistory({ windowMs: 2500 });
  history.push(pose(100));
  history.push(pose(200));
  history.push(pose(0));
  assert.deepEqual(history.window().map(({ t }) => t), [0]);

  history.clear();
  assert.equal(history.latest(), null);
  assert.deepEqual(history.absoluteBaseline, []);
});
