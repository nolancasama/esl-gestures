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
    'verb', 'recycled', 'recognised', 'teacherPass', 'skipped', 'maxStage', 'quality', 'timeMs', 'watched'
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

test('watched is recorded and counts as needed help', () => {
  const session = createSession({ pool: POOL, rng: () => 0 });
  const verb = session.current().verb;
  const result = session.complete({ recognised: true, maxStage: 1, watched: true });

  assert.equal(result.record.watched, true);
  assert.deepEqual(session.summary().neededHelp, [verb]);
});

test('streak counts clean successes and retains the best after a silent reset', () => {
  const session = createSession({ pool: POOL, rng: () => 0 });

  let result = session.complete({ recognised: true, maxStage: 0 });
  assert.equal(result.currentStreak, 1);
  result = session.complete({ recognised: true, maxStage: 1 });
  assert.deepEqual(
    { current: result.currentStreak, best: result.bestStreak },
    { current: 2, best: 2 }
  );

  result = session.complete({ recognised: true, maxStage: 2 });
  assert.deepEqual(
    { current: result.currentStreak, best: result.bestStreak },
    { current: 0, best: 2 }
  );
  assert.equal(session.summary().bestStreak, 2);
});

test('teacher pass, watched, skipped, and a wrong first pick each reset streak', () => {
  const resets = [
    { teacherPass: true },
    { recognised: true, watched: true },
    { skipped: true },
    { recognised: true, wrongFirst: true }
  ];

  for (const outcome of resets) {
    const session = createSession({ pool: POOL, rng: () => 0 });
    session.complete({ recognised: true, maxStage: 0 });
    const result = session.complete({ maxStage: 0, ...outcome });
    assert.equal(result.currentStreak, 0);
    assert.equal(result.bestStreak, 1);
  }
});
