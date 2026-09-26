import test from 'node:test';
import assert from 'node:assert/strict';
import { createHintManager } from './hints.js';

test('hint stages and auto-advance follow the configured timeline', () => {
  const hints = createHintManager();
  assert.equal(hints.update(2499, 0).stage, 0);
  assert.deepEqual(hints.update(2500, 0).events, [{ type: 'stage', stage: 1, t: 2500 }]);
  assert.equal(hints.update(5500, 0).stage, 2);
  assert.equal(hints.update(9000, 0).stage, 3);
  const result = hints.update(20000, 0);
  assert.equal(result.autoAdvanced, true);
  assert.equal(result.events.at(-1).type, 'autoAdvance');
});

test('evidence at a check delays a hint until a later half-second check', () => {
  const hints = createHintManager();
  assert.equal(hints.update(2500, 0.5).stage, 0);
  const result = hints.update(3000, 0.1);
  assert.equal(result.stage, 1);
  assert.deepEqual(result.events, [{ type: 'stage', stage: 1, t: 3000 }]);
});

test('jumpTo enters the requested hint stage through the normal stage event', () => {
  const hints = createHintManager();
  hints.update(2500, 0);

  const result = hints.jumpTo(3, 2600);
  assert.equal(result.stage, 3);
  assert.deepEqual(result.events, [{ type: 'stage', stage: 3, t: 2600 }]);
  assert.equal(hints.update(9000, 0).stage, 3);
});

test('jumpTo never moves hint stages backwards', () => {
  const hints = createHintManager();
  hints.jumpTo(3, 3000);
  assert.deepEqual(hints.jumpTo(1, 3100), { stage: 3, events: [], autoAdvanced: false });
});
