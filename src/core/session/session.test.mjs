import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POOL } from '../../config/vocab.js';
import { createSeededRng, createSession } from './session.js';

const POOL = ['jump', 'run', 'walk', 'dance', 'swim', 'fly', 'climb', 'catch', 'drink'];

function verbs(session) {
  return session.queue.map(({ verb }) => verb);
}

function completeRound(session, firstOutcome = {}) {
  let first = true;
  while (!session.done) {
    session.complete(first ? firstOutcome : { recognised: true, quality: 75 });
    first = false;
  }
}

test('the default round contains all 12 active verbs exactly once', () => {
  const session = createSession({ rng: () => 0 });

  assert.equal(DEFAULT_POOL.length, 12);
  assert.equal(session.queue.length, DEFAULT_POOL.length);
  assert.deepEqual([...verbs(session)].sort(), [...DEFAULT_POOL].sort());
  assert.equal(new Set(verbs(session)).size, DEFAULT_POOL.length);
  completeRound(session);
  assert.deepEqual(
    { words: session.summary().wordCount, attempts: session.summary().itemCount },
    { words: 12, attempts: 12 }
  );
});

test('needed-help, watched, skipped, and wrong-first outcomes add no copy', () => {
  const outcomes = [
    { maxStage: 2 },
    { recognised: true, watched: true },
    { skipped: true },
    { recognised: true, wrongFirst: true }
  ];

  for (const outcome of outcomes) {
    const session = createSession({ pool: POOL, rng: () => 0 });
    const verb = session.current().verb;
    const before = verbs(session);
    session.complete(outcome);

    assert.deepEqual(verbs(session), before);
    assert.equal(session.queue.filter((item) => item.verb === verb).length, 1);
    assert.equal(session.summary().neededHelp.includes(verb), true);
  }
});

test('a second round reshuffles the whole pool without help-first ordering', () => {
  const seed = 'second-round';
  const helped = createSession({ pool: POOL, rng: createSeededRng(seed) });
  const plain = createSession({ pool: POOL, rng: createSeededRng(seed) });
  const helpVerb = helped.current().verb;

  completeRound(helped, { maxStage: 2 });
  completeRound(plain);
  helped.startRound();
  plain.startRound();

  assert.equal(helped.summary().neededHelp.includes(helpVerb), false);
  assert.deepEqual(verbs(helped), verbs(plain));
  assert.deepEqual([...verbs(helped)].sort(), [...POOL].sort());
  assert.equal(new Set(verbs(helped)).size, POOL.length);
});

test('a custom three-verb pool produces exactly those three items once each', () => {
  const session = createSession({ pool: ['drink', 'eat', 'cut'], rng: () => 0 });

  assert.equal(session.queue.length, 3);
  assert.deepEqual([...verbs(session)].sort(), ['cut', 'drink', 'eat']);
});

test('shuffle: false keeps a debug pool in its given order', () => {
  const session = createSession({ pool: ['wash', 'drink', 'cut'], shuffle: false, rng: () => 0 });

  assert.deepEqual(verbs(session), ['wash', 'drink', 'cut']);
});

test('stop is not in the default pool', () => {
  assert.equal(DEFAULT_POOL.includes('stop'), false);
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
