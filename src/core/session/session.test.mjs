import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from './session.js';

const POOL = ['jump', 'run', 'walk', 'dance', 'swim', 'fly', 'climb', 'catch', 'drink'];

test('a round starts with prior help verbs and has eight distinct base items', () => {
  const session = createSession({ pool: POOL, priorNeededHelp: ['fly', 'run'], rng: () => 0 });
  assert.deepEqual(session.queue.slice(0, 2).map(({ verb }) => verb), ['fly', 'run']);
  assert.equal(session.queue.length, 8);
  assert.equal(new Set(session.queue.map(({ verb }) => verb)).size, 8);
});

test('needed-help items recycle once, three to six positions later', () => {
  const session = createSession({ pool: POOL, rng: () => 0 });
  const verb = session.current().verb;
  const result = session.complete({ maxStage: 2, skipped: true, timeMs: 6000 });

  assert.equal(result.recycledItem.verb, verb);
  assert.equal(session.queue.findIndex((item, index) => index > 0 && item.verb === verb), 3);
  assert.deepEqual(Object.keys(result.record), [
    'verb', 'recycled', 'recognised', 'teacherPass', 'skipped', 'maxStage', 'quality', 'timeMs'
  ]);

  while (!session.done) session.complete({ recognised: true, quality: 75, timeMs: 1200 });
  assert.equal(session.queue.filter((item) => item.verb === verb).length, 2);
  assert.deepEqual(session.summary().neededHelp, [verb]);
});

test('recycling is capped at three items per round', () => {
  const session = createSession({ pool: POOL, rng: () => 0 });
  while (!session.done) session.complete({ maxStage: 2, recognised: true });
  assert.equal(session.queue.filter(({ recycled }) => recycled).length, 3);
});

